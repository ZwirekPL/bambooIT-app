/**
 * Recipe Database Cleanup Script
 *
 * Tasks:
 *   1. Normalize category values (case, Polish→English canonical)
 *   2. Recompute missing RecipeNutritionSnapshots
 *   3. Verify GPT enrichment quality (steps, ingredient matching)
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/recipe-cleanup.ts
 */

import { prisma } from '../packages/database/dist/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. NORMALIZE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_CATEGORIES = [
  'main', 'soup', 'salad', 'dessert', 'other',
  'breakfast', 'drink', 'snack', 'side_dish',
];

const CATEGORY_MAP: Record<string, string> = {
  // ─── Direct canonical ───
  'main': 'main', 'soup': 'soup', 'salad': 'salad', 'dessert': 'dessert',
  'other': 'other', 'breakfast': 'breakfast', 'drink': 'drink',
  'snack': 'snack', 'side_dish': 'side_dish',

  // ─── Polish → canonical (case-insensitive matching via lowercase key) ───
  // Main dishes
  'dania główne': 'main', 'danie główne': 'main', 'dania glowne': 'main',
  'dania mięsne': 'main', 'dania rybne': 'main',
  'dania bez mięsa': 'main', 'obiady': 'main', 'kolacje': 'main',
  'gulasze': 'main', 'casserole': 'main', 'lasagne': 'main', 'tacos': 'main',
  'makaron': 'main',

  // Soups
  'zupy': 'soup', 'zupa': 'soup', 'zupy rybne': 'soup', 'chłodniki': 'soup',

  // Salads
  'sałatki': 'salad', 'sałatka': 'salad', 'salatki': 'salad', 'salatka': 'salad',
  'sałatki i surówki': 'salad', 'surówki': 'salad',

  // Desserts
  'desery': 'dessert', 'deser': 'dessert', 'ciasta i torty': 'dessert',
  'ciasta i desery': 'dessert', 'serniki': 'dessert', 'ciasteczka': 'dessert',
  'babeczki i muffiny': 'dessert', 'naleśniki i placki': 'dessert',
  'pączki i oponki': 'dessert', 'lody domowe': 'dessert',
  'dania na słodko': 'dessert',

  // Breakfast
  'śniadania': 'breakfast', 'śniadanie': 'breakfast',
  'sniadania': 'breakfast', 'sniadanie': 'breakfast',

  // Drinks
  'napoje': 'drink', 'napój': 'drink', 'napoj': 'drink',
  'napoje i koktajle': 'drink', 'drinki i nalewki': 'drink',

  // Snacks
  'przekąski': 'snack', 'przekąska': 'snack', 'przekaski': 'snack', 'przekaska': 'snack',
  'przystawki': 'snack',

  // Side dishes
  'dodatki': 'side_dish', 'dodatek': 'side_dish',
  'sosy i pasty': 'side_dish', 'do chleba': 'side_dish',
  'chleby i bułki': 'side_dish', 'przetwory': 'side_dish',

  // Tags/diet types → map to "other" (these are diet styles, not categories)
  'przepisy fit': 'main', 'wegetariańskie': 'main', 'wegańskie': 'main',
  'bezglutenowe': 'main', 'dla dzieci': 'main', 'na upały': 'main', 'paleo': 'main',

  // Ingredient-based categories → "other"
  'porady': 'other',
};

