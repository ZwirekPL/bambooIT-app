import { prisma } from '@db';
import type { PlanContent, PlanMeal, MealRecipe } from './planValidation.service';
import {
  getCanonicalProductNames,
  fuzzyMatchProduct,
  normalizeProductName,
  type CanonicalProduct,
  type MatchResult,
} from './productNameStandardization.service';

// ─── types ────────────────────────────────────────────────────────────────────

interface ExtractedRecipe {
  mealName: string;
  meal: PlanMeal;
  recipe: MealRecipe;
}

interface MatchedIngredient {
  productId: string;
  productName: string;
  grams: number;
  displayName: string;
}

// ─── slug helper (mirrors recipe.service.ts) ─────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  const existing = await prisma.recipe.findUnique({ where: { slug } });
  if (!existing) return slug;
  let i = 2;
  while (await prisma.recipe.findUnique({ where: { slug: `${slug}-${i}` } })) {
    i++;
  }
  return `${slug}-${i}`;
}

// ─── meal type mapping ───────────────────────────────────────────────────────

const MEAL_TYPE_MAP: Record<string, string> = {
  'śniadanie': 'BREAKFAST',
  'breakfast': 'BREAKFAST',
  'ii śniadanie': 'SECOND_BREAKFAST',
  'drugie śniadanie': 'SECOND_BREAKFAST',
  'second breakfast': 'SECOND_BREAKFAST',
  'obiad': 'LUNCH',
  'lunch': 'LUNCH',
  'kolacja': 'DINNER',
  'dinner': 'DINNER',
  'przekąska': 'SNACK',
  'snack': 'SNACK',
  'podwieczorek': 'SNACK',
  'supper': 'SUPPER',
};

function inferMealType(mealName: string): string {
  const lower = mealName.toLowerCase().trim();
  return MEAL_TYPE_MAP[lower] ?? 'LUNCH';
}

// ─── deduplication ───────────────────────────────────────────────────────────

/**
 * Check if a recipe already exists in the DB by slug or normalized title.
 * Uses both exact slug match and fuzzy title comparison.
 */
async function recipeExists(mealName: string): Promise<boolean> {
  const baseSlug = slugify(mealName);

  // 1. Exact slug match
  const bySlug = await prisma.recipe.findUnique({ where: { slug: baseSlug } });
  if (bySlug) return true;

  // 2. Fuzzy title match — find recipes with similar titles
  const normalized = normalizeProductName(mealName);
  const candidates = await prisma.recipe.findMany({
    where: {
      title: { contains: mealName.split(' ')[0], mode: 'insensitive' },
    },
    select: { title: true },
    take: 20,
  });

  for (const c of candidates) {
    const candidateNorm = normalizeProductName(c.title);
    if (candidateNorm === normalized) return true;
    // Check if one contains the other (e.g. "Owsianka z bananem" vs "Owsianka z bananem i miodem")
    if (candidateNorm.includes(normalized) || normalized.includes(candidateNorm)) {
      // Only consider it a match if overlap is significant (>80%)
      const shorter = Math.min(candidateNorm.length, normalized.length);
      const longer = Math.max(candidateNorm.length, normalized.length);
      if (shorter / longer >= 0.8) return true;
    }
  }

  return false;
}

// ─── ingredient matching ────────────────────────────────────────────────────

/**
 * Match meal items to FoodProduct entries in the database.
 * Uses the existing fuzzy matching from productNameStandardization.
 */
function matchIngredients(
  meal: PlanMeal,
  canonicalProducts: CanonicalProduct[],
  matchCache: Map<string, MatchResult>,
): MatchedIngredient[] {
  const matched: MatchedIngredient[] = [];
  const seen = new Set<string>(); // avoid duplicate ingredients

  for (const item of meal.items) {
    // If the item has explicit ingredients array (24.7), use those
    const sources = item.ingredients?.length
      ? item.ingredients.map(ing => ({ name: ing.name, grams: ing.grams }))
      : [{ name: item.name, grams: item.grams }];

    for (const source of sources) {
      const cacheKey = normalizeProductName(source.name);
      if (seen.has(cacheKey)) continue;

      let result = matchCache.get(cacheKey);
      if (!result) {
        result = fuzzyMatchProduct(source.name, canonicalProducts);
        matchCache.set(cacheKey, result);
      }

      if (result.productId && result.confidence >= 0.5) {
        seen.add(cacheKey);
        matched.push({
          productId: result.productId,
          productName: result.canonicalName!,
          grams: source.grams || 100,
          displayName: source.name,
        });
      }
    }
  }

  return matched;
}

// ─── extract recipes from plan content ───────────────────────────────────────

