/**
 * 33.5.3 — BullMQ worker for partial diet plan regeneration.
 * Handles two job types:
 * - 'partial': dietitian-triggered partial regen (existing)
 * - 'patient-day-regen': patient-triggered single day regen (new)
 */
import { Worker, type Job } from 'bullmq';
import { prisma, Prisma } from '@db';
import { QUEUE_NAMES, redisConnection, registerWorker } from '../queues';
import { callOpenAI, type CallOpenAiResult } from '../services/openai.service';
import {
  buildPartialRegenPromptV3,
  buildPatientDayRegenPrompt,
  DIET_PLAN_JSON_SCHEMA_V3_PARTIAL,
  type PartialRegenPromptInput,
  type PatientDayRegenInput,
} from '../services/promptBuilder.service';
import { processAiResult } from '../services/aiGeneration.service';
import { decryptJson, encryptJson } from '../utils/encryption';
import { computeNutritionFromIngredients, isV2Plan } from '../services/nutritionCalculator.service';
import { smartScaleContent } from '../services/gramScaling.service';
import { standardizePlanContent } from '../services/productNameStandardization.service';
import type { PlanContent } from '../services/planValidation.service';

interface PartialJobData extends PartialRegenPromptInput {
  dietPlanId: string;
}

interface PatientDayRegenJobData extends PatientDayRegenInput {
  dietPlanId: string;
  regenId: string;
}

// ─── Dietitian partial regen (existing) ─────────────────────────────────────

async function processPartialJob(job: Job<PartialJobData>): Promise<void> {
  const { dietPlanId } = job.data;
  console.log(`[worker:partial] Processing plan ${dietPlanId}`);

  const { systemPrompt, userPrompt } = buildPartialRegenPromptV3(job.data);
  const jsonSchema = DIET_PLAN_JSON_SCHEMA_V3_PARTIAL;
  const maxTokens = 10000;

  const result: CallOpenAiResult = await callOpenAI({
    systemPrompt,
    userPrompt,
    model: 'gpt-4.1',
    maxTokens,
    temperature: 0.5,
    jsonSchema,
  });

  console.log(`[worker:partial] Plan ${dietPlanId}: ${result.model}, ${result.totalTokens} tokens, $${result.estimatedCostUsd.toFixed(4)}`);

  await prisma.aiCostLog.create({
    data: {
      dietPlanId,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      jobType: 'partial',
      jobId: job.id,
    },
  });

  await processAiResult({
    dietPlanId,
    content: result.content as PlanContent,
    aiProvider: 'openai',
    aiModel: `${result.model}-partial`,
    tokenUsage: {
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      estimatedCostUsd: result.estimatedCostUsd,
    },
  });
}

// ─── Patient day regen (new) ────────────────────────────────────────────────

const MAX_REGEN_RETRIES = 3;

