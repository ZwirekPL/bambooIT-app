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