function extractRecipesFromContent(content: PlanContent): ExtractedRecipe[] {
  const recipes: ExtractedRecipe[] = [];
  const seenNames = new Set<string>();

  for (const day of content.days ?? []) {
    for (const meal of day.meals ?? []) {
      if (!meal.recipe?.steps?.length) continue;

      // Deduplicate by meal name within this plan
      const key = meal.name.toLowerCase().trim();
      if (seenNames.has(key)) continue;
      seenNames.add(key);

      recipes.push({ mealName: meal.name, meal, recipe: meal.recipe });
    }
  }

  return recipes;
}

// ─── compute macros from items ──────────────────────────────────────────────

function computeMealMacros(meal: PlanMeal): { kcal: number; protein: number; fat: number; carbs: number } {
  let kcal = 0, protein = 0, fat = 0, carbs = 0;
  for (const item of meal.items) {
    kcal += item.kcal || 0;
    protein += item.protein || 0;
    fat += item.fat || 0;
    carbs += item.carbs || 0;
  }
  return { kcal, protein, fat, carbs };
}

// ─── save extracted recipes to DB ────────────────────────────────────────────

/**
 * Extract recipes from diet plan content and save new ones to the Recipe table.
 * Includes ingredients (matched to FoodProduct), instruction steps, and nutrition snapshot.
 * Skips recipes that already exist (by slug or fuzzy title match).
 * Fire-and-forget — caller should catch errors.
 *
 * @returns number of newly created recipes
 */
export async function saveRecipesFromPlan(
  content: PlanContent,
  dietPlanId: string,
): Promise<number> {
  const extracted = extractRecipesFromContent(content);
  if (extracted.length === 0) return 0;

  // Load canonical product names once for all recipes
  const canonicalProducts = await getCanonicalProductNames();
  const matchCache = new Map<string, MatchResult>();

  let created = 0;

  for (const { mealName, meal, recipe } of extracted) {
    // Check for duplicate recipes (slug + fuzzy title)
    const exists = await recipeExists(mealName);
    if (exists) {
      console.log(`[recipe-extract] Skipping duplicate: "${mealName}"`);
      continue;
    }

    const slug = await uniqueSlug(mealName);

    // Match ingredients to FoodProduct entries
    const ingredients = matchIngredients(meal, canonicalProducts, matchCache);

    // Compute macros from plan items
    const macros = computeMealMacros(meal);

    // Compute total grams for servingWeightG
    const totalGrams = meal.items.reduce((sum, item) => sum + (item.grams || 0), 0);

    // Use plan ID + slug as unique sourceId to avoid constraint violations
    const recipeSourceId = `${dietPlanId}:${slug}`;

    await prisma.recipe.upsert({
      where: { source_sourceId: { source: 'ai_generated', sourceId: recipeSourceId } },
      update: {
        prepTimeMinutes: recipe.prepTimeMin,
        totalTimeMinutes: recipe.prepTimeMin,
        servingWeightG: totalGrams > 0 ? totalGrams : undefined,
        tips: recipe.tips,
      },
      create: {
        source: 'ai_generated',
        sourceId: recipeSourceId,
        title: mealName,
        slug,
        mealType: inferMealType(mealName) as Parameters<typeof prisma.recipe.create>[0]['data']['mealType'],
        difficulty: 'EASY',
        prepTimeMinutes: recipe.prepTimeMin,
        totalTimeMinutes: recipe.prepTimeMin,
        servings: 1,
        servingWeightG: totalGrams > 0 ? totalGrams : undefined,
        tips: recipe.tips,
        tags: ['ai-generated'],
        qualityScore: 50,
        verificationStatus: 'UNVERIFIED',
        instructionSteps: {
          create: recipe.steps.map((instruction, idx) => ({
            stepNumber: idx + 1,
            instruction,
          })),
        },
        // Create ingredients linked to CleanProduct
        ...(ingredients.length > 0 ? {
          ingredients: {
            create: ingredients.map((ing, idx) => ({
              cleanProductId: ing.productId,
              sortOrder: idx,
              quantity: ing.grams,
              unit: 'g',
              grams: ing.grams,
              displayName: ing.displayName,
            })),
          },
        } : {}),
        // Create nutrition snapshot from plan macros
        ...(macros.kcal > 0 ? {
          nutritionSnapshot: {
            create: {
              kcal: macros.kcal,
              protein_g: macros.protein,
              fat_g: macros.fat,
              carbs_g: macros.carbs,
              totalKcal: macros.kcal,
              totalProtein_g: macros.protein,
              totalFat_g: macros.fat,
              totalCarbs_g: macros.carbs,
            },
          },
        } : {}),
      },
    });

    const ingredientInfo = ingredients.length > 0
      ? `${ingredients.length} ingredients matched`
      : 'no ingredients matched';
    console.log(`[recipe-extract] Created: "${mealName}" (${ingredientInfo}, ${Math.round(macros.kcal)} kcal)`);
    created++;
  }

  if (created > 0) {
    console.log(`[recipe-extract] Total: ${created} new recipes from plan ${dietPlanId}`);
  }

  return created;
}
