import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { updateRecipeQualityScore } from './recipeScoring.service';
import { updateRecipeMealPrepFlag, updateRecipeSeasons } from './recipeMealPrep.service';

// ─── types ────────────────────────────────────────────────────────────────────

export interface RecipeIngredientInput {
  foodProductId?: string;  // legacy FK
  cleanProductId?: string; // new FK (preferred)
  sortOrder?: number;
  quantity: number;
  unit?: string;
  grams: number;
  displayName?: string;
  isOptional?: boolean;
  groupName?: string;
  notes?: string;
  retentionFactor?: number;
}

export interface RecipeStepInput {
  stepNumber: number;
  instruction: string;
  durationMinutes?: number;
  phase?: string; // "prep" or "cook"
}

export interface CreateRecipeInput {
  title: string;
  source?: string;
  sourceId?: string;
  description?: string;
  category?: string;
  cuisineType?: string;
  mealType?: string;
  difficulty?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  servings?: number;
  servingWeightG?: number;
  yieldWeightG?: number;
  yieldFactor?: number;
  tips?: string;
  notesDietitian?: string;
  imageUrl?: string;
  tags?: string[];
  ingredients: RecipeIngredientInput[];
  steps?: RecipeStepInput[];
}

export interface UpdateRecipeInput {
  title?: string;
  description?: string;
  category?: string;
  cuisineType?: string;
  mealType?: string;
  difficulty?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  servings?: number;
  servingWeightG?: number;
  yieldWeightG?: number;
  yieldFactor?: number;
  tips?: string;
  notesDietitian?: string;
  imageUrl?: string;
  tags?: string[];
  isActive?: boolean;
  ingredients?: RecipeIngredientInput[];
  steps?: RecipeStepInput[];
}

export interface ListRecipesOptions {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  mealType?: string;
  tag?: string;
  difficulty?: string;
  maxTotalTime?: number;
  allergenFree?: string[];
  dietFlags?: string[];
  minKcal?: number;
  maxKcal?: number;
  isActive?: boolean;
  // 37.4 new filters
  verificationStatus?: string;
  source?: string;
  sourceExclude?: string;
  qualityScoreMin?: number;
  qualityScoreMax?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  mealPrepFriendly?: boolean;
  season?: number;
}

// ─── slug helper ──────────────────────────────────────────────────────────────

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

// ─── select ───────────────────────────────────────────────────────────────────

