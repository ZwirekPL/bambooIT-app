/**
 * Faza D Phase 2 prep — tests for `isComposeMealsEnabledFor`.
 *
 * Resolution order:
 *   1. ENABLE_3_TUPLE_COMPOSITION=true  → global ON
 *   2. COMPOSE_MEALS_PATIENT_IDS includes patientId → opt-in
 *   3. else → OFF
 *
 * The helper caches the parsed allowlist keyed on the env-string itself,
 * so the cache auto-invalidates when the env var changes between calls.
 * `_resetComposeMealsFlagCache` is exported for tests that want to be
 * extra-explicit; the cache contract makes it optional.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isComposeMealsEnabledFor,
  _resetComposeMealsFlagCache,
} from '../../utils/composeMealsFlag';

const ENV_KEYS = ['ENABLE_3_TUPLE_COMPOSITION', 'COMPOSE_MEALS_PATIENT_IDS'] as const;

describe('isComposeMealsEnabledFor', () => {
  let savedEnv: Partial<Record<typeof ENV_KEYS[number], string | undefined>> = {};

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    _resetComposeMealsFlagCache();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    _resetComposeMealsFlagCache();
  });

  // ── 1. Global flag ────────────────────────────────────────────────────────

  it('returns true when ENABLE_3_TUPLE_COMPOSITION=true (any patientId)', () => {
    process.env.ENABLE_3_TUPLE_COMPOSITION = 'true';
    expect(isComposeMealsEnabledFor('any_patient_id')).toBe(true);
    expect(isComposeMealsEnabledFor('')).toBe(true);   // global wins even on empty id
  });

  it('treats values other than "true" as off', () => {
    process.env.ENABLE_3_TUPLE_COMPOSITION = '1';
    expect(isComposeMealsEnabledFor('p1')).toBe(false);

    process.env.ENABLE_3_TUPLE_COMPOSITION = 'TRUE';
    expect(isComposeMealsEnabledFor('p1')).toBe(false);

    process.env.ENABLE_3_TUPLE_COMPOSITION = 'yes';
    expect(isComposeMealsEnabledFor('p1')).toBe(false);
  });

  // ── 2. Per-patient allowlist ──────────────────────────────────────────────

  it('returns true when patientId is in COMPOSE_MEALS_PATIENT_IDS', () => {
    process.env.COMPOSE_MEALS_PATIENT_IDS = 'patient_a,patient_b,patient_c';
    expect(isComposeMealsEnabledFor('patient_a')).toBe(true);
    expect(isComposeMealsEnabledFor('patient_b')).toBe(true);
    expect(isComposeMealsEnabledFor('patient_c')).toBe(true);
  });

  it('returns false for patients NOT on the allowlist', () => {
    process.env.COMPOSE_MEALS_PATIENT_IDS = 'patient_a,patient_b';
    expect(isComposeMealsEnabledFor('patient_c')).toBe(false);
    expect(isComposeMealsEnabledFor('not_listed')).toBe(false);
  });

  it('trims whitespace around comma-separated IDs', () => {
    process.env.COMPOSE_MEALS_PATIENT_IDS = ' patient_a , patient_b ,  patient_c';
    expect(isComposeMealsEnabledFor('patient_a')).toBe(true);
    expect(isComposeMealsEnabledFor('patient_b')).toBe(true);
    expect(isComposeMealsEnabledFor('patient_c')).toBe(true);
  });

  it('handles empty allowlist string gracefully', () => {
    process.env.COMPOSE_MEALS_PATIENT_IDS = '';
    expect(isComposeMealsEnabledFor('p1')).toBe(false);
  });

  it('handles allowlist with empty entries from trailing commas', () => {
    process.env.COMPOSE_MEALS_PATIENT_IDS = 'patient_a,,,patient_b,';
    expect(isComposeMealsEnabledFor('patient_a')).toBe(true);
    expect(isComposeMealsEnabledFor('patient_b')).toBe(true);
    expect(isComposeMealsEnabledFor('')).toBe(false);   // never match the empty string
  });

  // ── 3. Off by default ─────────────────────────────────────────────────────

  it('returns false when neither env var is set', () => {
    expect(isComposeMealsEnabledFor('any_patient')).toBe(false);
  });

  it('returns false on empty patientId without global flag', () => {
    process.env.COMPOSE_MEALS_PATIENT_IDS = 'patient_a';
    expect(isComposeMealsEnabledFor('')).toBe(false);
  });

  // ── 4. Global flag beats allowlist ────────────────────────────────────────

  it('global ON overrides allowlist (covers Phase 4 default-on path)', () => {
    process.env.ENABLE_3_TUPLE_COMPOSITION = 'true';
    process.env.COMPOSE_MEALS_PATIENT_IDS = 'only_this_one';
    // Anyone — including non-listed patients — gets compose mode
    expect(isComposeMealsEnabledFor('only_this_one')).toBe(true);
    expect(isComposeMealsEnabledFor('not_listed')).toBe(true);
  });

  // ── 5. Cache auto-invalidates when env var changes ───────────────────────

  it('auto-invalidates cache when COMPOSE_MEALS_PATIENT_IDS changes', () => {
    process.env.COMPOSE_MEALS_PATIENT_IDS = 'patient_a';
    expect(isComposeMealsEnabledFor('patient_a')).toBe(true);
    expect(isComposeMealsEnabledFor('patient_b')).toBe(false);

    // Change env mid-process — cache key is the env string itself
    process.env.COMPOSE_MEALS_PATIENT_IDS = 'patient_b';
    expect(isComposeMealsEnabledFor('patient_a')).toBe(false);
    expect(isComposeMealsEnabledFor('patient_b')).toBe(true);
  });
});
