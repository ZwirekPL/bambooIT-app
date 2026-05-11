/**
 * Faza D Phase 0 Task #15 (M5) — backward-compat shape validation.
 *
 * Loads 10 random pre-Faza-D DietPlan records, decrypts content, walks the
 * structure asserting that `days[].meals[].items[]` matches the shape that
 * frontend (DietPlanView) and PDF (meal-card.ts) consume. Reports any
 * legacy plans with shapes that would break post-refactor rendering.
 *
 * Run: cd apps/backend && npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/faza-d-validate-legacy-plans.ts
 *
 * Read-only. Reports findings to stdout — no DB mutations.
 */

import { prisma } from '@db';
import { decryptJson } from '../src/utils/encryption';

interface PlanIssue {
  planId: string;
  patientId: string;
  createdAt: Date;
  severity: 'WARN' | 'ERROR';
  field: string;
  message: string;
}

function checkPlanShape(planId: string, patientId: string, createdAt: Date, content: unknown): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const push = (severity: 'WARN' | 'ERROR', field: string, message: string) =>
    issues.push({ planId, patientId, createdAt, severity, field, message });

  if (!content || typeof content !== 'object') {
    push('ERROR', 'root', 'content not an object');
    return issues;
  }
  const c = content as Record<string, unknown>;
  if (!Array.isArray(c.days)) {
    push('ERROR', 'days', 'not an array');
    return issues;
  }

  const days = c.days as unknown[];
  for (let di = 0; di < days.length; di++) {
    const day = days[di] as Record<string, unknown> | null;
    if (!day || typeof day !== 'object') {
      push('ERROR', `days[${di}]`, 'not an object');
      continue;
    }
    if (typeof day.day !== 'string') push('WARN', `days[${di}].day`, `not a string (got ${typeof day.day})`);
    if (!Array.isArray(day.meals)) {
      push('ERROR', `days[${di}].meals`, 'not an array');
      continue;
    }
    const meals = day.meals as unknown[];
    for (let mi = 0; mi < meals.length; mi++) {
      const meal = meals[mi] as Record<string, unknown> | null;
      if (!meal || typeof meal !== 'object') {
        push('ERROR', `days[${di}].meals[${mi}]`, 'not an object');
        continue;
      }
      if (typeof meal.name !== 'string') push('WARN', `days[${di}].meals[${mi}].name`, 'missing or not string');
      if (!Array.isArray(meal.items)) {
        push('ERROR', `days[${di}].meals[${mi}].items`, 'not an array');
        continue;
      }
      const items = meal.items as unknown[];
      if (items.length === 0) push('WARN', `days[${di}].meals[${mi}].items`, 'empty array');
      for (let ii = 0; ii < items.length; ii++) {
        const item = items[ii];
        // Frontend (DietPlanView.formatMealItem) handles BOTH string and object — both shapes valid
        if (typeof item === 'string') continue;
        if (!item || typeof item !== 'object') {
          push('ERROR', `days[${di}].meals[${mi}].items[${ii}]`, `unexpected type ${typeof item}`);
          continue;
        }
        const it = item as Record<string, unknown>;
        if (typeof it.name !== 'string') push('WARN', `days[${di}].meals[${mi}].items[${ii}].name`, 'missing or not string');
        // Frontend accepts undefined macro fields (formatMealItem checks `if (item.kcal)`) — no error here
        if (it.kcal !== undefined && typeof it.kcal !== 'number') {
          push('WARN', `days[${di}].meals[${mi}].items[${ii}].kcal`, `not a number (got ${typeof it.kcal})`);
        }
        if (it.ingredients !== undefined && !Array.isArray(it.ingredients)) {
          push('WARN', `days[${di}].meals[${mi}].items[${ii}].ingredients`, 'not an array');
        }
      }
    }
  }
  return issues;
}

async function main() {
  console.log('=== Faza D Phase 0 Task #15 — legacy DietPlan shape validation ===\n');

  // Pick 10 random plans (sampled ORDER BY random)
  const planIds = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "DietPlan"
    WHERE content IS NOT NULL
    ORDER BY random()
    LIMIT 10
  `;

  if (planIds.length === 0) {
    console.log('No DietPlan rows found. Nothing to validate.');
    return;
  }

  console.log(`Picked ${planIds.length} random plans:\n`);

  const allIssues: PlanIssue[] = [];
  let plansOk = 0;
  let plansWithWarn = 0;
  let plansWithErr = 0;

  for (const { id } of planIds) {
    const plan = await prisma.dietPlan.findUnique({
      where: { id },
      select: { id: true, patientId: true, createdAt: true, content: true, status: true, source: true },
    });
    if (!plan || !plan.content) continue;

    let decrypted: unknown;
    try {
      decrypted = decryptJson(plan.content as Record<string, unknown>);
    } catch (err) {
      console.log(`  [${plan.id.slice(-8)}] DECRYPT FAILED: ${(err as Error).message}`);
      allIssues.push({
        planId: plan.id,
        patientId: plan.patientId,
        createdAt: plan.createdAt,
        severity: 'ERROR',
        field: 'content',
        message: `decrypt failed: ${(err as Error).message}`,
      });
      plansWithErr++;
      continue;
    }

    const issues = checkPlanShape(plan.id, plan.patientId, plan.createdAt, decrypted);
    const hasError = issues.some(i => i.severity === 'ERROR');
    const hasWarn = issues.some(i => i.severity === 'WARN');

    const status = hasError ? '❌ ERR' : hasWarn ? '🟡 WARN' : '✅ OK';
    const ageInDays = Math.floor((Date.now() - plan.createdAt.getTime()) / (24 * 60 * 60 * 1000));

    console.log(`  [${plan.id.slice(-8)}] ${status} | ${plan.status} ${plan.source} | age ${ageInDays}d | ${issues.length} issue(s)`);

    if (hasError) plansWithErr++;
    else if (hasWarn) plansWithWarn++;
    else plansOk++;

    allIssues.push(...issues);
  }

  console.log('\n--- Summary ---');
  console.log(`  ✅ OK:    ${plansOk}/10`);
  console.log(`  🟡 WARN:  ${plansWithWarn}/10`);
  console.log(`  ❌ ERR:   ${plansWithErr}/10`);

  if (allIssues.length > 0) {
    console.log('\n--- Issue detail ---');
    for (const issue of allIssues) {
      console.log(`  [${issue.planId.slice(-8)}] ${issue.severity} ${issue.field}: ${issue.message}`);
    }
  }

  console.log('\n--- Frontend compat verdict ---');
  if (plansWithErr === 0) {
    console.log('  ✅ All sampled plans have valid shape. Frontend MealCard (items.map) will render correctly.');
    console.log('  ✅ Backward compat for Faza D — no regression risk from existing plans.');
  } else {
    console.log('  ❌ Some plans have shape errors. Investigate before Phase 1 default-on rollout.');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
