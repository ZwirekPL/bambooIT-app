/**
 * BUG-4 Session A: baseline analysis of shopping efficiency across past plans.
 *
 * Runs computeShoppingEfficiency() on the last N DietPlan records and prints a
 * table with uniqueIngredients, totalIngredientUses, efficiency, diversityScore.
 * Grouped by source (AI vs MANUAL) and solver flag (DB_SOLVER on/off).
 *
 * Usage:
 *   npm run analyze:shopping-efficiency                  # last 20 plans
 *   npm run analyze:shopping-efficiency -- --limit=50
 *   npm run analyze:shopping-efficiency -- --since=2026-04-01
 *
 * Read-only — no DB mutations.
 */

import 'dotenv/config';
import { prisma } from '@db';
import { computeShoppingEfficiency } from '../src/services/dbPlanAssembly.service';

interface Row {
  planId: string;
  createdAt: Date;
  source: string;
  aiModel: string | null;
  generationMethod: string | null;
  numDays: number;
  totalSlots: number;
  uniqueIngredients: number;
  totalIngredientUses: number;
  shoppingEfficiency: number;
  diversityScore: number | null;
  seasoningsExcluded: number;
}

const args = process.argv.slice(2);
const LIMIT = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 20);
const SINCE_ARG = args.find((a) => a.startsWith('--since='))?.split('=')[1];
const SINCE = SINCE_ARG ? new Date(SINCE_ARG) : undefined;

async function main(): Promise<void> {
  const plans = await prisma.dietPlan.findMany({
    where: SINCE ? { createdAt: { gte: SINCE } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
    select: {
      id: true, createdAt: true, source: true, aiModel: true,
      policyMetadata: true,
    },
  });

  if (plans.length === 0) {
    console.log('No plans found in the requested range.');
    return;
  }

  console.log(`Analyzing ${plans.length} plans…\n`);

  const rows: Row[] = [];

  for (const plan of plans) {
    const meta = (plan.policyMetadata as Record<string, unknown> | null) ?? {};
    const recipeIds = (meta.recipeIds as string[] | undefined) ?? [];
    const coverage = meta.coverageReport as {
      diversityScore?: number; totalSlots?: number;
    } | undefined;
    const generationMethod = (meta.generationMethod as string | undefined) ?? null;

    if (recipeIds.length === 0) continue;

    const shopping = await computeShoppingEfficiency(recipeIds);

    rows.push({
      planId: plan.id,
      createdAt: plan.createdAt,
      source: plan.source,
      aiModel: plan.aiModel,
      generationMethod,
      numDays: Math.ceil(recipeIds.length / 5),  // approximation
      totalSlots: coverage?.totalSlots ?? recipeIds.length,
      uniqueIngredients: shopping.uniqueIngredients,
      totalIngredientUses: shopping.totalIngredientUses,
      shoppingEfficiency: shopping.shoppingEfficiencyScore,
      diversityScore: coverage?.diversityScore ?? null,
      seasoningsExcluded: shopping.seasoningsExcluded,
    });
  }

  // ─── Table output ──────────────────────────────────────────────────────
  console.log('='.repeat(120));
  console.log(
    'Plan ID'.padEnd(27) +
    'Date'.padEnd(12) +
    'Source'.padEnd(8) +
    'Method'.padEnd(11) +
    'Slots'.padStart(6) +
    ' Unique'.padStart(8) +
    ' Uses'.padStart(7) +
    '  Reuse'.padStart(8) +
    '  Div'.padStart(7) +
    '  Seas'.padStart(7),
  );
  console.log('-'.repeat(120));
  for (const r of rows) {
    console.log(
      r.planId.slice(-25).padEnd(27) +
      r.createdAt.toISOString().slice(0, 10).padEnd(12) +
      r.source.padEnd(8) +
      (r.generationMethod ?? 'n/a').padEnd(11) +
      String(r.totalSlots).padStart(6) +
      String(r.uniqueIngredients).padStart(8) +
      String(r.totalIngredientUses).padStart(7) +
      r.shoppingEfficiency.toFixed(2).padStart(8) +
      (r.diversityScore?.toFixed(2) ?? ' n/a').padStart(7) +
      String(r.seasoningsExcluded).padStart(7),
    );
  }
  console.log('='.repeat(120));

  // ─── Group summaries ───────────────────────────────────────────────────
  console.log('\nGrouped averages:\n');

  const groupBy = (key: (r: Row) => string): Map<string, Row[]> => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const k = key(r);
      const list = map.get(k) ?? [];
      list.push(r);
      map.set(k, list);
    }
    return map;
  };

  const printGroup = (label: string, groups: Map<string, Row[]>): void => {
    console.log(`── By ${label} ──`);
    for (const [k, list] of groups) {
      const avgUnique = list.reduce((s, r) => s + r.uniqueIngredients, 0) / list.length;
      const avgUses = list.reduce((s, r) => s + r.totalIngredientUses, 0) / list.length;
      const avgEff = list.reduce((s, r) => s + r.shoppingEfficiency, 0) / list.length;
      const avgDiv = list.reduce((s, r) => s + (r.diversityScore ?? 0), 0) / list.length;
      console.log(
        `  ${k.padEnd(20)} n=${String(list.length).padStart(3)}  ` +
        `unique=${avgUnique.toFixed(1).padStart(6)}  ` +
        `uses=${avgUses.toFixed(1).padStart(6)}  ` +
        `reuse=${avgEff.toFixed(2).padStart(5)}  ` +
        `div=${avgDiv.toFixed(2).padStart(5)}`,
      );
    }
    console.log('');
  };

  printGroup('source', groupBy((r) => r.source));
  printGroup('method', groupBy((r) => r.generationMethod ?? 'n/a'));
  printGroup('aiModel', groupBy((r) => r.aiModel ?? 'none'));

  // ─── Top shared products across ALL plans ──────────────────────────────
  const allRecipeIds: string[] = [];
  for (const plan of plans) {
    const meta = (plan.policyMetadata as Record<string, unknown> | null) ?? {};
    const recipeIds = (meta.recipeIds as string[] | undefined) ?? [];
    allRecipeIds.push(...recipeIds);
  }
  if (allRecipeIds.length > 0) {
    const global = await computeShoppingEfficiency(allRecipeIds);
    console.log('\nTop 10 shared products across all analyzed plans:');
    for (const p of global.topSharedProducts) {
      console.log(`  ${p.name.padEnd(40)} ${String(p.usedInSlots).padStart(5)} uses`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
