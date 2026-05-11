import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@db';
import { apiError } from '../utils/errors';
import { processN8nCallback, type N8nCallbackPayload } from '../services/n8n.service';
import { logAudit } from '../services/audit.service';
import { cacheDel } from '../utils/cache';
import { markEventProcessed, clearEventProcessed } from '../utils/idempotency';

// ─── schema ──────────────────────────────────────────────────────────────────

const planIngredientSchema = z.object({
  name: z.string().min(1),
  grams: z.number().nonnegative(),
});

const planItemSchema = z.object({
  name: z.string().min(1),
  grams: z.number().nonnegative(),
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  ingredients: z.array(planIngredientSchema).optional(),
});

const recipeVariantSchema = z.object({
  appliance: z.enum(['THERMOMIX', 'AIRFRYER']),
  prepTimeMin: z.number().int().nonnegative(),
  steps: z.array(z.string().min(1)).min(1),
  tips: z.string().optional(),
});

const mealRecipeSchema = z.object({
  prepTimeMin: z.number().int().nonnegative(),
  steps: z.array(z.string().min(1)).min(1),
  tips: z.string().optional(),
  variants: z.array(recipeVariantSchema).optional(),
});

const planMealSchema = z.object({
  name: z.string().min(1),
  items: z.array(planItemSchema).min(1),
  recipe: mealRecipeSchema.optional(),
});

const planDaySchema = z.object({
  day: z.string().min(1),
  meals: z.array(planMealSchema).min(1),
});

const n8nCallbackSchema = z.object({
  dietPlanId: z.string().cuid(),
  content: z.object({
    days: z.array(planDaySchema).min(1),
  }).passthrough(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
});

// ─── handler ─────────────────────────────────────────────────────────────────

/**
 * POST /webhooks/n8n
 *
 * Receives AI-generated diet plan from n8n workflow callback.
 * Validates X-N8N-Api-Secret header, then processes and saves the plan.
 */
export async function n8nWebhook(req: Request, res: Response): Promise<void> {
  // 1. Verify shared secret
  const expectedSecret = process.env.N8N_API_SECRET;
  if (!expectedSecret) {
    res.status(503).json(apiError('N8N_NOT_CONFIGURED', 'n8n integration is not configured'));
    return;
  }

  const providedSecret = req.headers['x-n8n-api-secret'];
  if (!providedSecret || providedSecret !== expectedSecret) {
    res.status(401).json(apiError('UNAUTHORIZED', 'Invalid or missing X-N8N-Api-Secret header'));
    return;
  }

  // 2. Parse body (n8n webhook sends JSON, but body may be raw Buffer from webhook mount)
  let body: unknown;
  if (Buffer.isBuffer(req.body)) {
    try {
      body = JSON.parse(req.body.toString('utf-8'));
    } catch {
      res.status(400).json(apiError('INVALID_JSON', 'Request body is not valid JSON'));
      return;
    }
  } else {
    body = req.body;
  }

  // 3. Validate payload
  const parsed = n8nCallbackSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join('; ')));
    return;
  }

  // 4. Idempotency check — deduplicate by dietPlanId + aiModel (repair callbacks have different model)
  const idempotencyKey = `${parsed.data.dietPlanId}:${parsed.data.aiModel ?? 'default'}`;
  const isNew = await markEventProcessed('n8n', idempotencyKey, 3600); // 1h TTL
  if (!isNew) {
    // Already processed this plan callback — ack without error so n8n stops retrying
    res.json({ received: true, duplicate: true, dietPlanId: parsed.data.dietPlanId });
    return;
  }

  // 5. Process callback
  try {
    const result = await processN8nCallback(parsed.data as N8nCallbackPayload);

    // If repair was triggered, clear idempotency so the repair callback can come through
    if (result.validationStatus === 'REPAIR_TRIGGERED') {
      await clearEventProcessed('n8n', idempotencyKey);
    }

    // Invalidate cache
    const plan = await prisma.dietPlan.findUnique({
      where: { id: result.dietPlanId },
      select: { patientId: true },
    });
    if (plan) {
      await cacheDel(`cache:diet-plan:latest:${plan.patientId}`);
    }

    logAudit({
      action: 'N8N_PLAN_RECEIVED',
      resourceType: 'DIET_PLAN',
      resourceId: result.dietPlanId,
      ip: req.ip,
    });

    res.json({ received: true, ...result });
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      const appErr = err as { statusCode: number; code: string; message: string };
      res.status(appErr.statusCode).json(apiError(appErr.code, appErr.message));
      return;
    }

    console.error('[n8n-webhook] Processing error:', err);
    res.status(500).json(apiError('WEBHOOK_ERROR', 'Failed to process n8n callback'));
  }
}
