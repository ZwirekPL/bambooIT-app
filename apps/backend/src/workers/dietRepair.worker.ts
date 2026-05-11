/**
 * 33.5.2 — BullMQ worker for diet plan repair (violation fix).
 */
import { Worker, type Job } from 'bullmq';
import { prisma } from '@db';
import { QUEUE_NAMES, redisConnection, registerWorker } from '../queues';
import { callOpenAI, type CallOpenAiResult } from '../services/openai.service';
import { buildRepairPromptV2, DIET_PLAN_JSON_SCHEMA_V2, type RepairPromptInput } from '../services/promptBuilder.service';
import { processAiResult } from '../services/aiGeneration.service';

interface RepairJobData extends RepairPromptInput {
  dietPlanId: string;
}

async function processRepairJob(job: Job<RepairJobData>): Promise<void> {
  const { dietPlanId, attemptNumber } = job.data;
  console.log(`[worker:repair] Processing plan ${dietPlanId} (repair attempt ${attemptNumber})`);

  const { systemPrompt, userPrompt } = buildRepairPromptV2(job.data);
  const jsonSchema = DIET_PLAN_JSON_SCHEMA_V2;

  const result: CallOpenAiResult = await callOpenAI({
    systemPrompt,
    userPrompt,
    model: 'gpt-4.1',
    maxTokens: 12000,
    temperature: 0.3,
    jsonSchema,
  });

  console.log(`[worker:repair] Plan ${dietPlanId}: ${result.model}, ${result.totalTokens} tokens, $${result.estimatedCostUsd.toFixed(4)}`);

  await prisma.aiCostLog.create({
    data: {
      dietPlanId,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      jobType: 'repair',
      jobId: job.id,
    },
  });

  await processAiResult({
    dietPlanId,
    content: result.content as import('../services/planValidation.service').PlanContent,
    aiProvider: 'openai',
    aiModel: `${result.model}-repair`,
    tokenUsage: {
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      estimatedCostUsd: result.estimatedCostUsd,
    },
  });
}

export function startDietRepairWorker(): Worker {
  const worker = new Worker<RepairJobData>(
    QUEUE_NAMES.DIET_REPAIR,
    processRepairJob,
    {
      connection: redisConnection,
      concurrency: 2,
      limiter: { max: 5, duration: 60_000 },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[worker:repair] Job ${job.id} completed for plan ${job.data.dietPlanId}`);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    console.error(`[worker:repair] Job ${job.id} failed: ${err.message}`);

    if (job.attemptsMade >= (job.opts.attempts ?? 2)) {
      try {
        await prisma.dietPlan.update({
          where: { id: job.data.dietPlanId },
          data: {
            status: 'MANUAL_REVIEW_REQUIRED',
            aiModel: `repair-failed-${err.message.slice(0, 50)}`,
          },
        });
      } catch (dbErr) {
        console.error('[worker:repair] Failed to update plan status:', dbErr);
      }
    }
  });

  registerWorker(worker);
  console.log('[worker:repair] Diet repair worker started');
  return worker;
}
