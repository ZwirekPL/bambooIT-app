import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import {
  buildPlanIdCacheKey,
  buildPlanMatchCacheKey,
  getCachedPlan,
  setCachedPlan,
  invalidatePlanById,
  invalidatePlanMatchCache,
} from '../utils/dietPlanCache';

// ─── types ────────────────────────────────────────────────────────────────────

export type GoalValue = 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN';
export type DietTypeValue = 'STANDARD' | 'VEGE' | 'VEGAN' | 'GLUTEN_FREE' | 'LACTOSE_FREE';

export interface CreateTemplatePlanInput {
  name: string;
  description?: string;
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
  goal: GoalValue;
  dietType?: DietTypeValue;
  mealCount?: number;
}

export interface UpdateTemplatePlanInput {
  name?: string;
  description?: string;
  targetKcal?: number;
  targetProteinG?: number;
  targetFatG?: number;
  targetCarbsG?: number;
  goal?: GoalValue;
  dietType?: DietTypeValue;
  mealCount?: number;
  isActive?: boolean;
}

export interface ListTemplatePlansOptions {
  page: number;
  limit: number;
  goal?: GoalValue;
  dietType?: DietTypeValue;
  minKcal?: number;
  maxKcal?: number;
  isActive?: boolean;
}

export interface AddTemplateMealInput {
  mealId: string;
  dayNumber: number;
  position: number;
}

// ─── select ───────────────────────────────────────────────────────────────────