async function processPatientDayRegen(job: Job<PatientDayRegenJobData>): Promise<void> {
  const { dietPlanId, regenId, dayName, nutritionTargets } = job.data;
  console.log(`[worker:day-regen] Processing plan ${dietPlanId}, day ${dayName}, regen ${regenId}`);

  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_REGEN_RETRIES; attempt++) {
    try {
      // Build prompt (may add extra excludeKeywords on retry)
      const promptInput = { ...job.data };
      if (attempt > 1 && lastError) {
        // On retry, add a hint about what went wrong
        promptInput.policyContext = {
          ...promptInput.policyContext,
          clinicalNotes: [
            ...promptInput.policyContext.clinicalNotes,
            `UWAGA: Poprzednia próba została odrzucona. ${lastError}. Upewnij się że nowy dzień jest bezpieczny.`,
          ],
        };
      }

      const { systemPrompt, userPrompt } = buildPatientDayRegenPrompt(promptInput);

      const result: CallOpenAiResult = await callOpenAI({
        systemPrompt,
        userPrompt,
        model: 'gpt-4.1',
        maxTokens: 6000,
        temperature: attempt === 1 ? 0.5 : 0.7, // Higher temp on retry for variety
        jsonSchema: DIET_PLAN_JSON_SCHEMA_V3_PARTIAL,
      });

      console.log(`[worker:day-regen] Attempt ${attempt}: ${result.model}, ${result.totalTokens} tokens`);

      // Log cost
      await prisma.aiCostLog.create({
        data: {
          dietPlanId,
          model: result.model,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          estimatedCostUsd: result.estimatedCostUsd,
          jobType: 'patient-day-regen',
          jobId: job.id,
        },
      });

      // Parse AI response
      const aiContent = result.content as PlanContent;
      if (!aiContent?.days?.length) {
        lastError = 'AI returned empty content';
        continue;
      }

      const newDay = aiContent.days[0];
      if (!newDay?.meals?.length) {
        lastError = 'AI returned day without meals';
        continue;
      }

      // Standardize product names
      const { content: standardized } = await standardizePlanContent({ days: [newDay] });
      const standardizedDay = standardized.days[0];

      // Compute nutrition from ingredients (V2 enrichment)
      let enrichedDay = standardizedDay;
      let nutrientMap: Map<string, { kcalPer100g: number; proteinPer100g: number; fatPer100g: number; carbsPer100g: number }> | null = null;
      if (isV2Plan({ days: [standardizedDay] })) {
        const { enrichedContent, nutrientMap: nMap } = await computeNutritionFromIngredients({ days: [standardizedDay] });
        enrichedDay = enrichedContent.days[0];
        nutrientMap = nMap;
      }

      // Smart scaling
      if (nutrientMap && nutrientMap.size > 0 && nutritionTargets.kcal > 0) {
        const { scaledContent, report } = smartScaleContent(
          { days: [enrichedDay] },
          nutrientMap,
          { targetKcal: nutritionTargets.kcal },
        );
        enrichedDay = scaledContent.days[0];
        if (report.details[0]) {
          console.log(`[worker:day-regen] Scaling: ${report.details[0].originalKcal} → ${report.details[0].finalKcal} kcal`);
        }
      }

      // Merge new day into existing plan
      const currentPlan = await prisma.dietPlan.findUnique({
        where: { id: dietPlanId },
        select: { content: true, dayRegenLimit: true },
      });
      if (!currentPlan) throw new Error('Plan not found during merge');

      const planContent = decryptJson(currentPlan.content) as PlanContent;
      const dayIndex = planContent.days.findIndex((d) => d.day === dayName);
      if (dayIndex === -1) throw new Error(`Day ${dayName} not found during merge`);

      // Ensure day name is correct
      enrichedDay.day = dayName;
      planContent.days[dayIndex] = enrichedDay;

      // Save merged plan + decrement limit
      await prisma.$transaction([
        prisma.dietPlan.update({
          where: { id: dietPlanId },
          data: {
            content: encryptJson(planContent as unknown as Record<string, unknown>) as unknown as Prisma.InputJsonValue,
            dayRegenLimit: Math.max(0, currentPlan.dayRegenLimit - 1),
          },
        }),
        prisma.dayRegeneration.update({
          where: { id: regenId },
          data: {
            newDay: enrichedDay as unknown as Prisma.InputJsonValue,
            status: 'SUCCESS',
          },
        }),
      ]);

      console.log(`[worker:day-regen] Plan ${dietPlanId}: day ${dayName} regenerated successfully (attempt ${attempt})`);
      return; // Success!

    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[worker:day-regen] Attempt ${attempt} failed: ${lastError}`);

      if (attempt >= MAX_REGEN_RETRIES) {
        // All retries exhausted — mark as failed
        await prisma.dayRegeneration.update({
          where: { id: regenId },
          data: { status: 'FAILED' },
        }).catch((dbErr) => console.error('[worker:day-regen] Failed to update regen status:', dbErr));

        throw new Error(`Day regeneration failed after ${MAX_REGEN_RETRIES} attempts: ${lastError}`);
      }
    }
  }
}

// ─── Job router ─────────────────────────────────────────────────────────────

async function processJob(job: Job): Promise<void> {
  if (job.name === 'patient-day-regen') {
    await processPatientDayRegen(job as Job<PatientDayRegenJobData>);
  } else {
    await processPartialJob(job as Job<PartialJobData>);
  }
}

export function startDietPartialWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.DIET_PARTIAL,
    processJob,
    {
      connection: redisConnection,
      concurrency: 2,
      limiter: { max: 5, duration: 60_000 },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[worker:partial] Job ${job.id} (${job.name}) completed for plan ${job.data.dietPlanId}`);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    console.error(`[worker:partial] Job ${job.id} (${job.name}) failed: ${err.message}`);

    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      try {
        if (job.name === 'patient-day-regen') {
          // Patient day regen: mark regen record as failed (don't change plan status)
          const regenId = (job.data as PatientDayRegenJobData).regenId;
          if (regenId) {
            await prisma.dayRegeneration.update({
              where: { id: regenId },
              data: { status: 'FAILED' },
            });
          }
        } else {
          // Dietitian partial regen: mark plan as failed
          await prisma.dietPlan.update({
            where: { id: job.data.dietPlanId },
            data: {
              status: 'GENERATION_FAILED',
              aiModel: `partial-failed-${err.message.slice(0, 50)}`,
            },
          });
        }
      } catch (dbErr) {
        console.error('[worker:partial] Failed to update status:', dbErr);
      }
    }
  });

  registerWorker(worker);
  console.log('[worker:partial] Diet partial regen worker started');
  return worker;
}
