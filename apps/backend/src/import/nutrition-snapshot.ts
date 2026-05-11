/**
 * Recipe Nutrition Snapshot Calculator
 *
 * Computes per-serving and total nutrition values for a recipe
 * based on its ingredients and their nutrient data.
 * Also aggregates allergens and diet flags from ingredients.
 *
 * Supports both legacy FoodProduct and new CleanProduct ingredients.
 * CleanProduct is preferred when both are present.
 */

import { prisma, Prisma } from '@db';

// Field mapping from CleanProductNutrients (per100g) → snapshot field names
const cleanToSnapshotMap: Record<string, string> = {
  // Macros
  kcalPer100g: 'kcal',
  proteinPer100g: 'protein_g',
  fatPer100g: 'fat_g',
  saturatedFatPer100g: 'saturatedFat_g',
  carbsPer100g: 'carbs_g',
  sugarsPer100g: 'sugars_g',
  fiberPer100g: 'fiber_g',
  saltPer100g: 'salt_g',
  // Fat fractions (26.B)
  monounsaturatedFatPer100g: 'monounsaturatedFat_g',
  polyunsaturatedFatPer100g: 'polyunsaturatedFat_g',
  transFatPer100g: 'transFat_g',
  omega3Per100g: 'omega3_g',
  omega6Per100g: 'omega6_g',
  epaPer100g: 'epa_g',
  dhaPer100g: 'dha_g',
  alaPer100g: 'ala_g',
  // Carb fractions (26.C)
  starchPer100g: 'starch_g',
  addedSugarsPer100g: 'addedSugars_g',
  // Minerals
  sodiumMg: 'sodium_mg',
  potassiumMg: 'potassium_mg',
  calciumMg: 'calcium_mg',
  magnesiumMg: 'magnesium_mg',
  phosphorusMg: 'phosphorus_mg',
  ironMg: 'iron_mg',
  zincMg: 'zinc_mg',
  copperMg: 'copper_mg',
  manganeseMg: 'manganese_mg',
  iodineUg: 'iodine_ug',
  seleniumUg: 'selenium_ug',
  chromiumUg: 'chromium_ug',
  molybdenumUg: 'molybdenum_ug',
  fluorideUg: 'fluoride_ug',
  chlorideMg: 'chloride_mg',
  // Fat-soluble vitamins
  vitaminAUg: 'vitaminA_ug',
  vitaminDUg: 'vitaminD_ug',
  vitaminEMg: 'vitaminE_mg',
  vitaminKUg: 'vitaminK_ug',
  // Water-soluble vitamins
  vitaminCMg: 'vitaminC_mg',
  vitaminB1Mg: 'vitaminB1_mg',
  vitaminB2Mg: 'vitaminB2_mg',
  vitaminB3Mg: 'vitaminB3_mg',
  vitaminB5Mg: 'vitaminB5_mg',
  vitaminB6Mg: 'vitaminB6_mg',
  folateUg: 'folate_ug',
  vitaminB12Ug: 'vitaminB12_ug',
  biotinUg: 'biotin_ug',
  cholineMg: 'choline_mg',
  // Other
  cholesterolMg: 'cholesterol_mg',
};

const nutrientFields = [
  // Macros
  'kcal', 'protein_g', 'fat_g', 'saturatedFat_g', 'carbs_g',
  'sugars_g', 'fiber_g', 'salt_g',
  // Fat fractions
  'monounsaturatedFat_g', 'polyunsaturatedFat_g', 'transFat_g',
  'omega3_g', 'omega6_g', 'epa_g', 'dha_g', 'ala_g',
  // Carb fractions
  'starch_g', 'addedSugars_g',
  // Minerals
  'sodium_mg', 'potassium_mg', 'calcium_mg', 'magnesium_mg', 'phosphorus_mg',
  'iron_mg', 'zinc_mg', 'copper_mg', 'manganese_mg',
  'iodine_ug', 'selenium_ug', 'chromium_ug', 'molybdenum_ug', 'fluoride_ug', 'chloride_mg',
  // Vitamins
  'vitaminA_ug', 'vitaminD_ug', 'vitaminE_mg', 'vitaminK_ug',
  'vitaminC_mg', 'vitaminB1_mg', 'vitaminB2_mg', 'vitaminB3_mg', 'vitaminB5_mg', 'vitaminB6_mg',
  'folate_ug', 'vitaminB12_ug', 'biotin_ug', 'choline_mg',
  // Other
  'cholesterol_mg',
];

// ─── Compute nutrition snapshot for a recipe ─────────────────────────────────

