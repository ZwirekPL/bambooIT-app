/**
 * Per-dietitian solver settings.
 *
 * Currently exposes the grey-list window (Z1) — how many of the patient's
 * previous DietPlans contribute their recipe IDs to the soft-penalty pool
 * when a regeneration runs. Range 1-4, default 1; 0 disables the feature.
 *
 * Lookup order, per `getGreyListWindow`:
 *   1. DietitianProfile.greyListWindow if a dietitianId is supplied AND
 *      the profile exists.
 *   2. AppSettings key `grey_list_window` (global override across the
 *      whole installation; useful for shadow rollout / admin tuning).
 *   3. Hard-coded fallback DEFAULT_GREY_LIST_WINDOW = 1.
 *
 * Always clamped to [GREY_LIST_WINDOW_MIN, GREY_LIST_WINDOW_MAX].
 */

import { prisma } from '@db';
import { getSetting } from './appSettings.service';

export const GREY_LIST_WINDOW_MIN = 0; // 0 = disabled
export const GREY_LIST_WINDOW_MAX = 4;
export const DEFAULT_GREY_LIST_WINDOW = 1;

export const SETTING_GREY_LIST_WINDOW = 'grey_list_window';

function clamp(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GREY_LIST_WINDOW;
  const rounded = Math.round(value);
  if (rounded < GREY_LIST_WINDOW_MIN) return GREY_LIST_WINDOW_MIN;
  if (rounded > GREY_LIST_WINDOW_MAX) return GREY_LIST_WINDOW_MAX;
  return rounded;
}

export async function getGreyListWindow(dietitianId?: string | null): Promise<number> {
  if (dietitianId) {
    const profile = await prisma.dietitianProfile.findUnique({
      where: { userId: dietitianId },
      select: { greyListWindow: true },
    });
    if (profile && Number.isFinite(profile.greyListWindow)) {
      return clamp(profile.greyListWindow);
    }
  }

  const globalValue = await getSetting<number | null>(SETTING_GREY_LIST_WINDOW, null);
  if (globalValue !== null && Number.isFinite(globalValue)) {
    return clamp(globalValue);
  }

  return DEFAULT_GREY_LIST_WINDOW;
}

/**
 * Build a Set of recipe IDs to grey-list for the given patient by reading
 * `policyMetadata.recipeIds` from the patient's most recent N DietPlans.
 *
 * Returns an empty Set when window=0 (feature disabled) or when the patient
 * has no prior plans (first generation). The returned Set is intentionally
 * deduplicated across all N plans.
 */
export async function getGreyListRecipeIds(
  patientId: string,
  window: number,
  excludePlanId?: string,
): Promise<Set<string>> {
  if (window <= 0) return new Set();

  // DietPlan has no soft-delete column — restrict to "real" statuses the
  // patient actually saw, mirroring `planPipeline.previousDishNames` lookup.
  const plans = await prisma.dietPlan.findMany({
    where: {
      patientId,
      status: { in: ['GENERATED', 'REVIEWED', 'PUBLISHED', 'SENT', 'MANUAL_REVIEW_REQUIRED'] },
      ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: window,
    select: { policyMetadata: true },
  });

  const ids = new Set<string>();
  for (const plan of plans) {
    const meta = plan.policyMetadata as { recipeIds?: unknown } | null;
    const list = meta?.recipeIds;
    if (Array.isArray(list)) {
      for (const id of list) {
        if (typeof id === 'string' && id.length > 0) ids.add(id);
      }
    }
  }
  return ids;
}
