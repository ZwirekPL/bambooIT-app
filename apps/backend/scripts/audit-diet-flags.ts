/**
 * Retrospective audit of S-11+ diet flags computer.
 *
 * For every Recipe in DB, compute the proposed new flags and compare to the
 * existing RecipeDietFlag rows. Highlights which flags are over-broad under
 * the current algorithm (goutFriendly 93%, pregnancyFriendly 93%).
 *
 * Read-only.
 */

import 'dotenv/config';
import { prisma } from '@db';
import { computeDietFlags, type DietFlagCode, type DietFlagInput } from '../src/scraper/utils/dietFlags';

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log('=== S-11+ diet flags — retrospective audit ===\n');

  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      ingredients: {
        select: {
          displayName: true,
          cleanProduct: { select: { name: true } },
        },
      },
      nutritionSnapshot: {
        select: {
          kcal: true, protein_g: true, fat_g: true, saturatedFat_g: true,
          carbs_g: true, sugars_g: true, fiber_g: true, sodium_mg: true,
        },
      },
      dietFlags: { select: { flagCode: true, value: true } },
    },
  });

  console.log(`Loaded ${recipes.length} recipes.\n`);

  const proposedCount: Record<string, number> = {};
  const currentCount: Record<string, number> = {};
  let evaluated = 0;

  for (const r of recipes) {
    const ingredientNames = r.ingredients
      .map((i) => i.cleanProduct?.name ?? i.displayName ?? '')
      .filter(Boolean);

    const input: DietFlagInput = {
      ingredientNames,
      nutrition: r.nutritionSnapshot
        ? {
            calories: decimalToNumber(r.nutritionSnapshot.kcal),
            protein: decimalToNumber(r.nutritionSnapshot.protein_g),
            fat: decimalToNumber(r.nutritionSnapshot.fat_g),
            saturatedFat: decimalToNumber(r.nutritionSnapshot.saturatedFat_g),
            carbs: decimalToNumber(r.nutritionSnapshot.carbs_g),
            sugar: decimalToNumber(r.nutritionSnapshot.sugars_g),
            fiber: decimalToNumber(r.nutritionSnapshot.fiber_g),
            sodium: decimalToNumber(r.nutritionSnapshot.sodium_mg),
          }
        : null,
    };

    const proposed = computeDietFlags(input);
    evaluated++;

    for (const p of proposed) {
      if (p.value) proposedCount[p.code] = (proposedCount[p.code] ?? 0) + 1;
    }
    for (const d of r.dietFlags) {
      if (d.value) currentCount[d.flagCode] = (currentCount[d.flagCode] ?? 0) + 1;
    }
  }

  // Print comparison
  const allCodes = new Set<string>([...Object.keys(currentCount), ...Object.keys(proposedCount)]);
  const sorted = [...allCodes].sort();

  console.log('Flag              | Current %  | Proposed % | Delta');
  console.log('------------------|------------|------------|------');
  for (const code of sorted) {
    const cur = currentCount[code] ?? 0;
    const prop = proposedCount[code] ?? 0;
    const curPct = Math.round((100 * cur) / evaluated);
    const propPct = Math.round((100 * prop) / evaluated);
    const delta = propPct - curPct;
    const sign = delta > 0 ? `+${delta}` : String(delta);
    console.log(
      `${code.padEnd(18)}| ${String(curPct).padStart(6)}% (${String(cur).padStart(4)}) | ${String(propPct).padStart(6)}% (${String(prop).padStart(4)}) | ${sign.padStart(5)}pp`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