export async function computeNutritionSnapshot(recipeId: string): Promise<void> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        include: {
          foodProduct: {
            include: { nutrients: true },
          },
          cleanProduct: {
            include: { nutrients: true },
          },
        },
      },
    },
  });

  if (!recipe) return;

  const servings = recipe.servings || 1;

  // Accumulate totals from all ingredients
  const totals: Record<string, number> = {};

  for (const ing of recipe.ingredients) {
    const grams = Number(ing.grams);
    const retentionFactor = ing.retentionFactor ? Number(ing.retentionFactor) : 1.0;
    const effectiveGrams = grams * retentionFactor;
    const factor = effectiveGrams / 100; // nutrients are per 100g

    // Prefer cleanProduct nutrients, fallback to foodProduct
    if (ing.cleanProduct?.nutrients) {
      const n = ing.cleanProduct.nutrients as unknown as Record<string, Prisma.Decimal | null>;
      for (const [cleanField, snapshotField] of Object.entries(cleanToSnapshotMap)) {
        const value = n[cleanField];
        if (value !== null && value !== undefined) {
          totals[snapshotField] = (totals[snapshotField] ?? 0) + Number(value) * factor;
        }
      }
    } else if (ing.foodProduct?.nutrients) {
      for (const field of nutrientFields) {
        const value = (ing.foodProduct.nutrients as unknown as Record<string, Prisma.Decimal | null>)[field];
        if (value !== null && value !== undefined) {
          totals[field] = (totals[field] ?? 0) + Number(value) * factor;
        }
      }
    }
  }

  // Per serving
  const perServing: Record<string, number | undefined> = {};
  for (const field of nutrientFields) {
    perServing[field] = totals[field] !== undefined ? totals[field] / servings : undefined;
  }

  // Upsert snapshot — build dynamically from nutrientFields
  const opt = (field: string) => perServing[field] as number | undefined;

  const snapshotData = {
    // Required fields
    kcal: perServing['kcal'] ?? 0,
    protein_g: perServing['protein_g'] ?? 0,
    fat_g: perServing['fat_g'] ?? 0,
    carbs_g: perServing['carbs_g'] ?? 0,
    // Optional macros
    saturatedFat_g: opt('saturatedFat_g'),
    sugars_g: opt('sugars_g'),
    fiber_g: opt('fiber_g'),
    salt_g: opt('salt_g'),
    // Fat fractions
    monounsaturatedFat_g: opt('monounsaturatedFat_g'),
    polyunsaturatedFat_g: opt('polyunsaturatedFat_g'),
    transFat_g: opt('transFat_g'),
    omega3_g: opt('omega3_g'),
    omega6_g: opt('omega6_g'),
    epa_g: opt('epa_g'),
    dha_g: opt('dha_g'),
    ala_g: opt('ala_g'),
    // Carb fractions
    starch_g: opt('starch_g'),
    addedSugars_g: opt('addedSugars_g'),
    // Minerals
    sodium_mg: opt('sodium_mg'),
    potassium_mg: opt('potassium_mg'),
    calcium_mg: opt('calcium_mg'),
    magnesium_mg: opt('magnesium_mg'),
    phosphorus_mg: opt('phosphorus_mg'),
    iron_mg: opt('iron_mg'),
    zinc_mg: opt('zinc_mg'),
    copper_mg: opt('copper_mg'),
    manganese_mg: opt('manganese_mg'),
    iodine_ug: opt('iodine_ug'),
    selenium_ug: opt('selenium_ug'),
    chromium_ug: opt('chromium_ug'),
    molybdenum_ug: opt('molybdenum_ug'),
    fluoride_ug: opt('fluoride_ug'),
    chloride_mg: opt('chloride_mg'),
    // Fat-soluble vitamins
    vitaminA_ug: opt('vitaminA_ug'),
    vitaminD_ug: opt('vitaminD_ug'),
    vitaminE_mg: opt('vitaminE_mg'),
    vitaminK_ug: opt('vitaminK_ug'),
    // Water-soluble vitamins
    vitaminC_mg: opt('vitaminC_mg'),
    vitaminB1_mg: opt('vitaminB1_mg'),
    vitaminB2_mg: opt('vitaminB2_mg'),
    vitaminB3_mg: opt('vitaminB3_mg'),
    vitaminB5_mg: opt('vitaminB5_mg'),
    vitaminB6_mg: opt('vitaminB6_mg'),
    folate_ug: opt('folate_ug'),
    vitaminB12_ug: opt('vitaminB12_ug'),
    biotin_ug: opt('biotin_ug'),
    choline_mg: opt('choline_mg'),
    // Other
    cholesterol_mg: opt('cholesterol_mg'),
    // Totals
    totalKcal: totals['kcal'] ?? 0,
    totalProtein_g: totals['protein_g'] ?? 0,
    totalFat_g: totals['fat_g'] ?? 0,
    totalCarbs_g: totals['carbs_g'] ?? 0,
  };

  await prisma.recipeNutritionSnapshot.upsert({
    where: { recipeId },
    create: { recipeId, ...snapshotData },
    update: { computedAt: new Date(), ...snapshotData },
  });
}

// ─── Helper: get allergens from an ingredient ────────────────────────────────

interface AllergenEntry {
  allergenCode: string;
  presence: string;
}

