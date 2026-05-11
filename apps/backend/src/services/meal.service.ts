import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

// ─── types ────────────────────────────────────────────────────────────────────

export type MealTypeValue = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'SUPPER';
export type DietTypeValue = 'STANDARD' | 'VEGE' | 'VEGAN' | 'GLUTEN_FREE' | 'LACTOSE_FREE';

export interface CreateMealInput {
  name: string;
  description?: string;
  mealType: MealTypeValue;
  dietType?: DietTypeValue;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  hasGluten?: boolean;
  hasLactose?: boolean;
  hasNuts?: boolean;
  hasSoy?: boolean;
  hasEggs?: boolean;
  hasFish?: boolean;
  tags?: string[];
  recipeId?: string;
  source?: string;
}

export interface UpdateMealInput {
  name?: string;
  description?: string;
  mealType?: MealTypeValue;
  dietType?: DietTypeValue;
  kcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  hasGluten?: boolean;
  hasLactose?: boolean;
  hasNuts?: boolean;
  hasSoy?: boolean;
  hasEggs?: boolean;
  hasFish?: boolean;
  tags?: string[];
  recipeId?: string | null;
  isActive?: boolean;
}

export interface ListMealsOptions {
  page: number;
  limit: number;
  search?: string;
  mealType?: MealTypeValue;
  dietType?: DietTypeValue;
  maxKcal?: number;
  minKcal?: number;
  excludeGluten?: boolean;
  excludeLactose?: boolean;
  excludeNuts?: boolean;
  excludeSoy?: boolean;
  excludeEggs?: boolean;
  excludeFish?: boolean;
  isActive?: boolean;
}

// ─── select ───────────────────────────────────────────────────────────────────

