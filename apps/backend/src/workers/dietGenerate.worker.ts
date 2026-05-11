/**
 * 33.5.1 — BullMQ worker for full diet plan generation.
 * Supports 3 recipe generation modes via RECIPE_GENERATION_MODE env:
 *   - single:    1 call — plan + recipes together (default)
 *   - two-phase: 2 calls — plan first, then detailed recipes
 *   - per-day:   8 calls — plan first, then 7 parallel calls (1 per day)
 */
import { Worker, type Job } from 'bullmq';
import { prisma } from '@db';
import { QUEUE_NAMES, redisConnection, registerWorker } from '../queues';
import { callOpenAI, getModelForComplexity, type CallOpenAiResult } from '../services/openai.service';
import {
  buildDietGeneratePromptV2,
  buildDietGeneratePromptV3,
  buildRecipeDetailPrompt,
  DIET_PLAN_JSON_SCHEMA_V2,
  DIET_PLAN_JSON_SCHEMA_V3,
  RECIPE_DETAIL_JSON_SCHEMA,
  getPromptVersion,
  getRecipeGenerationMode,
  type GeneratePromptInput,
  type RecipeDetailInput,
} from '../services/promptBuilder.service';
import { processAiResult } from '../services/aiGeneration.service';
import type { ComplexityLevel } from '../services/aiGeneration.service';
import { checkPlanQuality } from '../services/planQualityCheck.service';
import type { PlanContent } from '../services/planValidation.service';

