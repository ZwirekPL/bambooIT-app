/**
 * BUG-4 verification: regenerate a plan for an existing patient using the
 * Session B-fixed solver (rebuilt Docker image), then compare shopping
 * efficiency vs the original plan stored in DB.
 *
 * Read-only — does NOT save the new plan to DB. Just compares metrics.
 *
 * Usage:
 *   cd apps/backend
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register \
 *     scripts/verify-bug4-end-to-end.ts <baselinePlanId>
 */

import 'dotenv/config';
import { prisma } from '@db';
import { solveWeekPlan } from '../src/services/weekSolver.service';
import { computeShoppingEfficiency } from '../src/services/dbPlanAssembly.service';

async function main(): Promise<void> {
  const baselineId = process.argv[2];
  if (!baselineId) {
    console.error('Usage: ts-node verify-bug4-end-to-end.ts <baselinePlanId>');
    process.exit(1);
  }

  // Load baseline plan
  const baseline = await prisma.dietPlan.findUnique({
    where: { id: baselineId },
    select: {
      id: true, patientId: true, source: true, aiModel: true,
      policyMetadata: true,
    },
  });
  if (!baseline) {
    console.error(`Plan ${baselineId} not found`);
    process.exit(1);
  }

  const baselineMeta = (baseline.policyMetadata as Record<string, unknown> | null) ?? {};
  const baselineRecipeIds = (baselineMeta.recipeIds as string[] | undefined) ?? [];
  const baselineCoverage = (baselineMeta.coverageReport as {
    shoppingEfficiencyScore?: number; diversityScore?: number;
  } | undefined) ?? {};

  console.log('═'.repeat(70));
  console.log(`BASELINE plan ${baseline.id}`);
  console.log(`  patient: ${baseline.patientId}`);
  console.log(`  source: ${baseline.source}, aiModel: ${baseline.aiModel}`);
  console.log(`  recipeIds: ${baselineRecipeIds.length}`);
  console.log(`  shoppingEfficiencyScore (stored): ${baselineCoverage.shoppingEfficiencyScore ?? 'n/a (pre-Sesja A)'}`);
  console.log(`  diversityScore (stored): ${baselineCoverage.diversityScore ?? 'n/a'}`);

  // Recompute baseline shopping efficiency from current code (consistency check)
  const baselineMetrics = baselineRecipeIds.length > 0
    ? await computeShoppingEfficiency(baselineRecipeIds)
    : null;
  if (baselineMetrics) {
    console.log(`  shoppingEfficiencyScore (recomputed):  ${baselineMetrics.shoppingEfficiencyScore}`);
    console.log(`  uniqueIngredients: ${baselineMetrics.uniqueIngredients}, totalUses: ${baselineMetrics.totalIngredientUses}`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Regenerating with NEW solver (Sesja B fix, BONUS_REUSE=50)…\n`);

  // Run the full solver pipeline — same code path as production
  const solverResult = await solveWeekPlan({
    patientId: baseline.patientId,
    days: 7,
  });

  console.log(`  solver: status=${solverResult.status}, `
    + `objective=${solverResult.objectiveValue.toFixed(1)}, `
    + `time=${solverResult.durationMs}ms, vars=${solverResult.totalVariables}`);

  if (solverResult.status !== 'OPTIMAL' && solverResult.status !== 'FEASIBLE') {
    console.error(`Solver returned ${solverResult.status} — cannot compare`);
    process.exit(1);
  }

  // Extract recipe IDs from solver selections (preserve duplicate counts per slot)
  const newRecipeIds: string[] = [];
  for (const sel of solverResult.selections.values()) {
    newRecipeIds.push(sel.recipeId);
  }

  const newShopping = await computeShoppingEfficiency(newRecipeIds);

  console.log('\n' + '═'.repeat(70));
  console.log('COMPARISON');
  console.log('═'.repeat(70));

  const baseScore = baselineMetrics?.shoppingEfficiencyScore ?? 0;
  const baseUnique = baselineMetrics?.uniqueIngredients ?? 0;
  const baseUses = baselineMetrics?.totalIngredientUses ?? 0;

  console.log(`                              Baseline        New (Sesja B)`);
  console.log(`  recipeIds                    ${String(baselineRecipeIds.length).padStart(6)}          ${String(newRecipeIds.length).padStart(6)}`);
  console.log(`  shoppingEfficiencyScore      ${baseScore.toFixed(2).padStart(6)}          ${newShopping.shoppingEfficiencyScore.toFixed(2).padStart(6)}`);
  console.log(`  uniqueIngredients            ${String(baseUnique).padStart(6)}          ${String(newShopping.uniqueIngredients).padStart(6)}`);
  console.log(`  totalIngredientUses          ${String(baseUses).padStart(6)}          ${String(newShopping.totalIngredientUses).padStart(6)}`);

  const delta = newShopping.shoppingEfficiencyScore - baseScore;
  const pctChange = baseScore > 0 ? (delta / baseScore) * 100 : 0;

  console.log(`\n  Δ shoppingEfficiency: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%)`);

  if (delta >= 0.5) {
    console.log(`  → STRONG WIN (Δ ≥ 0.5) — keep Sesja B`);
  } else if (delta >= 0.2) {
    console.log(`  → MODEST WIN (Δ ≥ 0.2) — keep Sesja B`);
  } else if (delta >= -0.1) {
    console.log(`  → WITHIN NOISE (|Δ| < 0.1) — keep Sesja B (structural correctness > tiny number)`);
  } else {
    console.log(`  → REGRESSION (Δ < -0.1) — consider 'git revert cee5b8a'`);
  }

  console.log('\nTop shared products in NEW plan:');
  for (const p of newShopping.topSharedProducts.slice(0, 5)) {
    console.log(`  ${p.name.padEnd(35)} ${p.usedInSlots} uses`);
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
