/**
 * Tests for 28.0 — Pipeline verification after interview rebuild (28.0.PRE)
 *
 * 28.0.1 — New interview fields (cuisinePreferences, dislikedFoods, cookingTime,
 *           activityTypes) are correctly extracted by buildPatientContext()
 * 28.0.2 — Old patient without new fields → no errors, defaults to undefined/empty
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── hoisted mocks ──────────────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  patient: { findUnique: vi.fn() },
}));

vi.mock('@db', () => ({
  prisma: { patient: m.patient },
  Prisma: {},
}));

// Encryption mock — return the object as-is (already decrypted in tests)
vi.mock('../../utils/encryption', () => ({
  encryptJson: (v: unknown) => v,
  decryptJson: (v: unknown) => v,
}));

// PII sanitizer — passthrough
vi.mock('../../utils/pii', () => ({
  sanitizePii: (v: string | undefined) => v,
}));

import { buildPatientContext } from '../../policies/policy-engine';

// ── fixtures ───────────────────────────────────────────────────────────────────

const BASE_TARGETS = {
  id: 'nt-1',
  patientId: 'p-1',
  bmr: 1700,
  tdee: 2100,
  targetKcal: 1680,
  targetProteinG: 140,
  targetFatG: 55,
  targetCarbsG: 168,
  activityLevel: 'moderate',
  goal: 'lose_weight',
  ageYears: 30,
  weightKg: 80,
  heightCm: 180,
  breakdown: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makePatient = (answers: Record<string, unknown>) => ({
  id: 'p-1',
  userId: 'u-1',
  sex: 'MALE',
  birthYear: 1994,
  birthDate: null,
  heightCm: 180,
  weightKg: 80,
  dietitianId: null,
  nutritionTargets: BASE_TARGETS,
  user: { id: 'u-1' },
  interviews: [
    {
      type: 'CORE',
      answers, // already decrypted by mock
    },
  ],
});

// ── 28.0.1 — new interview fields ─────────────────────────────────────────────

describe('buildPatientContext — new fields from 28.0.PRE (28.0.1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts cuisinePreferences from answers', async () => {
    m.patient.findUnique.mockResolvedValue(
      makePatient({ cuisinePreferences: ['italian', 'mediterranean'], mealsPerDay: 4 }),
    );
    const ctx = await buildPatientContext('p-1');
    expect(ctx).not.toBeNull();
    expect(ctx!.cuisinePreferences).toEqual(['italian', 'mediterranean']);
  });

  it('extracts dislikedFoods from answers', async () => {
    m.patient.findUnique.mockResolvedValue(
      makePatient({ dislikedFoods: ['mushrooms', 'olives'], mealsPerDay: 4 }),
    );
    const ctx = await buildPatientContext('p-1');
    expect(ctx!.dislikedFoods).toEqual(['mushrooms', 'olives']);
  });

  it('extracts cookingTime from answers', async () => {
    m.patient.findUnique.mockResolvedValue(
      makePatient({ cookingTime: 'quick', mealsPerDay: 4 }),
    );
    const ctx = await buildPatientContext('p-1');
    expect(ctx!.cookingTime).toBe('quick');
  });

  it('extracts activityTypes from answers', async () => {
    m.patient.findUnique.mockResolvedValue(
      makePatient({ activityTypes: ['crossfit', 'cycling'], workoutsPerWeek: 3, workoutDurationMin: 60, mealsPerDay: 4 }),
    );
    const ctx = await buildPatientContext('p-1');
    expect(ctx!.activityTypes).toEqual(['crossfit', 'cycling']);
    expect(ctx!.workoutsPerWeek).toBe(3);
    expect(ctx!.workoutDurationMin).toBe(60);
  });

  it('full new-interview answers → all fields present without errors', async () => {
    m.patient.findUnique.mockResolvedValue(
      makePatient({
        mealsPerDay: 5,
        dietType: 'omnivore',
        chronicDiseases: ['hypertension'],
        allergies: ['gluten'],
        cuisinePreferences: ['polish', 'asian'],
        dislikedFoods: ['liver'],
        cookingTime: 'moderate',
        budget: 'medium',
        activityTypes: ['swimming'],
        workoutsPerWeek: 2,
        workoutDurationMin: 45,
        alcoholFrequency: 'rarely',
        workType: 'sedentary',
        mealRhythm: 'regular',
      }),
    );
    const ctx = await buildPatientContext('p-1');
    expect(ctx).not.toBeNull();
    expect(ctx!.cuisinePreferences).toEqual(['polish', 'asian']);
    expect(ctx!.dislikedFoods).toEqual(['liver']);
    expect(ctx!.activityTypes).toEqual(['swimming']);
    expect(ctx!.alcoholFrequency).toBe('rarely');
    expect(ctx!.workType).toBe('sedentary');
  });
});

// ── 28.0.2 — old patient without new fields ───────────────────────────────────

describe('buildPatientContext — old patient without new fields (28.0.2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns non-null context even without new PRE fields', async () => {
    m.patient.findUnique.mockResolvedValue(
      makePatient({ mealsPerDay: 3, dietType: 'omnivore', chronicDiseases: [] }),
    );
    const ctx = await buildPatientContext('p-1');
    expect(ctx).not.toBeNull();
  });

  it('cuisinePreferences falls back to undefined when missing', async () => {
    m.patient.findUnique.mockResolvedValue(makePatient({ mealsPerDay: 3 }));
    const ctx = await buildPatientContext('p-1');
    expect(ctx!.cuisinePreferences).toBeUndefined();
  });

  it('dislikedFoods falls back to undefined when missing', async () => {
    m.patient.findUnique.mockResolvedValue(makePatient({ mealsPerDay: 3 }));
    const ctx = await buildPatientContext('p-1');
    expect(ctx!.dislikedFoods).toBeUndefined();
  });

  it('cookingTime falls back to undefined when missing', async () => {
    m.patient.findUnique.mockResolvedValue(makePatient({ mealsPerDay: 3 }));
    const ctx = await buildPatientContext('p-1');
    expect(ctx!.cookingTime).toBeUndefined();
  });

  it('activityTypes falls back to undefined when missing', async () => {
    m.patient.findUnique.mockResolvedValue(makePatient({ mealsPerDay: 3 }));
    const ctx = await buildPatientContext('p-1');
    expect(ctx!.activityTypes).toBeUndefined();
  });

  it('workoutsPerWeek and workoutDurationMin fall back to undefined', async () => {
    m.patient.findUnique.mockResolvedValue(makePatient({ mealsPerDay: 3 }));
    const ctx = await buildPatientContext('p-1');
    expect(ctx!.workoutsPerWeek).toBeUndefined();
    expect(ctx!.workoutDurationMin).toBeUndefined();
  });

  it('minimal old-style interview (only mealsPerDay) → no throw', async () => {
    m.patient.findUnique.mockResolvedValue(makePatient({ posilkiDziennie: 3 }));
    await expect(buildPatientContext('p-1')).resolves.not.toThrow();
  });
});
