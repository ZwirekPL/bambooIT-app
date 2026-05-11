import crypto from 'crypto';
import { prisma } from '@db';
import { encryptJson, decryptJson } from '../utils/encryption';
import type { PlanContent } from './planValidation.service';
import type { UserSegment } from './segmentation.service';

// ─── types ──────────────────────────────────────────────────────────────────

export type CacheDecision = 'EXACT_HIT' | 'SIMILAR_HIT' | 'MISS';

export interface CacheCheckResult {
  decision: CacheDecision;
  templateId?: string;
  content?: PlanContent;
  /** Original kcal of the template (for rescaled hits) */
  templateKcal?: number;
}

export interface CacheMetrics {
  totalTemplates: number;
  activeTemplates: number;
  totalLookups: number;
  exactHits: number;
  similarHits: number;
  misses: number;
  hitRate: number;
  exactHitRate: number;
  estimatedSavingsUsd: number;
  topSegments: Array<{
    id: string;
    segmentHash: string;
    goal: string;
    kcalBucket: number;
    dietType: string;
    usageCount: number;
  }>;
}

// Average cost per full AI generation (estimation)
const AVG_COST_PER_GENERATION_USD = 0.05;

// ─── segment hash ───────────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 hash from segment components.
 * Includes diseases for clinical cache differentiation.
 */
