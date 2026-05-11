/**
 * Recompute Recipe diet flags using the S-11 rule engine.
 *
 * Rebuilds RecipeDietFlag rows for the 19-flag taxonomy in
 * apps/backend/src/scraper/utils/dietFlags.ts using:
 *   - ingredient names (CleanProduct.name → FoodProduct.name → displayName fallback)
 *   - per-serving nutrition snapshot (RecipeNutritionSnapshot)
 *
 * Default scope (P0.1 — Recipe Overhaul Master Plan 2026-04-29):
 *   active recipes with cuisineType = 'uniwersalna' OR cuisineType IS NULL
 *
 * Usage:
 *   npx ts-node --esm scripts/recompute-dietflags.ts                    # dry-run, default scope
 *   npx ts-node --esm scripts/recompute-dietflags.ts --apply            # write
 *   npx ts-node --esm scripts/recompute-dietflags.ts --where "\"cuisineType\"='polska'" --apply
 *   npx ts-node --esm scripts/recompute-dietflags.ts --ids id1,id2 --apply
 *   npx ts-node --esm scripts/recompute-dietflags.ts --limit 5
 *
 * Prereq: apps/backend must be built (`npm run build -w backend`) so the rule engine
 * is available under apps/backend/dist/scraper/utils/dietFlags.js.
 */

import { prisma } from '../packages/database/dist/index.js';
import { computeDietFlags } from '../apps/backend/dist/scraper/utils/dietFlags.js';

// Mirror INGREDIENT_DRIVEN_CODES from apps/backend/src/scraper/pipeline/06-detect-flags.ts.
// Codes whose result depends purely on ingredient analysis are AUTO_RULE; the rest
// (kcal/macro/sodium thresholds) are HEURISTIC — they degrade when nutrition is sparse.
const INGREDIENT_DRIVEN_CODES = new Set<string>([
  'vegetarian',
  'vegan',
  'pescatarian',
  'glutenFree',
  'lactoseFree',
  'ibsFriendly',
  'goutFriendly',
]);

interface CliArgs {
  apply: boolean;
  where: string | null;
  ids: string[] | null;
  limit: number | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = { apply: false, where: null, ids: null, limit: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--dry-run') out.apply = false;
    else if (a === '--where') out.where = args[++i];
    else if (a === '--ids') out.ids = (args[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--limit') out.limit = parseInt(args[++i] ?? '', 10);
    else if (a.startsWith('--')) console.warn(`[warn] unknown flag: ${a}`);
  }
  return out;
}

async function loadTargetIds(args: CliArgs): Promise<string[]> {
  if (args.ids?.length) return args.ids;

  // Default scope = P0.1 backfill set.
  const whereClause = args.where ?? `("cuisineType" = 'uniwersalna' OR "cuisineType" IS NULL)`;
  const limitClause = args.limit ? `LIMIT ${Number(args.limit)}` : '';
  const sql = `
    SELECT id FROM "Recipe"
    WHERE "isActive" = true AND (${whereClause})
    ORDER BY id
    ${limitClause}
  `;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(sql);
  return rows.map((r) => r.id);
}

interface DietFlagInputNutrition {
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  saturatedFat?: number | null;
  carbs?: number | null;
  sugar?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  cholesterol?: number | null;
}

interface RecipeContext {
  id: string;
  title: string;
  cuisineType: string | null;
  ingredientNames: string[];
  nutrition: DietFlagInputNutrition | null;
}

async function loadRecipeContext(id: string): Promise<RecipeContext | null> {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      nutritionSnapshot: true,
      ingredients: {
        where: { isOptional: false },
        include: {
          cleanProduct: { select: { name: true } },
          foodProduct: { select: { name: true } },
        },
      },
    },
  });
  if (!recipe) return null;

  const ingredientNames = recipe.ingredients
    .map((i) => i.cleanProduct?.name ?? i.foodProduct?.name ?? i.displayName ?? '')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const snap = recipe.nutritionSnapshot;
  const num = (v: unknown): number | null => (v == null ? null : Number(v));
  const nutrition: DietFlagInputNutrition | null = snap
    ? {
        calories: num(snap.kcal),
        protein: num(snap.protein_g),
        fat: num(snap.fat_g),
        saturatedFat: num(snap.saturatedFat_g),
        carbs: num(snap.carbs_g),
        sugar: num(snap.sugars_g),
        fiber: num(snap.fiber_g),
        // Snapshot stores sodium_mg directly when known; salt_g is fallback.
        // Salt → sodium ≈ × 0.4 (g salt × 1000 × 0.4 = mg sodium = × 400).
        sodium:
          snap.sodium_mg != null
            ? Number(snap.sodium_mg)
            : snap.salt_g != null
              ? Math.round(Number(snap.salt_g) * 400)
              : null,
        cholesterol: num(snap.cholesterol_mg),
      }
    : null;

  return {
    id: recipe.id,
    title: recipe.title,
    cuisineType: recipe.cuisineType ?? null,
    ingredientNames,
    nutrition,
  };
}

