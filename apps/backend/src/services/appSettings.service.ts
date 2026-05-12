// ─── App Settings Service (29.0) ─────────────────────────────────────────────
//
// Key-value store for global application settings.
// Settings are stored in the `AppSettings` table (key: string PK, value: Json).

import { prisma } from '@db';

/**
 * Get a setting by key. Returns the parsed JSON value, or `defaultValue` if not found.
 */
export async function getSetting<T = unknown>(key: string, defaultValue: T): Promise<T> {
  const row = await prisma.appSettings.findUnique({ where: { key } });
  if (!row) return defaultValue;
  return row.value as T;
}

/**
 * Set a setting by key. Creates or updates (upsert).
 */
export async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

/**
 * Get all settings as a Record<key, value>.
 */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.appSettings.findMany();
  const result: Record<string, unknown> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

// ─── Well-known keys ─────────────────────────────────────────────────────────

export const SETTING_PAYWALL_ENABLED = 'paywall_enabled';

/** VAT configuration (70.1) */
export const SETTING_VAT_ENABLED = 'vat_enabled';
export const SETTING_VAT_RATE = 'vat_rate';

/** Cost report settings (70.5) */
export const SETTING_STRIPE_FEE_PERCENT = 'stripe_fee_percent';
export const SETTING_STRIPE_FEE_FIXED_PLN = 'stripe_fee_fixed_pln';
export const SETTING_USD_TO_PLN_RATE = 'usd_to_pln_rate';

/** Scoring weights (76a) */
export const SETTING_SCORING_WEIGHTS = 'scoring_weights';

export interface ScoringWeights {
  nutritionFit: number;
  quality: number;
  // TODO(K9-cleanup): appSettings.patientRating to diet-specific feature
  // (klient ocenia dietetyka) — DROP całkowicie w K9, NIE rename do
  // companyRating. bambooIT nie ma analogu (klient może zostawić
  // Testimonial, ale to inny model).
  patientRating: number;
  cuisine: number;
  season: number;
  diversity: number;
  cost: number; // kept for backwards compat (ignored in scoring)
  microFit: number;
  practicalFit: number;
  satietyProxy: number;
  interaction: number;
  compliance: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  nutritionFit: 0.32,
  quality: 0.08,
  // TODO(K9-cleanup): patientRating diet residue — drop całkowicie w K9
  // (NIE rename do companyRating; bambooIT używa Testimonial).
  patientRating: 0.08,
  cuisine: 0.07,
  season: 0.05,
  diversity: 0.07,
  cost: 0,
  microFit: 0.11,
  practicalFit: 0.07,
  satietyProxy: 0.05,
  interaction: 0.05,
  compliance: 0.05,
};

/** All weight keys in order. */
export const SCORING_WEIGHT_KEYS = Object.keys(DEFAULT_SCORING_WEIGHTS) as (keyof ScoringWeights)[];

/**
 * Get scoring weights from AppSettings, merged with defaults.
 * Optionally applies per-dietitian overrides on top.
 */
export async function getScoringWeights(
  dietitianOverride?: Partial<ScoringWeights> | null,
): Promise<ScoringWeights> {
  const stored = await getSetting<Partial<ScoringWeights>>(SETTING_SCORING_WEIGHTS, {});
  const merged = { ...DEFAULT_SCORING_WEIGHTS, ...stored };
  if (dietitianOverride) {
    for (const key of SCORING_WEIGHT_KEYS) {
      if (dietitianOverride[key] !== undefined) {
        merged[key] = dietitianOverride[key]!;
      }
    }
  }
  return merged;
}

export interface VatConfig {
  vatEnabled: boolean;
  vatRate: number;
}

export async function getVatConfig(): Promise<VatConfig> {
  const [enabled, rate] = await Promise.all([
    getSetting<boolean>(SETTING_VAT_ENABLED, false),
    getSetting<number>(SETTING_VAT_RATE, 23),
  ]);
  return { vatEnabled: enabled, vatRate: rate };
}