export function computeSegmentHash(params: {
  goal: string;
  kcalBucket: number;
  dietType: string;
  allergies: string[];
  diseases: string[];
  mealCount: number;
}): string {
  const sortedAllergies = [...params.allergies].sort().join(',');
  const sortedDiseases = [...params.diseases].sort().join(',');
  const raw = [
    params.goal,
    params.kcalBucket,
    params.dietType,
    sortedAllergies,
    sortedDiseases,
    params.mealCount,
  ].join('|');

  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ─── lookup ─────────────────────────────────────────────────────────────────

/**
 * Find an exact template match by segment hash.
 * Increments usage count on hit.
 */
async function findExactTemplate(segmentHash: string): Promise<CacheCheckResult> {
  const template = await prisma.dietTemplate.findFirst({
    where: { segmentHash, isActive: true },
  });

  if (!template) {
    return { decision: 'MISS' };
  }

  // Increment usage
  await prisma.dietTemplate.update({
    where: { id: template.id },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  const content = decryptJson(template.content) as PlanContent;

  return {
    decision: 'EXACT_HIT',
    templateId: template.id,
    content,
    templateKcal: template.kcal,
  };
}

/**
 * Find a similar template (same goal, dietType, allergies, diseases, mealCount)
 * with kcalBucket within ±10% of target.
 */
async function findSimilarTemplate(params: {
  goal: string;
  kcalBucket: number;
  dietType: string;
  allergies: string[];
  diseases: string[];
  mealCount: number;
}): Promise<CacheCheckResult> {
  const minKcal = Math.round(params.kcalBucket * 0.9);
  const maxKcal = Math.round(params.kcalBucket * 1.1);
  const sortedAllergies = [...params.allergies].sort();
  const sortedDiseases = [...params.diseases].sort();

  // Find templates with matching attributes and kcal within range
  const candidates = await prisma.dietTemplate.findMany({
    where: {
      goal: params.goal,
      dietType: params.dietType,
      mealCount: params.mealCount,
      kcalBucket: { gte: minKcal, lte: maxKcal },
      isActive: true,
    },
    orderBy: { usageCount: 'desc' },
    take: 10,
  });

  // Filter by exact allergy and disease match (PostgreSQL array equality)
  const match = candidates.find((t) => {
    const tAllergies = [...t.allergies].sort();
    const tDiseases = [...t.diseases].sort();
    return (
      tAllergies.length === sortedAllergies.length &&
      tAllergies.every((a, i) => a === sortedAllergies[i]) &&
      tDiseases.length === sortedDiseases.length &&
      tDiseases.every((d, i) => d === sortedDiseases[i])
    );
  });

  if (!match) {
    return { decision: 'MISS' };
  }

  // Increment usage
  await prisma.dietTemplate.update({
    where: { id: match.id },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  const content = decryptJson(match.content) as PlanContent;
  const rescaled = rescalePortions(content, match.kcal, params.kcalBucket);

  return {
    decision: 'SIMILAR_HIT',
    templateId: match.id,
    content: rescaled,
    templateKcal: match.kcal,
  };
}

// ─── rescale ────────────────────────────────────────────────────────────────

/**
 * Proportionally rescale all portion sizes and macros in a plan.
 */
export function rescalePortions(content: PlanContent, fromKcal: number, toKcal: number): PlanContent {
  if (fromKcal === 0 || fromKcal === toKcal) return content;

  const factor = toKcal / fromKcal;

  return {
    ...content,
    generatedFrom: 'cached_template_rescaled',
    days: content.days.map((day) => ({
      ...day,
      meals: day.meals.map((meal) => ({
        ...meal,
        items: meal.items.map((item) => ({
          ...item,
          grams: Math.round(item.grams * factor),
          kcal: Math.round(item.kcal * factor),
          protein: Math.round(item.protein * factor * 10) / 10,
          fat: Math.round(item.fat * factor * 10) / 10,
          carbs: Math.round(item.carbs * factor * 10) / 10,
        })),
      })),
    })),
  };
}

// ─── main check ─────────────────────────────────────────────────────────────

/**
 * Check the diet template cache for this patient's segment.
 * Tries exact match first, then similar match.
 */
export async function checkTemplateCache(
  segment: UserSegment,
  diseases: string[],
): Promise<CacheCheckResult> {
  const params = {
    goal: segment.goal,
    kcalBucket: segment.kcalBucket,
    dietType: segment.dietType,
    allergies: segment.allergies,
    diseases,
    mealCount: segment.mealCount,
  };

  const hash = computeSegmentHash(params);

  // 1. Exact match
  const exact = await findExactTemplate(hash);
  if (exact.decision === 'EXACT_HIT') return exact;

  // 2. Similar match (±10% kcal)
  return findSimilarTemplate(params);
}

// ─── save template ──────────────────────────────────────────────────────────

/**
 * Save a validated diet plan as a reusable template.
 * Uses upsert — if a template with the same segment hash already exists,
 * it updates only if the new plan has a higher quality score.
 */
export async function saveAsTemplate(params: {
  dietPlanId: string;
  content: PlanContent;
  segment: UserSegment;
  diseases: string[];
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  aiModel?: string;
}): Promise<string | null> {
  const sortedAllergies = [...params.segment.allergies].sort();
  const sortedDiseases = [...params.diseases].sort();

  const hash = computeSegmentHash({
    goal: params.segment.goal,
    kcalBucket: params.segment.kcalBucket,
    dietType: params.segment.dietType,
    allergies: sortedAllergies,
    diseases: sortedDiseases,
    mealCount: params.segment.mealCount,
  });

  const encrypted = encryptJson(params.content as Record<string, unknown>);

  const existing = await prisma.dietTemplate.findUnique({
    where: { segmentHash: hash },
    select: { id: true, qualityScore: true },
  });

  // Don't overwrite higher-quality templates
  if (existing && existing.qualityScore > 0) {
    return existing.id;
  }

  const template = await prisma.dietTemplate.upsert({
    where: { segmentHash: hash },
    create: {
      segmentHash: hash,
      goal: params.segment.goal,
      kcalBucket: params.segment.kcalBucket,
      dietType: params.segment.dietType,
      allergies: sortedAllergies,
      diseases: sortedDiseases,
      mealCount: params.segment.mealCount,
      content: encrypted,
      kcal: params.kcal,
      proteinG: params.proteinG,
      fatG: params.fatG,
      carbsG: params.carbsG,
      sourceAiModel: params.aiModel,
      sourceDietPlanId: params.dietPlanId,
    },
    update: {
      content: encrypted,
      kcal: params.kcal,
      proteinG: params.proteinG,
      fatG: params.fatG,
      carbsG: params.carbsG,
      sourceAiModel: params.aiModel,
      sourceDietPlanId: params.dietPlanId,
    },
  });

  return template.id;
}

// ─── metrics ────────────────────────────────────────────────────────────────

/**
 * Get cache performance metrics from AiUsageLog and DietTemplate.
 */
export async function getCacheMetrics(): Promise<CacheMetrics> {
  const [totalTemplates, activeTemplates, logs, topSegments] = await Promise.all([
    prisma.dietTemplate.count(),
    prisma.dietTemplate.count({ where: { isActive: true } }),
    prisma.aiUsageLog.groupBy({
      by: ['source'],
      _count: true,
    }),
    prisma.dietTemplate.findMany({
      where: { isActive: true },
      orderBy: { usageCount: 'desc' },
      take: 10,
      select: {
        id: true,
        segmentHash: true,
        goal: true,
        kcalBucket: true,
        dietType: true,
        usageCount: true,
      },
    }),
  ]);

  let exactHits = 0;
  let similarHits = 0;
  let totalLookups = 0;

  for (const log of logs) {
    const count = log._count;
    totalLookups += count;
    if (log.source === 'cached_template') exactHits = count;
    if (log.source === 'cached_template_rescaled') similarHits = count;
  }

  const hitRate = totalLookups > 0 ? ((exactHits + similarHits) / totalLookups) * 100 : 0;
  const exactHitRate = totalLookups > 0 ? (exactHits / totalLookups) * 100 : 0;

  return {
    totalTemplates,
    activeTemplates,
    totalLookups,
    exactHits,
    similarHits,
    misses: totalLookups - exactHits - similarHits,
    hitRate: Math.round(hitRate * 100) / 100,
    exactHitRate: Math.round(exactHitRate * 100) / 100,
    estimatedSavingsUsd: Math.round(exactHits * AVG_COST_PER_GENERATION_USD * 100) / 100,
    topSegments,
  };
}