interface FlagRow {
  flagCode: string;
  value: boolean;
  confidence: number;
  source: 'AUTO_RULE' | 'HEURISTIC';
}

function adaptResults(results: Array<{ code: string; value: boolean; confidence: number; reasons: string[] }>): FlagRow[] {
  return results.map((r) => ({
    flagCode: r.code,
    value: r.value,
    // Schema: RecipeDietFlag.confidence is Int (0-100). Rule engine returns 0-1.
    confidence: Math.max(0, Math.min(100, Math.round(r.confidence * 100))),
    source: INGREDIENT_DRIVEN_CODES.has(r.code) ? 'AUTO_RULE' : 'HEURISTIC',
  }));
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log('=== Recompute Recipe Diet Flags ===');
  console.log(`Date:   ${new Date().toISOString()}`);
  console.log(`Mode:   ${args.apply ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}`);
  console.log(
    `Filter: ${
      args.ids?.length
        ? `ids=[${args.ids.length}]`
        : `where=${args.where ?? "default ('uniwersalna' OR NULL)"}`
    }${args.limit ? ` limit=${args.limit}` : ''}`,
  );

  const targetIds = await loadTargetIds(args);
  console.log(`\nTargets: ${targetIds.length} active recipe(s)\n`);
  if (targetIds.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const trueCounts = new Map<string, number>();
  let processed = 0;
  let skipped = 0;
  let totalRowsWritten = 0;

  for (const id of targetIds) {
    const ctx = await loadRecipeContext(id);
    if (!ctx) {
      console.log(`  [skip] ${id} — recipe not found`);
      skipped++;
      continue;
    }
    if (ctx.ingredientNames.length === 0) {
      console.log(`  [skip] ${id} — no non-optional ingredients`);
      skipped++;
      continue;
    }

    const results = computeDietFlags({
      ingredientNames: ctx.ingredientNames,
      nutrition: ctx.nutrition,
    });
    const rows = adaptResults(results);
    const trues = rows.filter((r) => r.value).map((r) => r.flagCode);
    for (const code of trues) trueCounts.set(code, (trueCounts.get(code) ?? 0) + 1);

    console.log(`  [${args.apply ? 'apply' : 'plan '}] ${id} | ${ctx.cuisineType ?? 'NULL'} | ${ctx.title}`);
    console.log(
      `         ingredients(${ctx.ingredientNames.length}): ${ctx.ingredientNames.slice(0, 5).join(', ')}${
        ctx.ingredientNames.length > 5 ? ' …' : ''
      }`,
    );
    console.log(`         flags-true: ${trues.join(', ') || '(none)'}`);

    if (args.apply) {
      await prisma.$transaction([
        prisma.recipeDietFlag.deleteMany({ where: { recipeId: id } }),
        prisma.recipeDietFlag.createMany({
          data: rows.map((r) => ({ recipeId: id, ...r })),
        }),
      ]);
    }

    processed++;
    totalRowsWritten += rows.length;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Recipes processed: ${processed}`);
  console.log(`Recipes skipped:   ${skipped}`);
  console.log(`Flag rows ${args.apply ? 'written' : 'planned'}: ${totalRowsWritten}`);
  console.log(`Per-flag TRUE counts:`);
  for (const [code, n] of [...trueCounts.entries()].sort()) {
    console.log(`  ${code.padEnd(20)} ${n}`);
  }
  if (!args.apply) console.log('\n(dry-run — re-run with --apply to write)');
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