function getIngredientAllergens(ing: {
  foodProduct?: { allergens: AllergenEntry[] } | null;
  cleanProduct?: { allergens: AllergenEntry[] } | null;
}): AllergenEntry[] {
  // Prefer cleanProduct, fallback to foodProduct
  if (ing.cleanProduct?.allergens?.length) return ing.cleanProduct.allergens;
  if (ing.foodProduct?.allergens?.length) return ing.foodProduct.allergens;
  return [];
}

// ─── Aggregate allergens from ingredients ────────────────────────────────────

export async function computeRecipeAllergens(recipeId: string): Promise<void> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        include: {
          foodProduct: {
            include: { allergens: true },
          },
          cleanProduct: {
            include: { allergens: true },
          },
        },
      },
    },
  });

  if (!recipe) return;

  // Collect all allergens from ingredients
  const allergenMap = new Map<string, 'CONTAINS' | 'MAY_CONTAIN'>();

  for (const ing of recipe.ingredients) {
    if (ing.isOptional) continue;

    for (const allergen of getIngredientAllergens(ing)) {
      if (allergen.presence === 'CONTAINS') {
        allergenMap.set(allergen.allergenCode, 'CONTAINS');
      } else if (allergen.presence === 'MAY_CONTAIN') {
        if (!allergenMap.has(allergen.allergenCode)) {
          allergenMap.set(allergen.allergenCode, 'MAY_CONTAIN');
        }
      }
    }
  }

  // Optional ingredients contribute MAY_CONTAIN
  for (const ing of recipe.ingredients) {
    if (!ing.isOptional) continue;
    for (const allergen of getIngredientAllergens(ing)) {
      if (allergen.presence === 'CONTAINS' || allergen.presence === 'MAY_CONTAIN') {
        if (!allergenMap.has(allergen.allergenCode)) {
          allergenMap.set(allergen.allergenCode, 'MAY_CONTAIN');
        }
      }
    }
  }

  // Delete old allergens and insert new
  await prisma.recipeAllergen.deleteMany({ where: { recipeId } });

  if (allergenMap.size > 0) {
    await prisma.recipeAllergen.createMany({
      data: Array.from(allergenMap.entries()).map(([code, presence]) => ({
        recipeId,
        allergenCode: code,
        presence,
      })),
    });
  }
}

// ─── Helper: get diet flags from an ingredient ──────────────────────────────

interface DietFlagEntry {
  flagCode: string;
  value: boolean;
  confidence: number;
}

function getIngredientDietFlags(ing: {
  foodProduct?: { dietFlags: DietFlagEntry[] } | null;
  cleanProduct?: { dietFlags: DietFlagEntry[] } | null;
}): DietFlagEntry[] {
  if (ing.cleanProduct?.dietFlags?.length) return ing.cleanProduct.dietFlags;
  if (ing.foodProduct?.dietFlags?.length) return ing.foodProduct.dietFlags;
  return [];
}

// ─── Aggregate diet flags from ingredients ───────────────────────────────────

export async function computeRecipeDietFlags(recipeId: string): Promise<void> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        where: { isOptional: false },
        include: {
          foodProduct: {
            include: { dietFlags: true },
          },
          cleanProduct: {
            include: { dietFlags: true },
          },
        },
      },
    },
  });

  if (!recipe || recipe.ingredients.length === 0) return;

  // A recipe flag is true only if ALL required ingredients have that flag as true
  const flagCodes = [
    'vegetarian', 'vegan', 'pescatarian', 'glutenFree', 'lactoseFree',
    'ketoCompatible', 'diabeticFriendly',
  ];

  const flagResults: Array<{ flagCode: string; value: boolean; confidence: number }> = [];

  for (const code of flagCodes) {
    let allTrue = true;
    let totalConfidence = 0;
    let count = 0;

    for (const ing of recipe.ingredients) {
      const flags = getIngredientDietFlags(ing);
      const flag = flags.find(f => f.flagCode === code);
      if (!flag || !flag.value) {
        allTrue = false;
        break;
      }
      totalConfidence += flag.confidence;
      count++;
    }

    if (count > 0) {
      flagResults.push({
        flagCode: code,
        value: allTrue,
        confidence: allTrue ? Math.round(totalConfidence / count) : 90,
      });
    }
  }

  // Delete old flags and insert new
  await prisma.recipeDietFlag.deleteMany({ where: { recipeId } });

  if (flagResults.length > 0) {
    await prisma.recipeDietFlag.createMany({
      data: flagResults.map(f => ({
        recipeId,
        flagCode: f.flagCode,
        value: f.value,
        source: 'AUTO_RULE' as const,
        confidence: f.confidence,
      })),
    });
  }
}

// ─── Full computation (snapshot + allergens + flags) ──────────────────────────

export async function computeFullRecipeData(recipeId: string): Promise<void> {
  await computeNutritionSnapshot(recipeId);
  await computeRecipeAllergens(recipeId);
  await computeRecipeDietFlags(recipeId);
}