const recipeSelect = {
  id: true,
  source: true,
  sourceId: true,
  title: true,
  slug: true,
  description: true,
  category: true,
  cuisineType: true,
  mealType: true,
  difficulty: true,
  prepTimeMinutes: true,
  cookTimeMinutes: true,
  totalTimeMinutes: true,
  servings: true,
  servingWeightG: true,
  yieldWeightG: true,
  yieldFactor: true,
  tips: true,
  notesDietitian: true,
  imageUrl: true,
  tags: true,
  isActive: true,
  mealPrepFriendly: true,
  seasons: true,
  qualityScore: true,
  averageRating: true,
  ratingCount: true,
  verificationStatus: true,
  createdAt: true,
  updatedAt: true,
  ingredients: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      cleanProductId: true,
      foodProductId: true,
      sortOrder: true,
      quantity: true,
      unit: true,
      grams: true,
      displayName: true,
      isOptional: true,
      groupName: true,
      notes: true,
      retentionFactor: true,
      foodProduct: {
        select: {
          id: true,
          name: true,
          slug: true,
          nutrients: {
            select: { kcal: true, protein_g: true, fat_g: true, carbs_g: true },
          },
        },
      },
      cleanProduct: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          nutrients: {
            select: { kcalPer100g: true, proteinPer100g: true, fatPer100g: true, carbsPer100g: true },
          },
          portions: {
            select: { id: true, portionName: true, weightG: true },
          },
        },
      },
    },
  },
  instructionSteps: {
    orderBy: { stepNumber: 'asc' as const },
  },
  nutritionSnapshot: true,
  allergens: true,
  dietFlags: true,
} satisfies Prisma.RecipeSelect;

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listRecipes(opts: ListRecipesOptions) {
  const skip = (opts.page - 1) * opts.limit;

  const where: Prisma.RecipeWhereInput = {
    ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    ...(opts.search ? { title: { contains: opts.search, mode: 'insensitive' } } : {}),
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.mealType ? { mealType: opts.mealType.toUpperCase() as Prisma.EnumRecipeMealTypeFilter<"Recipe"> } : {}),
    ...(opts.tag ? { tags: { has: opts.tag } } : {}),
    ...(opts.difficulty ? { difficulty: opts.difficulty.toUpperCase() as Prisma.EnumRecipeDifficultyFilter<"Recipe"> } : {}),
    ...(opts.maxTotalTime ? { totalTimeMinutes: { lte: opts.maxTotalTime } } : {}),
    ...(opts.allergenFree?.length ? {
      AND: opts.allergenFree.map(code => ({
        allergens: { none: { allergenCode: code, presence: 'CONTAINS' } },
      })),
    } : {}),
    ...(opts.dietFlags?.length ? {
      AND: opts.dietFlags.map(code => ({
        dietFlags: { some: { flagCode: code, value: true } },
      })),
    } : {}),
    ...(opts.minKcal !== undefined || opts.maxKcal !== undefined ? {
      nutritionSnapshot: {
        ...(opts.minKcal !== undefined ? { kcal: { gte: opts.minKcal } } : {}),
        ...(opts.maxKcal !== undefined ? { kcal: { lte: opts.maxKcal } } : {}),
      },
    } : {}),
    // 37.4 new filters
    ...(opts.verificationStatus ? { verificationStatus: opts.verificationStatus.toUpperCase() as Prisma.EnumVerificationStatusFilter<"Recipe"> } : {}),
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.sourceExclude ? { source: { not: opts.sourceExclude } } : {}),
    ...(opts.qualityScoreMin !== undefined ? { qualityScore: { gte: opts.qualityScoreMin } } : {}),
    ...(opts.qualityScoreMax !== undefined ? { qualityScore: { ...(opts.qualityScoreMin !== undefined ? { gte: opts.qualityScoreMin } : {}), lte: opts.qualityScoreMax } } : {}),
    ...(opts.mealPrepFriendly !== undefined ? { mealPrepFriendly: opts.mealPrepFriendly } : {}),
    ...(opts.season ? { seasons: { has: opts.season } } : {}),
  };

  // 37.4 sortBy support
  const sortByMap: Record<string, Prisma.RecipeOrderByWithRelationInput> = {
    title: { title: opts.sortOrder ?? 'asc' },
    qualityScore: { qualityScore: opts.sortOrder ?? 'desc' },
    createdAt: { createdAt: opts.sortOrder ?? 'desc' },
    totalTime: { totalTimeMinutes: opts.sortOrder ?? 'asc' },
    averageRating: { averageRating: opts.sortOrder ?? 'desc' },
  };
  const orderBy = (opts.sortBy && sortByMap[opts.sortBy]) || { title: 'asc' };

  const [recipes, total] = await prisma.$transaction([
    prisma.recipe.findMany({
      where,
      skip,
      take: opts.limit,
      orderBy,
      select: recipeSelect,
    }),
    prisma.recipe.count({ where }),
  ]);

  return { recipes, total, page: opts.page, limit: opts.limit };
}

// ─── get by id ────────────────────────────────────────────────────────────────

export async function getRecipeById(id: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    select: recipeSelect,
  });
  if (!recipe) throw new AppError(404, 'NOT_FOUND', 'Recipe not found');
  return recipe;
}

// ─── search ───────────────────────────────────────────────────────────────────

export async function searchRecipes(query: string, limit: number = 20) {
  return prisma.recipe.findMany({
    where: {
      isActive: true,
      title: { contains: query, mode: 'insensitive' },
    },
    take: limit,
    orderBy: [{ qualityScore: 'desc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      mealType: true,
      difficulty: true,
      totalTimeMinutes: true,
      servings: true,
      nutritionSnapshot: {
        select: { kcal: true, protein_g: true, fat_g: true, carbs_g: true },
      },
      ingredients: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          displayName: true,
          grams: true,
          quantity: true,
          unit: true,
          isOptional: true,
          foodProduct: { select: { id: true, name: true, nutrients: { select: { kcal: true, protein_g: true, fat_g: true, carbs_g: true } } } },
          cleanProduct: { select: { id: true, name: true, nutrients: { select: { kcalPer100g: true, proteinPer100g: true, fatPer100g: true, carbsPer100g: true } } } },
        },
      },
      instructionSteps: {
        orderBy: { stepNumber: 'asc' },
        select: { stepNumber: true, instruction: true },
      },
    },
  });
}