interface GenerateJobData extends GeneratePromptInput {
  dietPlanId: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// Use the canonical AiRecipe from planValidation — tips is string|undefined there
// but AI schema returns string|null. We convert null→undefined in merge.
interface AiRecipe { prepTimeMin: number; steps: string[]; tips: string | null }

function extractMealsForRecipeDetail(content: PlanContent): RecipeDetailInput[] {
  const meals: RecipeDetailInput[] = [];
  for (const day of content.days) {
    for (const meal of day.meals) {
      // Combine all items' ingredients into one list per meal
      const allIngredients: Array<{ name: string; grams: number }> = [];
      const dishNames: string[] = [];
      for (const item of meal.items) {
        dishNames.push(item.name);
        if (item.ingredients?.length) {
          for (const ing of item.ingredients) {
            allIngredients.push({ name: ing.name, grams: Number(ing.grams) || 0 });
          }
        } else {
          allIngredients.push({ name: item.name, grams: Number(item.grams) || 0 });
        }
      }
      meals.push({
        day: day.day,
        mealName: meal.name,
        dishName: dishNames[0] || meal.name, // primary dish name
        ingredients: allIngredients,
      });
    }
  }
  return meals;
}

function mergeDetailedRecipes(
  content: PlanContent,
  recipes: Array<{ day: string; mealName: string; dishName: string; recipe: AiRecipe }>,
): PlanContent {
  // Build lookup: "day|mealName" → recipe
  const lookup = new Map<string, AiRecipe>();
  for (const r of recipes) {
    lookup.set(`${r.day}|${r.mealName}`, r.recipe);
    // Also index by day|dishName for fallback matching
    lookup.set(`${r.day}|${r.dishName}`, r.recipe);
  }

  let merged = 0;
  const updatedDays = content.days.map((day) => ({
    ...day,
    meals: day.meals.map((meal) => {
      const recipe = lookup.get(`${day.day}|${meal.name}`)
        ?? lookup.get(`${day.day}|${meal.items?.[0]?.name ?? ''}`);
      if (recipe && Array.isArray(recipe.steps) && recipe.steps.length >= 2) {
        merged++;
        return { ...meal, recipe: { ...recipe, tips: recipe.tips ?? undefined } };
      }
      return meal;
    }),
  }));

  console.log(`[worker:generate] Recipe merge: ${merged}/${recipes.length} recipes matched to meals`);
  return { ...content, days: updatedDays };
}

// ─── main job processor ──────────────────────────────────────────────────────

async function processGenerateJob(job: Job<GenerateJobData>): Promise<void> {
  const { dietPlanId, complexityLevel } = job.data;
  const recipeMode = getRecipeGenerationMode();
  const skipDetailedRecipes = recipeMode !== 'single';

  console.log(`[worker:generate] Processing plan ${dietPlanId} (${complexityLevel}, recipe=${recipeMode}, attempt ${job.attemptsMade + 1})`);

  // ── Phase 1: Generate plan structure ──────────────────────────────────────
  const promptVersion = getPromptVersion();

  const { systemPrompt, userPrompt } = promptVersion === 'v3'
    ? buildDietGeneratePromptV3(job.data, skipDetailedRecipes)
    : buildDietGeneratePromptV2(job.data, skipDetailedRecipes);

  const jsonSchema = promptVersion === 'v3' ? DIET_PLAN_JSON_SCHEMA_V3 : DIET_PLAN_JSON_SCHEMA_V2;
  const maxTokens = 12000;
  const temperature = 0.35;

  const model = getModelForComplexity(complexityLevel);
  const result: CallOpenAiResult = await callOpenAI({
    systemPrompt,
    userPrompt,
    model,
    maxTokens,
    temperature,
    jsonSchema,
  });

  console.log(`[worker:generate] Phase 1 done: ${promptVersion}, ${result.model}, ${result.totalTokens} tokens, $${result.estimatedCostUsd.toFixed(4)}`);

  // Log Phase 1 cost
  await prisma.aiCostLog.create({
    data: {
      dietPlanId,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      jobType: 'generate',
      jobId: job.id,
    },
  });

  let planContent = result.content as PlanContent;
  let totalCost = result.estimatedCostUsd;
  let totalTokens = result.totalTokens;

  // ── Phase 2: Recipe enrichment (two-phase or per-day) ─────────────────────
  if (skipDetailedRecipes && planContent?.days?.length > 0) {
    const mealList = extractMealsForRecipeDetail(planContent);
    console.log(`[worker:generate] Phase 2: enriching ${mealList.length} meals (mode=${recipeMode})`);

    if (recipeMode === 'two-phase') {
      // Single call for all meals — with fallback to per-day if it fails
      let phase2Success = false;
      try {
        const { systemPrompt: rSys, userPrompt: rUser } = buildRecipeDetailPrompt(mealList);
        const recipeResult = await callOpenAI({
          systemPrompt: rSys,
          userPrompt: rUser,
          model,
          maxTokens: 16000,
          temperature: 0.4,
          jsonSchema: RECIPE_DETAIL_JSON_SCHEMA,
        });

        console.log(`[worker:generate] Phase 2 (two-phase) done: ${recipeResult.model}, ${recipeResult.totalTokens} tokens, $${recipeResult.estimatedCostUsd.toFixed(4)}`);

        await prisma.aiCostLog.create({
          data: {
            dietPlanId,
            model: recipeResult.model,
            promptTokens: recipeResult.promptTokens,
            completionTokens: recipeResult.completionTokens,
            totalTokens: recipeResult.totalTokens,
            estimatedCostUsd: recipeResult.estimatedCostUsd,
            jobType: 'generate-recipes',
            jobId: job.id,
          },
        });

        totalCost += recipeResult.estimatedCostUsd;
        totalTokens += recipeResult.totalTokens;

        const parsed = recipeResult.content as { recipes: Array<{ day: string; mealName: string; dishName: string; recipe: AiRecipe }> };
        if (parsed?.recipes?.length) {
          planContent = mergeDetailedRecipes(planContent, parsed.recipes);
          const mergedCount = parsed.recipes.filter(r => r.recipe?.steps?.length >= 2).length;
          console.log(`[worker:generate] Phase 2 merged: ${mergedCount}/${mealList.length} recipes with ≥2 steps`);
          phase2Success = mergedCount >= mealList.length * 0.5;
        }
      } catch (err) {
        console.error(`[worker:generate] Phase 2 (two-phase) FAILED: ${err instanceof Error ? err.message : err}`);
      }

      // Fallback: if two-phase failed or merged < 50%, retry as per-day
      if (!phase2Success) {
        console.log(`[worker:generate] Phase 2 fallback → per-day mode`);
        const DAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
        const dayResults = await Promise.allSettled(
          DAY_NAMES.map(async (dayName) => {
            const dayMeals = mealList.filter((m) => m.day === dayName);
            if (dayMeals.length === 0) return null;
            const { systemPrompt: rSys, userPrompt: rUser } = buildRecipeDetailPrompt(dayMeals, dayName);
            const dayResult = await callOpenAI({
              systemPrompt: rSys, userPrompt: rUser, model,
              maxTokens: 4000, temperature: 0.4,
              jsonSchema: RECIPE_DETAIL_JSON_SCHEMA,
            });
            console.log(`[worker:generate] Phase 2 fallback [${dayName}]: ${dayResult.totalTokens} tokens`);
            totalCost += dayResult.estimatedCostUsd;
            totalTokens += dayResult.totalTokens;
            return { dayResult, dayName };
          }),
        );
        for (const result of dayResults) {
          if (result.status !== 'fulfilled' || !result.value) continue;
          const parsed = result.value.dayResult.content as { recipes: Array<{ day: string; mealName: string; dishName: string; recipe: AiRecipe }> };
          if (parsed?.recipes?.length) {
            planContent = mergeDetailedRecipes(planContent, parsed.recipes);
          }
        }
      }

    } else if (recipeMode === 'per-day') {
      // 7 parallel calls (one per day)
      const DAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

      const dayResults = await Promise.allSettled(
        DAY_NAMES.map(async (dayName) => {
          const dayMeals = mealList.filter((m) => m.day === dayName);
          if (dayMeals.length === 0) return null;

          const { systemPrompt: rSys, userPrompt: rUser } = buildRecipeDetailPrompt(dayMeals, dayName);
          const dayResult = await callOpenAI({
            systemPrompt: rSys,
            userPrompt: rUser,
            model,
            maxTokens: 4000,
            temperature: 0.4,
            jsonSchema: RECIPE_DETAIL_JSON_SCHEMA,
          });

          console.log(`[worker:generate] Phase 2 [${dayName}]: ${dayResult.totalTokens} tokens, $${dayResult.estimatedCostUsd.toFixed(4)}`);

          await prisma.aiCostLog.create({
            data: {
              dietPlanId,
              model: dayResult.model,
              promptTokens: dayResult.promptTokens,
              completionTokens: dayResult.completionTokens,
              totalTokens: dayResult.totalTokens,
              estimatedCostUsd: dayResult.estimatedCostUsd,
              jobType: 'generate-recipes',
              jobId: job.id,
            },
          });

          totalCost += dayResult.estimatedCostUsd;
          totalTokens += dayResult.totalTokens;

          return dayResult;
        }),
      );

      // Merge all successful day results
      for (const dayResult of dayResults) {
        if (dayResult.status === 'fulfilled' && dayResult.value) {
          const parsed = dayResult.value.content as { recipes: Array<{ day: string; mealName: string; dishName: string; recipe: AiRecipe }> };
          if (parsed?.recipes?.length) {
            planContent = mergeDetailedRecipes(planContent, parsed.recipes);
          }
        } else if (dayResult.status === 'rejected') {
          console.warn(`[worker:generate] Phase 2 day call failed:`, dayResult.reason?.message ?? dayResult.reason);
        }
      }
    }

    console.log(`[worker:generate] Total cost: $${totalCost.toFixed(4)}, tokens: ${totalTokens}`);
  }

  // ── Phase 3: Quality verification ──────────────────────────────────────────
  const excludeKeywords = job.data.policyContext?.excludeKeywords ?? [];
  const qualityResult = checkPlanQuality(planContent, excludeKeywords);

  if (qualityResult.autoFixed.length > 0) {
    console.log(`[worker:generate] Phase 3: auto-naprawiono ${qualityResult.autoFixed.length} problemów`);
  }

  if (!qualityResult.passed) {
    console.warn(`[worker:generate] Phase 3: ${qualityResult.summary}`);

    // Try to fix meals with missing/short recipes via one more AI call
    const mealsToFix = qualityResult.mealsNeedingRepair.filter(
      m => qualityResult.issues.some(i => i.day === m.day && i.mealName === m.mealName &&
        (i.type === 'MISSING_RECIPE' || i.type === 'SHORT_RECIPE' || i.type === 'PLACEHOLDER_NAME')),
    );

    if (mealsToFix.length > 0 && mealsToFix.length <= 15) {
      console.log(`[worker:generate] Phase 3: naprawianie ${mealsToFix.length} posiłków z problemami`);
      try {
        // Build recipe fix request from problematic meals
        const fixMeals: RecipeDetailInput[] = [];
        for (const fix of mealsToFix) {
          const day = planContent.days.find(d => d.day === fix.day);
          const meal = day?.meals.find(m => m.name === fix.mealName);
          if (meal && meal.items[0]) {
            fixMeals.push({
              day: fix.day,
              mealName: fix.mealName,
              dishName: meal.items[0].name,
              ingredients: (meal.items[0].ingredients ?? []).map((ing: { name: string; grams: number }) => ({
                name: ing.name,
                grams: Number(ing.grams) || 0,
              })),
            });
          }
        }

        if (fixMeals.length > 0) {
          const { systemPrompt: fixSys, userPrompt: fixUser } = buildRecipeDetailPrompt(fixMeals);
          const fixResult = await callOpenAI({
            systemPrompt: fixSys,
            userPrompt: fixUser,
            model,
            maxTokens: 6000,
            temperature: 0.4,
            jsonSchema: RECIPE_DETAIL_JSON_SCHEMA,
          });

          console.log(`[worker:generate] Phase 3 fix: ${fixResult.totalTokens} tokens, $${fixResult.estimatedCostUsd.toFixed(4)}`);

          await prisma.aiCostLog.create({
            data: {
              dietPlanId,
              model: fixResult.model,
              promptTokens: fixResult.promptTokens,
              completionTokens: fixResult.completionTokens,
              totalTokens: fixResult.totalTokens,
              estimatedCostUsd: fixResult.estimatedCostUsd,
              jobType: 'generate-quality-fix',
              jobId: job.id,
            },
          });

          totalCost += fixResult.estimatedCostUsd;
          totalTokens += fixResult.totalTokens;

          const fixParsed = fixResult.content as { recipes: Array<{ day: string; mealName: string; dishName: string; recipe: AiRecipe }> };
          if (fixParsed?.recipes?.length) {
            planContent = mergeDetailedRecipes(planContent, fixParsed.recipes);
            console.log(`[worker:generate] Phase 3: naprawiono ${fixParsed.recipes.length} przepisów`);
          }
        }
      } catch (err) {
        console.error(`[worker:generate] Phase 3 fix failed:`, err instanceof Error ? err.message : err);
      }
    }

    // Re-check after fixes
    const recheck = checkPlanQuality(planContent, excludeKeywords);
    if (!recheck.passed) {
      console.warn(`[worker:generate] Phase 3 po naprawie: nadal ${recheck.issues.filter(i => i.severity === 'ERROR').length} błędów`);
    } else {
      console.log(`[worker:generate] Phase 3 po naprawie: plan przeszedł weryfikację`);
    }
  } else {
    console.log(`[worker:generate] Phase 3: ${qualityResult.summary}`);
  }

  // ── Process result (validate, standardize, save) ──────────────────────────
  await processAiResult({
    dietPlanId,
    content: planContent,
    aiProvider: 'openai',
    aiModel: result.model,
    tokenUsage: {
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens,
      estimatedCostUsd: totalCost,
    },
  });
}

// ─── worker setup ────────────────────────────────────────────────────────────

export function startDietGenerateWorker(): Worker {
  const worker = new Worker<GenerateJobData>(
    QUEUE_NAMES.DIET_GENERATE,
    processGenerateJob,
    {
      connection: redisConnection,
      concurrency: 2,
      limiter: { max: 5, duration: 60_000 },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[worker:generate] Job ${job.id} completed for plan ${job.data.dietPlanId}`);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    console.error(`[worker:generate] Job ${job.id} failed for plan ${job.data.dietPlanId}: ${err.message}`);

    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      try {
        await prisma.dietPlan.update({
          where: { id: job.data.dietPlanId },
          data: {
            status: 'GENERATION_FAILED',
            aiModel: `failed-${err.message.slice(0, 100)}`,
            policyMetadata: {
              generationError: {
                failedAt: new Date().toISOString(),
                reason: err.message,
                attempts: job.attemptsMade,
                lastError: err.message.slice(0, 500),
                jobId: job.id,
              },
            },
          },
        });
        console.error(`[worker:generate] Plan ${job.data.dietPlanId} marked as GENERATION_FAILED after ${job.attemptsMade} attempts`);
      } catch (dbErr) {
        console.error(`[worker:generate] Failed to update plan status:`, dbErr);
      }
    }
  });

  registerWorker(worker);
  console.log('[worker:generate] Diet generate worker started');
  return worker;
}