const mealSelect = {
  id: true,
  name: true,
  description: true,
  mealType: true,
  dietType: true,
  kcal: true,
  proteinG: true,
  fatG: true,
  carbsG: true,
  hasGluten: true,
  hasLactose: true,
  hasNuts: true,
  hasSoy: true,
  hasEggs: true,
  hasFish: true,
  tags: true,
  isActive: true,
  source: true,
  recipeId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MealSelect;

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listMeals(opts: ListMealsOptions) {
  const skip = (opts.page - 1) * opts.limit;

  const where: Prisma.MealWhereInput = {
    ...(opts.isActive !== undefined ? { isActive: opts.isActive } : { isActive: true }),
    ...(opts.search ? { name: { contains: opts.search, mode: 'insensitive' } } : {}),
    ...(opts.mealType ? { mealType: opts.mealType } : {}),
    ...(opts.dietType ? { dietType: opts.dietType } : {}),
    ...(opts.minKcal !== undefined || opts.maxKcal !== undefined
      ? { kcal: { gte: opts.minKcal, lte: opts.maxKcal } }
      : {}),
    ...(opts.excludeGluten ? { hasGluten: false } : {}),
    ...(opts.excludeLactose ? { hasLactose: false } : {}),
    ...(opts.excludeNuts ? { hasNuts: false } : {}),
    ...(opts.excludeSoy ? { hasSoy: false } : {}),
    ...(opts.excludeEggs ? { hasEggs: false } : {}),
    ...(opts.excludeFish ? { hasFish: false } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.meal.findMany({
      where,
      skip,
      take: opts.limit,
      orderBy: [{ mealType: 'asc' }, { kcal: 'asc' }],
      select: mealSelect,
    }),
    prisma.meal.count({ where }),
  ]);

  return { items, total, page: opts.page, limit: opts.limit };
}

// ─── get by id ────────────────────────────────────────────────────────────────

export async function getMealById(id: string) {
  const meal = await prisma.meal.findUnique({ where: { id }, select: mealSelect });
  if (!meal) throw new AppError(404, 'NOT_FOUND', 'Meal not found');
  return meal;
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createMeal(input: CreateMealInput) {
  if (input.recipeId) {
    const recipe = await prisma.recipe.findUnique({ where: { id: input.recipeId } });
    if (!recipe) throw new AppError(400, 'VALIDATION_ERROR', 'Recipe not found');
  }

  return prisma.meal.create({
    data: {
      name: input.name,
      description: input.description,
      mealType: input.mealType,
      dietType: input.dietType ?? 'STANDARD',
      kcal: input.kcal,
      proteinG: input.proteinG,
      fatG: input.fatG,
      carbsG: input.carbsG,
      hasGluten: input.hasGluten ?? false,
      hasLactose: input.hasLactose ?? false,
      hasNuts: input.hasNuts ?? false,
      hasSoy: input.hasSoy ?? false,
      hasEggs: input.hasEggs ?? false,
      hasFish: input.hasFish ?? false,
      tags: input.tags ?? [],
      recipeId: input.recipeId,
      source: input.source ?? 'manual',
    },
    select: mealSelect,
  });
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function updateMeal(id: string, input: UpdateMealInput) {
  await getMealById(id);

  if (input.recipeId) {
    const recipe = await prisma.recipe.findUnique({ where: { id: input.recipeId } });
    if (!recipe) throw new AppError(400, 'VALIDATION_ERROR', 'Recipe not found');
  }

  return prisma.meal.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.mealType !== undefined ? { mealType: input.mealType } : {}),
      ...(input.dietType !== undefined ? { dietType: input.dietType } : {}),
      ...(input.kcal !== undefined ? { kcal: input.kcal } : {}),
      ...(input.proteinG !== undefined ? { proteinG: input.proteinG } : {}),
      ...(input.fatG !== undefined ? { fatG: input.fatG } : {}),
      ...(input.carbsG !== undefined ? { carbsG: input.carbsG } : {}),
      ...(input.hasGluten !== undefined ? { hasGluten: input.hasGluten } : {}),
      ...(input.hasLactose !== undefined ? { hasLactose: input.hasLactose } : {}),
      ...(input.hasNuts !== undefined ? { hasNuts: input.hasNuts } : {}),
      ...(input.hasSoy !== undefined ? { hasSoy: input.hasSoy } : {}),
      ...(input.hasEggs !== undefined ? { hasEggs: input.hasEggs } : {}),
      ...(input.hasFish !== undefined ? { hasFish: input.hasFish } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.recipeId !== undefined ? { recipeId: input.recipeId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: mealSelect,
  });
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteMeal(id: string) {
  await getMealById(id);
  await prisma.meal.delete({ where: { id } });
  return { id };
}

// ─── cooking time mapping (31.3.1) ──────────────────────────────────────────

const COOKING_TIME_LIMITS: Record<string, number> = {
  quick: 20,
  medium: 45,
  // 'long' → no limit
};

export function cookingTimeToMinutes(cookingTime?: string): number | undefined {
  if (!cookingTime) return undefined;
  return COOKING_TIME_LIMITS[cookingTime.toLowerCase()];
}

// ─── candidate meals for diet plan generation ─────────────────────────────────

export interface CandidateMealsOptions {
  mealType: MealTypeValue;
  targetKcal: number;
  tolerancePct?: number; // default 25%
  dietType?: DietTypeValue;
  excludeGluten?: boolean;
  excludeLactose?: boolean;
  excludeNuts?: boolean;
  excludeSoy?: boolean;
  excludeEggs?: boolean;
  excludeFish?: boolean;
  maxCookingTimeMinutes?: number; // 31.3.2: filter by recipe totalTimeMinutes
  preferredCuisines?: string[]; // 31.4.1: prioritize meals with matching recipe cuisineType
  limit?: number;
}

export async function getCandidateMeals(opts: CandidateMealsOptions) {
  const tolerance = (opts.tolerancePct ?? 25) / 100;
  const minKcal = Math.round(opts.targetKcal * (1 - tolerance));
  const maxKcal = Math.round(opts.targetKcal * (1 + tolerance));

  const hasCuisinePref = opts.preferredCuisines && opts.preferredCuisines.length > 0;

  const meals = await prisma.meal.findMany({
    where: {
      isActive: true,
      mealType: opts.mealType,
      ...(opts.dietType ? { dietType: opts.dietType } : {}),
      kcal: { gte: minKcal, lte: maxKcal },
      ...(opts.excludeGluten ? { hasGluten: false } : {}),
      ...(opts.excludeLactose ? { hasLactose: false } : {}),
      ...(opts.excludeNuts ? { hasNuts: false } : {}),
      ...(opts.excludeSoy ? { hasSoy: false } : {}),
      ...(opts.excludeEggs ? { hasEggs: false } : {}),
      ...(opts.excludeFish ? { hasFish: false } : {}),
      // 31.3.2: filter meals whose linked recipe exceeds cooking time limit
      ...(opts.maxCookingTimeMinutes ? {
        OR: [
          { recipeId: null }, // meals without recipe are always OK
          { recipe: { totalTimeMinutes: { lte: opts.maxCookingTimeMinutes } } },
          { recipe: { totalTimeMinutes: null } }, // unknown time → don't exclude
        ],
      } : {}),
    },
    orderBy: { kcal: 'asc' },
    // 31.4.1: fetch more candidates when cuisine preferences exist, so we can re-rank
    take: hasCuisinePref ? (opts.limit ?? 10) * 3 : (opts.limit ?? 10),
    select: {
      ...mealSelect,
      // 31.4.1: include recipe cuisineType for cuisine preference scoring
      ...(hasCuisinePref ? { recipe: { select: { cuisineType: true } } } : {}),
    },
  });

  // 31.4.1: re-rank by cuisine preference — preferred cuisine meals first
  if (hasCuisinePref) {
    const prefs = new Set(opts.preferredCuisines!.map(c => c.toLowerCase()));
    meals.sort((a, b) => {
      const aMatch = getCuisineScore(a, prefs);
      const bMatch = getCuisineScore(b, prefs);
      return bMatch - aMatch; // higher score first
    });
    return meals.slice(0, opts.limit ?? 10);
  }

  return meals;
}

/** 31.4.1: Score a meal by cuisine preference match (0 = no match/no recipe, 1 = match) */
function getCuisineScore(
  meal: Record<string, unknown>,
  preferredCuisines: Set<string>,
): number {
  const recipe = meal.recipe as { cuisineType?: string | null } | null | undefined;
  if (!recipe?.cuisineType) return 0;
  return preferredCuisines.has(recipe.cuisineType.toLowerCase()) ? 1 : 0;
}