// ─── create ───────────────────────────────────────────────────────────────────

async function verifyIngredientProducts(ingredients: RecipeIngredientInput[]) {
  for (const ing of ingredients) {
    if (!ing.cleanProductId && !ing.foodProductId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Each ingredient must have cleanProductId or foodProductId');
    }
    if (ing.cleanProductId) {
      const product = await prisma.cleanProduct.findUnique({ where: { id: ing.cleanProductId } });
      if (!product) throw new AppError(404, 'NOT_FOUND', `Clean product ${ing.cleanProductId} not found`);
    } else if (ing.foodProductId) {
      const product = await prisma.foodProduct.findUnique({ where: { id: ing.foodProductId } });
      if (!product) throw new AppError(404, 'NOT_FOUND', `Food product ${ing.foodProductId} not found`);
    }
  }
}

function mapIngredientToCreate(ing: RecipeIngredientInput, idx: number) {
  return {
    ...(ing.cleanProductId ? { cleanProductId: ing.cleanProductId } : {}),
    ...(ing.foodProductId ? { foodProductId: ing.foodProductId } : {}),
    sortOrder: ing.sortOrder ?? idx,
    quantity: ing.quantity,
    unit: ing.unit ?? 'g',
    grams: ing.grams,
    displayName: ing.displayName,
    isOptional: ing.isOptional ?? false,
    groupName: ing.groupName,
    notes: ing.notes,
    retentionFactor: ing.retentionFactor,
  };
}

export async function createRecipe(input: CreateRecipeInput) {
  await verifyIngredientProducts(input.ingredients);

  const slug = await uniqueSlug(input.title);

  const created = await prisma.recipe.create({
    data: {
      title: input.title,
      slug,
      source: input.source ?? 'manual',
      sourceId: input.sourceId,
      description: input.description,
      category: input.category,
      cuisineType: input.cuisineType,
      mealType: (input.mealType?.toUpperCase() as Prisma.EnumRecipeMealTypeFieldUpdateOperationsInput['set']) ?? 'LUNCH',
      difficulty: (input.difficulty?.toUpperCase() as Prisma.EnumRecipeDifficultyFieldUpdateOperationsInput['set']) ?? 'MEDIUM',
      prepTimeMinutes: input.prepTimeMinutes,
      cookTimeMinutes: input.cookTimeMinutes,
      totalTimeMinutes: input.totalTimeMinutes ?? (((input.prepTimeMinutes ?? 0) + (input.cookTimeMinutes ?? 0)) || undefined),
      servings: input.servings ?? 1,
      servingWeightG: input.servingWeightG,
      yieldWeightG: input.yieldWeightG,
      yieldFactor: input.yieldFactor,
      tips: input.tips,
      notesDietitian: input.notesDietitian,
      imageUrl: input.imageUrl,
      tags: input.tags ?? [],
      ingredients: {
        create: input.ingredients.map((ing, idx) => mapIngredientToCreate(ing, idx)),
      },
      ...(input.steps?.length ? {
        instructionSteps: {
          create: input.steps.map(s => ({
            stepNumber: s.stepNumber,
            instruction: s.instruction,
            durationMinutes: s.durationMinutes,
            phase: s.phase ?? 'prep',
          })),
        },
      } : {}),
    },
    select: recipeSelect,
  });

  // Auto-compute quality score (non-blocking)
  updateRecipeQualityScore(created.id).catch((err) =>
    console.warn(`[recipe] Quality score update failed for ${created.id}:`, err instanceof Error ? err.message : err),
  );
  updateRecipeMealPrepFlag(created.id).catch(() => {});
  updateRecipeSeasons(created.id).catch(() => {});

  return created;
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function updateRecipe(id: string, input: UpdateRecipeInput) {
  await getRecipeById(id);

  if (input.ingredients) {
    await verifyIngredientProducts(input.ingredients);
  }

  const updated = await prisma.recipe.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.cuisineType !== undefined ? { cuisineType: input.cuisineType } : {}),
      ...(input.mealType !== undefined ? { mealType: input.mealType.toUpperCase() as Prisma.EnumRecipeMealTypeFieldUpdateOperationsInput['set'] } : {}),
      ...(input.difficulty !== undefined ? { difficulty: input.difficulty.toUpperCase() as Prisma.EnumRecipeDifficultyFieldUpdateOperationsInput['set'] } : {}),
      ...(input.prepTimeMinutes !== undefined ? { prepTimeMinutes: input.prepTimeMinutes } : {}),
      ...(input.cookTimeMinutes !== undefined ? { cookTimeMinutes: input.cookTimeMinutes } : {}),
      ...(input.totalTimeMinutes !== undefined ? { totalTimeMinutes: input.totalTimeMinutes } : {}),
      ...(input.servings !== undefined ? { servings: input.servings } : {}),
      ...(input.servingWeightG !== undefined ? { servingWeightG: input.servingWeightG } : {}),
      ...(input.yieldWeightG !== undefined ? { yieldWeightG: input.yieldWeightG } : {}),
      ...(input.yieldFactor !== undefined ? { yieldFactor: input.yieldFactor } : {}),
      ...(input.tips !== undefined ? { tips: input.tips } : {}),
      ...(input.notesDietitian !== undefined ? { notesDietitian: input.notesDietitian } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.ingredients ? {
        ingredients: {
          deleteMany: {},
          create: input.ingredients.map((ing, idx) => mapIngredientToCreate(ing, idx)),
        },
      } : {}),
      ...(input.steps ? {
        instructionSteps: {
          deleteMany: {},
          create: input.steps.map(s => ({
            stepNumber: s.stepNumber,
            instruction: s.instruction,
            durationMinutes: s.durationMinutes,
            phase: s.phase ?? 'prep',
          })),
        },
      } : {}),
    },
    select: recipeSelect,
  });

  // Auto-compute quality score (non-blocking)
  updateRecipeQualityScore(id).catch((err) =>
    console.warn(`[recipe] Quality score update failed for ${id}:`, err instanceof Error ? err.message : err),
  );
  updateRecipeMealPrepFlag(id).catch(() => {});
  updateRecipeSeasons(id).catch(() => {});

  return updated;
}

