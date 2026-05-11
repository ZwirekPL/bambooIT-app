/**
 * Faza F — Fix recipes whose servings field is too high (scale bug).
 *
 * Counterpart to scripts/fix-1serving-recipes.ts:
 *   • fix-1serving handles servings=1 + per-serving kcal>1200 (batch dish wrongly
 *     marked as 1 serving)
 *   • fix-recipe-servings-bug handles the OPPOSITE bug: a 4-portion main dish
 *     scraped with servings=20-50 and absurdly low per-serving kcal (e.g. "Gulasz
 *     z łopatki" 30× 141 kcal/p with total 4239 kcal, realistically 8 portions
 *     of ~530 kcal each).
 *
 * Source of candidates: DataQualityIssue rows with issueCode
 * RECIPE_SCALE_BUG_SUSPECT (written by audit-recipe-units.ts in Faza E.3).
 *
 * Algorithm:
 *   totalKcal = currentKcalPerServing × currentServings
 *   target    = TARGET_BY_CATEGORY[category] (or by title pattern)
 *   newServings = max(2, round(totalKcal / target))
 *   factor = currentServings / newServings   // > 1 (kcal/p grows)
 *   UPDATE RecipeNutritionSnapshot per-serving columns × factor
 *   UPDATE Recipe.servings = newServings
 *   Mark DataQualityIssue isResolved=true
 *   Insert AuditLog action=FIX_RECIPE_SCALE_BUG
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/fix-recipe-servings-bug.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/fix-recipe-servings-bug.ts --apply
 */

import { prisma } from '@db';

const APPLY = process.argv.includes('--apply');

// Target per-serving kcal — same table as fix-1serving-recipes for consistency.
const TARGET_BY_CATEGORY: Record<string, number> = {
  main: 550,
  dessert: 400,
  snack: 250,
  soup: 300,
  breakfast: 450,
  side_dish: 200,
  drink: 200,
};
const DEFAULT_TARGET = 500;

const DESSERT_TITLE_RE = /\b(ciasto|ciasteczk|sernik|tort|torcik|brownie|placek|placki|rolada|szarlotk|babka|babeczk|babeczki|babeczk|keks|muffin|muffinki|babek|piernik|mazurek)\w*/i;
const SOUP_TITLE_RE = /\b(zupa|krem|barszcz|bulion|chłodnik|chlodnik|krupnik)\w*/i;
const DRINK_TITLE_RE = /\b(koktajl|smoothie|kompot|lemoniada|napój|napoj|herbat|kawa)\w*/i;

// Per-serving columns in RecipeNutritionSnapshot — multiplied by `factor`.
// Excludes total* columns which represent recipe-wide totals and should NOT change.
const NUMERIC_COLS = [
  'kcal', 'protein_g', 'fat_g', 'saturatedFat_g', 'carbs_g', 'sugars_g', 'fiber_g',
  'salt_g', 'monounsaturatedFat_g', 'polyunsaturatedFat_g', 'transFat_g',
  'omega3_g', 'omega6_g', 'epa_g', 'dha_g', 'ala_g', 'starch_g', 'addedSugars_g',
  'sodium_mg', 'potassium_mg', 'calcium_mg', 'magnesium_mg', 'phosphorus_mg',
  'chloride_mg', 'iron_mg', 'zinc_mg', 'copper_mg', 'manganese_mg', 'iodine_ug',
  'selenium_ug', 'chromium_ug', 'molybdenum_ug', 'fluoride_ug',
  'vitaminA_ug', 'vitaminD_ug', 'vitaminE_mg', 'vitaminK_ug',
  'vitaminB1_mg', 'vitaminB2_mg', 'vitaminB3_mg', 'vitaminB5_mg', 'vitaminB6_mg',
  'vitaminB12_ug', 'vitaminC_mg', 'folate_ug', 'biotin_ug', 'choline_mg',
  'cholesterol_mg',
] as const;

interface Candidate {
  recipeId: string;
  issueId: string;
  title: string;
  category: string | null;
  mealType: string;
  currentServings: number;
  currentKcalPerServing: number;
  totalKcal: number;
  newServings: number;
  factor: number;
  reason: string;
}

function pickTarget(title: string, category: string | null, mealType: string): { target: number; reason: string } {
  if (DESSERT_TITLE_RE.test(title)) return { target: TARGET_BY_CATEGORY.dessert, reason: 'title:dessert' };
  if (SOUP_TITLE_RE.test(title))    return { target: TARGET_BY_CATEGORY.soup,    reason: 'title:soup' };
  if (DRINK_TITLE_RE.test(title))   return { target: TARGET_BY_CATEGORY.drink,   reason: 'title:drink' };
  if (category && TARGET_BY_CATEGORY[category]) {
    return { target: TARGET_BY_CATEGORY[category]!, reason: `cat:${category}` };
  }
  // Fallback by mealType
  if (mealType === 'BREAKFAST' || mealType === 'SECOND_BREAKFAST') {
    return { target: TARGET_BY_CATEGORY.breakfast, reason: `mealType:${mealType}` };
  }
  if (mealType === 'SNACK' || mealType === 'DESSERT') {
    return { target: TARGET_BY_CATEGORY[mealType.toLowerCase()] ?? DEFAULT_TARGET, reason: `mealType:${mealType}` };
  }
  if (mealType === 'DRINK') return { target: TARGET_BY_CATEGORY.drink, reason: 'mealType:DRINK' };
  if (mealType === 'SAUCE' || mealType === 'SIDE_DISH') {
    return { target: TARGET_BY_CATEGORY.side_dish, reason: `mealType:${mealType}` };
  }
  return { target: DEFAULT_TARGET, reason: 'default' };
}