const templatePlanSelect = {
  id: true,
  name: true,
  description: true,
  targetKcal: true,
  targetProteinG: true,
  targetFatG: true,
  targetCarbsG: true,
  goal: true,
  dietType: true,
  mealCount: true,
  isActive: true,
  source: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TemplatePlanSelect;

const templatePlanWithMealsSelect = {
  ...templatePlanSelect,
  meals: {
    orderBy: [{ dayNumber: 'asc' as const }, { position: 'asc' as const }],
    select: {
      id: true,
      dayNumber: true,
      position: true,
      meal: {
        select: {
          id: true,
          name: true,
          mealType: true,
          dietType: true,
          kcal: true,
          proteinG: true,
          fatG: true,
          carbsG: true,
          tags: true,
        },
      },
    },
  },
} satisfies Prisma.TemplatePlanSelect;

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listTemplatePlans(opts: ListTemplatePlansOptions) {
  const skip = (opts.page - 1) * opts.limit;

  const where: Prisma.TemplatePlanWhereInput = {
    ...(opts.isActive !== undefined ? { isActive: opts.isActive } : { isActive: true }),
    ...(opts.goal ? { goal: opts.goal } : {}),
    ...(opts.dietType ? { dietType: opts.dietType } : {}),
    ...(opts.minKcal !== undefined || opts.maxKcal !== undefined
      ? { targetKcal: { gte: opts.minKcal, lte: opts.maxKcal } }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.templatePlan.findMany({
      where,
      skip,
      take: opts.limit,
      orderBy: [{ goal: 'asc' }, { targetKcal: 'asc' }],
      select: templatePlanSelect,
    }),
    prisma.templatePlan.count({ where }),
  ]);

  return { items, total, page: opts.page, limit: opts.limit };
}

// ─── get by id ────────────────────────────────────────────────────────────────

export async function getTemplatePlanById(id: string) {
  const cacheKey = buildPlanIdCacheKey(id);
  const cached = await getCachedPlan<ReturnType<typeof prisma.templatePlan.findUnique>>(cacheKey);
  if (cached) return cached as Awaited<ReturnType<typeof _fetchTemplatePlanById>>;

  const plan = await _fetchTemplatePlanById(id);
  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Template plan not found');
  await setCachedPlan(cacheKey, plan);
  return plan;
}

async function _fetchTemplatePlanById(id: string) {
  return prisma.templatePlan.findUnique({
    where: { id },
    select: templatePlanWithMealsSelect,
  });
}

// ─── find best match (cached) ─────────────────────────────────────────────────

export interface FindBestTemplatePlanOptions {
  goal: GoalValue;
  kcal: number;
  mealCount: number;
  dietType: DietTypeValue;
}

export async function findBestTemplatePlan(opts: FindBestTemplatePlanOptions) {
  const cacheKey = buildPlanMatchCacheKey(opts.goal, opts.kcal, opts.mealCount, opts.dietType);
  type PlanResult = Awaited<ReturnType<typeof _queryBestTemplatePlan>>;
  const cached = await getCachedPlan<PlanResult>(cacheKey);
  if (cached !== null) return cached;

  const plan = await _queryBestTemplatePlan(opts);
  await setCachedPlan(cacheKey, plan);
  return plan;
}

async function _queryBestTemplatePlan(opts: FindBestTemplatePlanOptions) {
  const kcalTolerance = Math.round(opts.kcal * 0.1); // ±10%

  // Try exact match first, then fuzzy within ±10% kcal
  const plan = await prisma.templatePlan.findFirst({
    where: {
      isActive: true,
      goal: opts.goal,
      dietType: opts.dietType,
      mealCount: opts.mealCount,
      targetKcal: {
        gte: opts.kcal - kcalTolerance,
        lte: opts.kcal + kcalTolerance,
      },
    },
    orderBy: [
      // Closest kcal match — Prisma doesn't support ABS, so order by targetKcal desc then pick closest
      { targetKcal: 'asc' },
    ],
    select: templatePlanWithMealsSelect,
  });

  return plan ?? null;
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createTemplatePlan(input: CreateTemplatePlanInput) {
  const plan = await prisma.templatePlan.create({
    data: {
      name: input.name,
      description: input.description,
      targetKcal: input.targetKcal,
      targetProteinG: input.targetProteinG,
      targetFatG: input.targetFatG,
      targetCarbsG: input.targetCarbsG,
      goal: input.goal,
      dietType: input.dietType ?? 'STANDARD',
      mealCount: input.mealCount ?? 5,
    },
    select: templatePlanWithMealsSelect,
  });
  // New plan may satisfy a cached "no match" — invalidate match cache
  await invalidatePlanMatchCache();
  return plan;
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function updateTemplatePlan(id: string, input: UpdateTemplatePlanInput) {
  await getTemplatePlanById(id);
  const plan = await prisma.templatePlan.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.targetKcal !== undefined ? { targetKcal: input.targetKcal } : {}),
      ...(input.targetProteinG !== undefined ? { targetProteinG: input.targetProteinG } : {}),
      ...(input.targetFatG !== undefined ? { targetFatG: input.targetFatG } : {}),
      ...(input.targetCarbsG !== undefined ? { targetCarbsG: input.targetCarbsG } : {}),
      ...(input.goal !== undefined ? { goal: input.goal } : {}),
      ...(input.dietType !== undefined ? { dietType: input.dietType } : {}),
      ...(input.mealCount !== undefined ? { mealCount: input.mealCount } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: templatePlanWithMealsSelect,
  });
  await Promise.all([invalidatePlanById(id), invalidatePlanMatchCache()]);
  return plan;
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteTemplatePlan(id: string) {
  await getTemplatePlanById(id);
  await prisma.templatePlan.delete({ where: { id } });
  await Promise.all([invalidatePlanById(id), invalidatePlanMatchCache()]);
  return { id };
}

// ─── meal slot management ─────────────────────────────────────────────────────

export async function addMealToTemplate(templatePlanId: string, input: AddTemplateMealInput) {
  await getTemplatePlanById(templatePlanId);

  const meal = await prisma.meal.findUnique({ where: { id: input.mealId } });
  if (!meal) throw new AppError(400, 'VALIDATION_ERROR', 'Meal not found');
  if (!meal.isActive) throw new AppError(400, 'VALIDATION_ERROR', 'Meal is not active');

  if (input.dayNumber < 1 || input.dayNumber > 7) {
    throw new AppError(400, 'VALIDATION_ERROR', 'dayNumber must be between 1 and 7');
  }
  if (input.position < 1 || input.position > 10) {
    throw new AppError(400, 'VALIDATION_ERROR', 'position must be between 1 and 10');
  }

  try {
    const slot = await prisma.templateMeal.create({
      data: {
        templatePlanId,
        mealId: input.mealId,
        dayNumber: input.dayNumber,
        position: input.position,
      },
      select: {
        id: true,
        dayNumber: true,
        position: true,
        meal: {
          select: {
            id: true,
            name: true,
            mealType: true,
            kcal: true,
            proteinG: true,
            fatG: true,
            carbsG: true,
          },
        },
      },
    });
    await Promise.all([invalidatePlanById(templatePlanId), invalidatePlanMatchCache()]);
    return slot;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'CONFLICT', 'This meal is already assigned to this day in the template');
    }
    throw err;
  }
}

export async function removeMealFromTemplate(templateMealId: string) {
  const slot = await prisma.templateMeal.findUnique({ where: { id: templateMealId } });
  if (!slot) throw new AppError(404, 'NOT_FOUND', 'Template meal slot not found');
  await prisma.templateMeal.delete({ where: { id: templateMealId } });
  // Meal composition changed — invalidate cached plan
  await Promise.all([invalidatePlanById(slot.templatePlanId), invalidatePlanMatchCache()]);
  return { id: templateMealId };
}