// ─── 37.1 bulk update ────────────────────────────────────────────────────────

export async function bulkUpdateRecipes(
  ids: string[],
  action: string,
  value: unknown,
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;
  let skipped = 0;

  // Verify all IDs exist
  const existing = await prisma.recipe.findMany({
    where: { id: { in: ids } },
    select: { id: true, tags: true },
  });
  const existingIds = new Set(existing.map((r) => r.id));
  const missingIds = ids.filter((id) => !existingIds.has(id));
  if (missingIds.length > 0) {
    errors.push(`Not found: ${missingIds.length} recipe(s)`);
    skipped += missingIds.length;
  }

  const validIds = ids.filter((id) => existingIds.has(id));
  if (validIds.length === 0) return { updated: 0, skipped, errors };

  switch (action) {
    case 'SET_CATEGORY': {
      const result = await prisma.recipe.updateMany({
        where: { id: { in: validIds } },
        data: { category: String(value) },
      });
      updated = result.count;
      break;
    }
    case 'SET_MEAL_TYPE': {
      const result = await prisma.recipe.updateMany({
        where: { id: { in: validIds } },
        data: { mealType: String(value).toUpperCase() as Prisma.EnumRecipeMealTypeFieldUpdateOperationsInput['set'] },
      });
      updated = result.count;
      break;
    }
    case 'SET_DIFFICULTY': {
      const result = await prisma.recipe.updateMany({
        where: { id: { in: validIds } },
        data: { difficulty: String(value).toUpperCase() as Prisma.EnumRecipeDifficultyFieldUpdateOperationsInput['set'] },
      });
      updated = result.count;
      break;
    }
    case 'SET_VERIFICATION_STATUS': {
      const result = await prisma.recipe.updateMany({
        where: { id: { in: validIds } },
        data: { verificationStatus: String(value).toUpperCase() as Prisma.EnumVerificationStatusFieldUpdateOperationsInput['set'] },
      });
      updated = result.count;
      break;
    }
    case 'SET_ACTIVE': {
      const result = await prisma.recipe.updateMany({
        where: { id: { in: validIds } },
        data: { isActive: Boolean(value) },
      });
      updated = result.count;
      break;
    }
    case 'ADD_TAGS': {
      const tagsToAdd = Array.isArray(value) ? (value as string[]) : [String(value)];
      for (const recipe of existing) {
        if (!validIds.includes(recipe.id)) continue;
        const currentTags = (recipe.tags ?? []) as string[];
        const newTags = [...new Set([...currentTags, ...tagsToAdd])];
        await prisma.recipe.update({
          where: { id: recipe.id },
          data: { tags: newTags },
        });
        updated++;
      }
      break;
    }
    case 'REMOVE_TAGS': {
      const tagsToRemove = new Set(Array.isArray(value) ? (value as string[]) : [String(value)]);
      for (const recipe of existing) {
        if (!validIds.includes(recipe.id)) continue;
        const currentTags = (recipe.tags ?? []) as string[];
        const newTags = currentTags.filter((t) => !tagsToRemove.has(t));
        await prisma.recipe.update({
          where: { id: recipe.id },
          data: { tags: newTags },
        });
        updated++;
      }
      break;
    }
    case 'DELETE': {
      const result = await prisma.recipe.deleteMany({
        where: { id: { in: validIds } },
      });
      updated = result.count;
      break;
    }
    default:
      errors.push(`Unknown action: ${action}`);
  }

  return { updated, skipped, errors };
}