async function normalizeCategories(): Promise<number> {
  console.log('\n══════════════════════════════════════════');
  console.log('  1. NORMALIZACJA KATEGORII');
  console.log('══════════════════════════════════════════');

  const recipes = await prisma.recipe.findMany({
    where: { category: { not: null } },
    select: { id: true, category: true },
  });

  console.log(`Przepisów z kategoria != null: ${recipes.length}`);

  // Gather distinct values
  const distinct = new Map<string, number>();
  for (const r of recipes) {
    const cat = r.category!;
    distinct.set(cat, (distinct.get(cat) ?? 0) + 1);
  }

  console.log(`\nDistinct wartości kategorii (${distinct.size}):`);
  for (const [val, count] of [...distinct.entries()].sort((a, b) => b[1] - a[1])) {
    const canonical = CATEGORY_MAP[val] ?? CATEGORY_MAP[val.trim().toLowerCase()];
    const isValid = VALID_CATEGORIES.includes(val);
    const status = isValid ? '  OK' : canonical ? ` → ${canonical}` : ' ??? UNMAPPED';
    console.log(`  "${val}" × ${count}${status}`);
  }

  // Fix
  let updated = 0;
  const unmapped = new Map<string, number>();

  for (const r of recipes) {
    const raw = r.category!;

    // Already canonical lowercase
    if (VALID_CATEGORIES.includes(raw)) continue;

    // Try exact match first, then lowercase
    const mapped = CATEGORY_MAP[raw] ?? CATEGORY_MAP[raw.trim().toLowerCase()];

    if (mapped) {
      await prisma.recipe.update({
        where: { id: r.id },
        data: { category: mapped },
      });
      updated++;
    } else {
      unmapped.set(raw, (unmapped.get(raw) ?? 0) + 1);
    }
  }

  console.log(`\nZaktualizowano: ${updated}`);
  if (unmapped.size > 0) {
    console.log('Niezmapowane (ustawiam "other"):');
    for (const [val, count] of unmapped) {
      console.log(`  "${val}" × ${count} → other`);
      await prisma.recipe.updateMany({
        where: { category: val },
        data: { category: 'other' },
      });
      updated += count;
    }
  }

  // Fix null categories — set based on mealType
  const nullCategory = await prisma.recipe.findMany({
    where: { category: null },
    select: { id: true, mealType: true },
  });

  if (nullCategory.length > 0) {
    console.log(`\nPrzepisy z category=null: ${nullCategory.length} — uzupełniam z mealType`);
    const mealTypeToCategory: Record<string, string> = {
      BREAKFAST: 'breakfast',
      SECOND_BREAKFAST: 'snack',
      LUNCH: 'main',
      DINNER: 'main',
      SUPPER: 'main',
      SNACK: 'snack',
      DESSERT: 'dessert',
      DRINK: 'drink',
      SAUCE: 'side_dish',
      SIDE_DISH: 'side_dish',
    };

    for (const r of nullCategory) {
      const cat = mealTypeToCategory[r.mealType] ?? 'other';
      await prisma.recipe.update({
        where: { id: r.id },
        data: { category: cat },
      });
      updated++;
    }
  }

  return updated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Recompute nutrition snapshot for a single recipe (self-contained)
// ═══════════════════════════════════════════════════════════════════════════════

const cleanToSnapshotMap: Record<string, string> = {
  kcalPer100g: 'kcal', proteinPer100g: 'protein_g', fatPer100g: 'fat_g',
  saturatedFatPer100g: 'saturatedFat_g', carbsPer100g: 'carbs_g',
  sugarsPer100g: 'sugars_g', fiberPer100g: 'fiber_g', saltPer100g: 'salt_g',
  monounsaturatedFatPer100g: 'monounsaturatedFat_g', polyunsaturatedFatPer100g: 'polyunsaturatedFat_g',
  transFatPer100g: 'transFat_g', omega3Per100g: 'omega3_g', omega6Per100g: 'omega6_g',
  epaPer100g: 'epa_g', dhaPer100g: 'dha_g', alaPer100g: 'ala_g',
  starchPer100g: 'starch_g', addedSugarsPer100g: 'addedSugars_g',
  sodiumMg: 'sodium_mg', potassiumMg: 'potassium_mg', calciumMg: 'calcium_mg',
  magnesiumMg: 'magnesium_mg', phosphorusMg: 'phosphorus_mg', ironMg: 'iron_mg',
  zincMg: 'zinc_mg', copperMg: 'copper_mg', manganeseMg: 'manganese_mg',
  iodineUg: 'iodine_ug', seleniumUg: 'selenium_ug', chromiumUg: 'chromium_ug',
  molybdenumUg: 'molybdenum_ug', fluorideUg: 'fluoride_ug', chlorideMg: 'chloride_mg',
  vitaminAUg: 'vitaminA_ug', vitaminDUg: 'vitaminD_ug', vitaminEMg: 'vitaminE_mg',
  vitaminKUg: 'vitaminK_ug', vitaminCMg: 'vitaminC_mg', vitaminB1Mg: 'vitaminB1_mg',
  vitaminB2Mg: 'vitaminB2_mg', vitaminB3Mg: 'vitaminB3_mg', vitaminB5Mg: 'vitaminB5_mg',
  vitaminB6Mg: 'vitaminB6_mg', folateUg: 'folate_ug', vitaminB12Ug: 'vitaminB12_ug',
  biotinUg: 'biotin_ug', cholineMg: 'choline_mg', cholesterolMg: 'cholesterol_mg',
};

const nutrientFields = Object.values(cleanToSnapshotMap);

async function recomputeSingleRecipe(recipeId: string): Promise<void> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        include: {
          foodProduct: { include: { nutrients: true } },
          cleanProduct: { include: { nutrients: true } },
        },
      },
    },
  });
  if (!recipe) return;

  const servings = recipe.servings || 1;
  const totals: Record<string, number> = {};

  for (const ing of recipe.ingredients) {
    const grams = Number(ing.grams);
    const retentionFactor = ing.retentionFactor ? Number(ing.retentionFactor) : 1.0;
    const factor = (grams * retentionFactor) / 100;

    if (ing.cleanProduct?.nutrients) {
      const n = ing.cleanProduct.nutrients as unknown as Record<string, number | null>;
      for (const [cleanField, snapField] of Object.entries(cleanToSnapshotMap)) {
        const val = n[cleanField];
        if (val != null) totals[snapField] = (totals[snapField] ?? 0) + Number(val) * factor;
      }
    } else if (ing.foodProduct?.nutrients) {
      const n = ing.foodProduct.nutrients as unknown as Record<string, number | null>;
      for (const f of nutrientFields) {
        const val = n[f];
        if (val != null) totals[f] = (totals[f] ?? 0) + Number(val) * factor;
      }
    }
  }

  const opt = (f: string) => totals[f] !== undefined ? totals[f] / servings : undefined;
  const data: Record<string, unknown> = {
    kcal: opt('kcal') ?? 0, protein_g: opt('protein_g') ?? 0,
    fat_g: opt('fat_g') ?? 0, carbs_g: opt('carbs_g') ?? 0,
    totalKcal: totals['kcal'] ?? 0, totalProtein_g: totals['protein_g'] ?? 0,
    totalFat_g: totals['fat_g'] ?? 0, totalCarbs_g: totals['carbs_g'] ?? 0,
  };
  for (const f of nutrientFields) {
    if (!['kcal', 'protein_g', 'fat_g', 'carbs_g'].includes(f)) {
      data[f] = opt(f);
    }
  }

  await prisma.recipeNutritionSnapshot.upsert({
    where: { recipeId },
    create: { recipeId, ...data } as never,
    update: { computedAt: new Date(), ...data } as never,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. RECOMPUTE MISSING NUTRITION SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════════

async function recomputeSnapshots(): Promise<number> {
  console.log('\n══════════════════════════════════════════');
  console.log('  2. PRZELICZANIE BRAKUJĄCYCH SNAPSHOTÓW');
  console.log('══════════════════════════════════════════');

  // Find recipes without snapshot
  const missingSnapshot = await prisma.recipe.findMany({
    where: {
      isActive: true,
      nutritionSnapshot: null,
      ingredients: { some: {} }, // has at least one ingredient
    },
    select: { id: true, title: true },
  });

  console.log(`Aktywne przepisy bez snapshot (z >= 1 składnikiem): ${missingSnapshot.length}`);

  // Also find stale snapshots (older than ingredients update)
  const staleSnapshot = await prisma.$queryRaw<Array<{ id: string; title: string }>>`
    SELECT r.id, r.title
    FROM "Recipe" r
    JOIN "RecipeNutritionSnapshot" rns ON rns."recipeId" = r.id
    WHERE r."isActive" = true
      AND rns."computedAt" < r."updatedAt"
    LIMIT 500
  `;

  console.log(`Aktywne przepisy ze starym snapshot: ${staleSnapshot.length}`);

  const toProcess = [
    ...missingSnapshot.map(r => ({ ...r, reason: 'missing' })),
    ...staleSnapshot.map(r => ({ ...r, reason: 'stale' })),
  ];

  if (toProcess.length === 0) {
    console.log('Wszystkie snapshoty aktualne!');
    return 0;
  }

  let computed = 0;
  let errors = 0;

  for (const recipe of toProcess) {
    try {
      // Recompute via admin API endpoint logic (inline)
      await recomputeSingleRecipe(recipe.id);
      computed++;
      if (computed % 100 === 0) {
        console.log(`  ... przeliczono ${computed}/${toProcess.length}`);
      }
    } catch (err) {
      errors++;
      console.error(`  Błąd dla "${recipe.title}" (${recipe.id}): ${(err as Error).message}`);
    }
  }

  console.log(`\nPrzeliczono: ${computed}, Błędów: ${errors}`);
  return computed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. VERIFY GPT ENRICHMENT QUALITY
// ═══════════════════════════════════════════════════════════════════════════════

async function verifyQuality(): Promise<void> {
  console.log('\n══════════════════════════════════════════');
  console.log('  3. WERYFIKACJA JAKOŚCI DANYCH');
  console.log('══════════════════════════════════════════');

  const totalRecipes = await prisma.recipe.count({ where: { isActive: true } });
  console.log(`\nAktywnych przepisów: ${totalRecipes}`);

  // 3a. Recipes without any instruction steps
  const noSteps = await prisma.recipe.count({
    where: {
      isActive: true,
      instructionSteps: { none: {} },
    },
  });
  console.log(`\nBez kroków przygotowania: ${noSteps} (${pct(noSteps, totalRecipes)})`);

  // 3b. Recipes without any ingredients
  const noIngredients = await prisma.recipe.count({
    where: {
      isActive: true,
      ingredients: { none: {} },
    },
  });
  console.log(`Bez składników: ${noIngredients} (${pct(noIngredients, totalRecipes)})`);

  // 3c. Ingredients without cleanProduct match (unmatched)
  const totalIngredients = await prisma.recipeIngredient.count({
    where: { recipe: { isActive: true } },
  });
  const unmatchedIngredients = await prisma.recipeIngredient.count({
    where: {
      recipe: { isActive: true },
      cleanProductId: null,
      foodProductId: null,
    },
  });
  console.log(`\nSkładników łącznie: ${totalIngredients}`);
  console.log(`Bez dopasowanego produktu: ${unmatchedIngredients} (${pct(unmatchedIngredients, totalIngredients)})`);

  // 3d. Recipes with 0 kcal snapshot (likely computation error)
  const zeroKcal = await prisma.recipeNutritionSnapshot.count({
    where: {
      recipe: { isActive: true },
      kcal: { lte: 0 },
    },
  });
  console.log(`\nSnapshoty z kcal=0: ${zeroKcal}`);

  // 3e. Recipes with suspiciously high/low kcal
  const extremeKcal = await prisma.recipeNutritionSnapshot.count({
    where: {
      recipe: { isActive: true },
      OR: [
        { kcal: { gt: 2000 } }, // >2000 kcal per serving is suspicious
        { kcal: { lt: 20, gt: 0 } }, // <20 kcal per serving is suspicious
      ],
    },
  });
  console.log(`Snapshoty z ekstremalnym kcal (>2000 lub <20): ${extremeKcal}`);

  // 3f. Category distribution
  console.log('\nRozkład kategorii:');
  const catDist = await prisma.recipe.groupBy({
    by: ['category'],
    where: { isActive: true },
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });
  for (const row of catDist) {
    console.log(`  ${row.category ?? '(null)'}: ${row._count} (${pct(row._count, totalRecipes)})`);
  }

  // 3g. MealType distribution
  console.log('\nRozkład mealType:');
  const mealDist = await prisma.recipe.groupBy({
    by: ['mealType'],
    where: { isActive: true },
    _count: true,
    orderBy: { _count: { mealType: 'desc' } },
  });
  for (const row of mealDist) {
    console.log(`  ${row.mealType}: ${row._count} (${pct(row._count, totalRecipes)})`);
  }

  // 3h. Verification status
  console.log('\nStatus weryfikacji:');
  const verDist = await prisma.recipe.groupBy({
    by: ['verificationStatus'],
    where: { isActive: true },
    _count: true,
    orderBy: { _count: { verificationStatus: 'desc' } },
  });
  for (const row of verDist) {
    console.log(`  ${row.verificationStatus}: ${row._count} (${pct(row._count, totalRecipes)})`);
  }

  // 3i. Source distribution
  console.log('\nRozkład source:');
  const srcDist = await prisma.recipe.groupBy({
    by: ['source'],
    where: { isActive: true },
    _count: true,
    orderBy: { _count: { source: 'desc' } },
  });
  for (const row of srcDist) {
    console.log(`  ${row.source}: ${row._count} (${pct(row._count, totalRecipes)})`);
  }

  // 3j. Quality score distribution
  const avgQuality = await prisma.recipe.aggregate({
    where: { isActive: true },
    _avg: { qualityScore: true },
    _min: { qualityScore: true },
    _max: { qualityScore: true },
  });
  console.log(`\nQuality score: avg=${avgQuality._avg.qualityScore?.toFixed(1)}, min=${avgQuality._min.qualityScore}, max=${avgQuality._max.qualityScore}`);

  // Quality buckets
  const q0 = await prisma.recipe.count({ where: { isActive: true, qualityScore: { lte: 25 } } });
  const q25 = await prisma.recipe.count({ where: { isActive: true, qualityScore: { gt: 25, lte: 50 } } });
  const q50 = await prisma.recipe.count({ where: { isActive: true, qualityScore: { gt: 50, lte: 75 } } });
  const q75 = await prisma.recipe.count({ where: { isActive: true, qualityScore: { gt: 75 } } });
  console.log(`  0-25: ${q0}, 26-50: ${q25}, 51-75: ${q50}, 76-100: ${q75}`);

  // Summary
  console.log('\n── PODSUMOWANIE ──');
  const issues: string[] = [];
  if (noSteps > 0) issues.push(`${noSteps} bez kroków`);
  if (noIngredients > 0) issues.push(`${noIngredients} bez składników`);
  if (unmatchedIngredients > 0) issues.push(`${unmatchedIngredients} niedopasowanych składników`);
  if (zeroKcal > 0) issues.push(`${zeroKcal} z kcal=0`);
  if (extremeKcal > 0) issues.push(`${extremeKcal} z ekstremalnym kcal`);

  if (issues.length === 0) {
    console.log('Brak problemów!');
  } else {
    console.log(`Znalezione problemy: ${issues.join(', ')}`);
  }
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  RECIPE DATABASE CLEANUP                 ║');
  console.log('║  ' + new Date().toISOString() + '      ║');
  console.log('╚══════════════════════════════════════════╝');

  const total = await prisma.recipe.count();
  const active = await prisma.recipe.count({ where: { isActive: true } });
  console.log(`\nŁącznie przepisów: ${total} (aktywnych: ${active})`);

  // 1. Normalize categories
  const catFixed = await normalizeCategories();

  // 2. Recompute missing snapshots
  const snapComputed = await recomputeSnapshots();

  // 3. Quality report
  await verifyQuality();

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  GOTOWE                                  ║');
  console.log(`║  Kategorie poprawione: ${String(catFixed).padStart(4)}              ║`);
  console.log(`║  Snapshoty przeliczone: ${String(snapComputed).padStart(4)}             ║`);
  console.log('╚══════════════════════════════════════════╝');
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
