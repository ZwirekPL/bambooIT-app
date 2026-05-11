/**
 * Plan limits configuration (17.6.2).
 *
 * Defines diet generation and meal swap limits per product type.
 * Used by the paywall service to enforce usage limits.
 */

export interface PlanLimits {
  /** Maximum diet plans generated per week (0 = not applicable) */
  maxDietsPerWeek: number;
  /** Maximum meal swaps per week (0 = no swaps allowed) */
  maxSwapsPerWeek: number;
  /** Plan duration in weeks (0 = unlimited/subscription) */
  durationWeeks: number;
  /** Whether this is a recurring subscription */
  isSubscription: boolean;
  /** Price in PLN (0 = free) */
  pricePln: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  FREE_7: {
    maxDietsPerWeek: 0, // 1 plan total (7 days), no weekly generation
    maxSwapsPerWeek: 0,
    durationWeeks: 1,
    isSubscription: false,
    pricePln: 0,
  },
  TRIAL: {
    maxDietsPerWeek: 1,
    maxSwapsPerWeek: 5,
    durationWeeks: 1, // 7-day trial, then auto-converts to OPIEKA_MIESIECZNA
    isSubscription: true,
    pricePln: 0, // free during trial, 129 zł/mo after
  },
  OPIEKA_MIESIECZNA: {
    maxDietsPerWeek: 1,
    maxSwapsPerWeek: 5,
    durationWeeks: 0, // unlimited (subscription)
    isSubscription: true,
    pricePln: 129,
  },
  OPIEKA_ROCZNA: {
    maxDietsPerWeek: 1,
    maxSwapsPerWeek: 5,
    durationWeeks: 0, // unlimited (subscription)
    isSubscription: true,
    pricePln: 99, // 99 zł/mies (1188 zł/rok, -20%)
  },
  PLAN_2W: {
    maxDietsPerWeek: 1,
    maxSwapsPerWeek: 5,
    durationWeeks: 2,
    isSubscription: false,
    pricePln: 129,
  },
  PLAN_4W: {
    maxDietsPerWeek: 1,
    maxSwapsPerWeek: 5,
    durationWeeks: 4,
    isSubscription: false,
    pricePln: 199,
  },
  CONSULTATION: {
    maxDietsPerWeek: 0,
    maxSwapsPerWeek: 0,
    durationWeeks: 0,
    isSubscription: false,
    pricePln: 399,
  },
};

/** Active product types (non-legacy) available for new purchases. */
export const ACTIVE_PRODUCT_TYPES = [
  'FREE_7',
  'TRIAL',
  'TRIAL_YEARLY',
  'OPIEKA_MIESIECZNA',
  'OPIEKA_ROCZNA',
  'PLAN_2W',
  'PLAN_4W',
  'CONSULTATION',
] as const;

export type ActiveProductType = (typeof ACTIVE_PRODUCT_TYPES)[number];

/** Subscription product types (use Stripe subscription mode). */
export const SUBSCRIPTION_PRODUCTS: ActiveProductType[] = ['TRIAL', 'TRIAL_YEARLY', 'OPIEKA_MIESIECZNA', 'OPIEKA_ROCZNA'];

/** Trial product types (subscription with trial_period_days). */
export const TRIAL_PRODUCTS: ActiveProductType[] = ['TRIAL', 'TRIAL_YEARLY'];

/** Trial period in days. */
export const TRIAL_PERIOD_DAYS = 7;

export function isTrialProduct(productType: string): boolean {
  return TRIAL_PRODUCTS.includes(productType as ActiveProductType);
}

export function isSubscriptionProduct(productType: string): boolean {
  return SUBSCRIPTION_PRODUCTS.includes(productType as ActiveProductType);
}

export function getPlanLimits(productType: string): PlanLimits | null {
  return PLAN_LIMITS[productType] ?? null;
}