// ─── 37.3 find duplicates ─────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - levenshtein(a, b) / maxLen) * 100);
}

export async function findDuplicates(
  minSimilarity = 80,
): Promise<Array<{ recipes: Array<{ id: string; title: string; qualityScore: number; category: string | null; mealType: string | null }>; similarity: number }>> {
  const all = await prisma.recipe.findMany({
    select: { id: true, title: true, qualityScore: true, category: true, mealType: true },
    orderBy: { title: 'asc' },
  });

  const clustered = new Set<string>();
  const clusters: Array<{ recipes: typeof all; similarity: number }> = [];

  for (let i = 0; i < all.length; i++) {
    if (clustered.has(all[i].id)) continue;

    const titleA = all[i].title.toLowerCase().trim();
    const group = [all[i]];
    let minSim = 100;

    for (let j = i + 1; j < all.length; j++) {
      if (clustered.has(all[j].id)) continue;
      const titleB = all[j].title.toLowerCase().trim();
      const sim = similarity(titleA, titleB);
      if (sim >= minSimilarity) {
        group.push(all[j]);
        minSim = Math.min(minSim, sim);
        clustered.add(all[j].id);
      }
    }

    if (group.length >= 2) {
      clustered.add(all[i].id);
      clusters.push({ recipes: group.slice(0, 5), similarity: minSim });
    }
  }

  return clusters;
}

// ─── 37.3 merge duplicates ───────────────────────────────────────────────────

export async function mergeRecipes(
  masterId: string,
  duplicateIds: string[],
): Promise<{ merged: number }> {
  if (duplicateIds.includes(masterId)) {
    throw new AppError(400, 'INVALID_MERGE', 'Master recipe cannot be in duplicate list');
  }

  const master = await prisma.recipe.findUnique({
    where: { id: masterId },
    select: { id: true, tags: true },
  });
  if (!master) throw new AppError(404, 'NOT_FOUND', 'Master recipe not found');

  const duplicates = await prisma.recipe.findMany({
    where: { id: { in: duplicateIds } },
    select: { id: true, tags: true },
  });

  if (duplicates.length === 0) {
    throw new AppError(404, 'NOT_FOUND', 'No duplicate recipes found');
  }

  // Merge tags from all duplicates into master
  const masterTags = (master.tags ?? []) as string[];
  const allTags = new Set(masterTags);
  for (const dup of duplicates) {
    for (const tag of (dup.tags ?? []) as string[]) {
      allTags.add(tag);
    }
  }

  await prisma.$transaction([
    // Update master tags
    prisma.recipe.update({
      where: { id: masterId },
      data: { tags: [...allTags] },
    }),
    // Delete duplicates (cascade handles ingredients, steps, etc.)
    prisma.recipe.deleteMany({
      where: { id: { in: duplicateIds } },
    }),
  ]);

  return { merged: duplicates.length };
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteRecipe(id: string) {
  await getRecipeById(id);
  await prisma.recipe.delete({ where: { id } });
  return { id };
}