async function main() {
  console.log('\n=== Faza F — Fix recipe servings bug (RECIPE_SCALE_BUG_SUSPECT) ===');
  console.log(`Mode: ${APPLY ? 'LIVE (writes)' : 'DRY RUN'}\n`);

  // Pull candidates from DataQualityIssue queue (written by Faza E.3 audit).
  const issues = await prisma.dataQualityIssue.findMany({
    where: {
      entityType: 'Recipe',
      issueCode: 'RECIPE_SCALE_BUG_SUSPECT',
      isResolved: false,
    },
    select: { id: true, entityId: true },
  });

  console.log(`Open RECIPE_SCALE_BUG_SUSPECT issues: ${issues.length}\n`);
  if (issues.length === 0) {
    console.log('Nothing to fix.\n');
    return;
  }

  const recipes = await prisma.recipe.findMany({
    where: { id: { in: issues.map((i) => i.entityId) } },
    select: {
      id: true,
      title: true,
      category: true,
      mealType: true,
      servings: true,
      nutritionSnapshot: { select: { kcal: true } },
    },
  });

  const issueByRecipe = new Map(issues.map((i) => [i.entityId, i.id]));

  const candidates: Candidate[] = [];
  for (const r of recipes) {
    if (!r.nutritionSnapshot) continue; // skip recipes without snapshot
    const kcalPerServing = Number(r.nutritionSnapshot.kcal);
    const totalKcal = kcalPerServing * r.servings;
    const { target, reason } = pickTarget(r.title, r.category, r.mealType);
    const newServings = Math.max(2, Math.round(totalKcal / target));
    const factor = r.servings / newServings;

    // Sanity guard: factor must be > 1 (we are SHRINKING servings, GROWING kcal/p).
    // If factor ≤ 1, it means the recipe doesn't fit the SCALE_BUG profile — skip.
    if (factor <= 1.05) {
      continue;
    }

    candidates.push({
      recipeId: r.id,
      issueId: issueByRecipe.get(r.id)!,
      title: r.title,
      category: r.category,
      mealType: r.mealType,
      currentServings: r.servings,
      currentKcalPerServing: kcalPerServing,
      totalKcal,
      newServings,
      factor,
      reason,
    });
  }

  console.log(`Candidates after sanity filter: ${candidates.length}\n`);

  // ─── Distribution by reason ─────────────────────────────────────────────
  console.log('--- By target reason ---');
  const reasonHist = new Map<string, number>();
  for (const c of candidates) reasonHist.set(c.reason, (reasonHist.get(c.reason) ?? 0) + 1);
  for (const [k, n] of [...reasonHist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} → ${n}`);
  }

  // ─── New servings histogram ─────────────────────────────────────────────
  console.log('\n--- New servings distribution ---');
  const sHist = new Map<number, number>();
  for (const c of candidates) sHist.set(c.newServings, (sHist.get(c.newServings) ?? 0) + 1);
  for (const [s, n] of [...sHist.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(s).padStart(2)} servings → ${n}`);
  }

  // ─── Sample (top 25 by total kcal) ──────────────────────────────────────
  console.log('\n--- Sample (top 25 by total kcal) ---');
  for (const c of [...candidates].sort((a, b) => b.totalKcal - a.totalKcal).slice(0, 25)) {
    const newKcal = Math.round(c.totalKcal / c.newServings);
    console.log(`  ${String(c.currentServings).padStart(2)}× ${String(Math.round(c.currentKcalPerServing)).padStart(3)} → ${String(c.newServings).padStart(2)}× ${String(newKcal).padStart(4)} kcal/p  [${c.reason}]  ${c.title}`);
  }

  if (!APPLY) {
    console.log('\n(dry-run — pass --apply to write)\n');
    return;
  }

  // ─── Apply ──────────────────────────────────────────────────────────────
  console.log('\nApplying writes...');
  let updated = 0;
  for (const c of candidates) {
    const factor = c.factor;
    const setClauses = NUMERIC_COLS.map((col) => `"${col}" = "${col}" * ${factor}`).join(', ');

    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        `UPDATE "RecipeNutritionSnapshot" SET ${setClauses} WHERE "recipeId" = $1`,
        c.recipeId,
      ),
      prisma.recipe.update({
        where: { id: c.recipeId },
        data: { servings: c.newServings },
      }),
      prisma.dataQualityIssue.update({
        where: { id: c.issueId },
        data: { isResolved: true, resolvedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          action: 'FIX_RECIPE_SCALE_BUG',
          resourceType: 'RECIPE',
          resourceId: c.recipeId,
          metadata: {
            from: { servings: c.currentServings, kcalPerServing: c.currentKcalPerServing },
            to:   { servings: c.newServings,    kcalPerServing: Math.round(c.totalKcal / c.newServings) },
            factor: Math.round(c.factor * 1000) / 1000,
            totalKcal: Math.round(c.totalKcal),
            reason: c.reason,
            title: c.title,
          },
        },
      }),
    ]);

    updated++;
    if (updated % 50 === 0 || updated === candidates.length) {
      console.log(`  Updated ${updated}/${candidates.length}...`);
    }
  }

  console.log(`\nDone. Fixed ${updated} recipes; resolved matching DataQualityIssue rows.\n`);
}

main()
  .catch((err) => { console.error('FAILED:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
