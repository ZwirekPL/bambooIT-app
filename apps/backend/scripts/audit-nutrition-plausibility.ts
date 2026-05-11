/**
 * S-8 nutrition plausibility retrospective audit.
 *
 * For each Recipe with a nutrition snapshot, check whether per-serving kcal
 * falls within the expected band for its mealType. Surfaces recipes that
 * would fail plausibility during a new scrape (most likely wrong `servings`
 * count or scaling error).
 *
 * Read-only.
 */

import 'dotenv/config';
import { prisma } from '@db';
import { checkPlausibility, type MealType } from '../src/scraper/utils/nutritionCompare';

const KNOWN_MEAL_TYPES: MealType[] = [
  'BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'DINNER', 'SUPPER',
  'SNACK', 'DESSERT', 'DRINK', 'SAUCE', 'SIDE_DISH',
];

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log('=== S-8 nutrition plausibility — retrospective DB audit ===\n');

  const recipes = await prisma.recipe.findMany({
    where: { nutritionSnapshot: { isNot: null } },
    select: {
      id: true,
      title: true,
      mealType: true,
      sourceUrl: true,
      nutritionSnapshot: { select: { kcal: true } },
    },
  });

  console.log(`Loaded ${recipes.length} recipes with nutrition snapshot.\n`);

  const byMealType: Record<string, { total: number; ok: number; above: number; below: number; missing: number }> = {};
  const violations: Array<{ id: string; title: string; mealType: string; kcal: number | null; reasons: string[] }> = [];

  for (const r of recipes) {
    const mealTypeStr = String(r.mealType);
    if (!byMealType[mealTypeStr]) {
      byMealType[mealTypeStr] = { total: 0, ok: 0, above: 0, below: 0, missing: 0 };
    }
    byMealType[mealTypeStr].total++;

    const kcal = decimalToNumber(r.nutritionSnapshot?.kcal);
    if (kcal == null) {
      byMealType[mealTypeStr].missing++;
      continue;
    }

    const mealType = (KNOWN_MEAL_TYPES as string[]).includes(mealTypeStr)
      ? (mealTypeStr as MealType)
      : 'LUNCH'; // fallback for unknown mealType values

    const report = checkPlausibility({ calories: kcal }, mealType);
    if (report.ok) {
      byMealType[mealTypeStr].ok++;
    } else {
      const exceeds = report.reasons.some((r) => r.includes('exceeds'));
      const below = report.reasons.some((r) => r.includes('below'));
      if (exceeds) byMealType[mealTypeStr].above++;
      if (below) byMealType[mealTypeStr].below++;
      if (violations.length < 40) {
        violations.push({
          id: r.id,
          title: r.title,
          mealType: mealTypeStr,
          kcal,
          reasons: report.reasons,
        });
      }
    }
  }

  console.log('Plausibility per meal type:');
  console.log('MealType          | Total | OK    | Above | Below | Missing | OK%');
  console.log('------------------|-------|-------|-------|-------|---------|-----');
  for (const [mt, s] of Object.entries(byMealType).sort((a, b) => b[1].total - a[1].total)) {
    const pct = s.total > 0 ? Math.round((100 * s.ok) / s.total) : 0;
    console.log(
      `${mt.padEnd(18)}| ${String(s.total).padStart(5)} | ${String(s.ok).padStart(5)} | ${String(s.above).padStart(5)} | ${String(s.below).padStart(5)} | ${String(s.missing).padStart(7)} | ${String(pct).padStart(3)}%`
    );
  }

  console.log(`\nSample violations (first 40):`);
  violations.forEach((v) => {
    console.log(`  [${v.mealType}] ${v.kcal} kcal | ${v.title.slice(0, 55)}`);
    v.reasons.forEach((r) => console.log(`      ${r}`));
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
