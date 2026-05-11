import { describe, it, expect } from 'vitest';
import {
  getNormsForPatient,
  assessNutrientStatus,
  getTarget,
} from '../../services/dietaryNorms';

// ─── getNormsForPatient ─────────────────────────────────────────────────────

describe('getNormsForPatient', () => {
  it('returns norms for adult male 30y', () => {
    const norms = getNormsForPatient('M', 30);
    expect(norms.sex).toBe('M');
    expect(norms.nutrients.length).toBeGreaterThan(0);
  });

  it('returns norms for adult female 25y', () => {
    const norms = getNormsForPatient('F', 25);
    expect(norms.sex).toBe('F');
    expect(norms.nutrients.length).toBeGreaterThan(0);
  });

  it('returns pregnancy norms when pregnancy=true', () => {
    const norms = getNormsForPatient('female', 28, true);
    expect(norms.specialState).toBe('pregnancy');
  });

  it('returns lactation norms when lactation=true', () => {
    const norms = getNormsForPatient('female', 28, false, true);
    expect(norms.specialState).toBe('lactation');
  });

  it('returns default norms when sex is null', () => {
    const norms = getNormsForPatient(null, 30);
    expect(norms.nutrients.length).toBeGreaterThan(0);
  });

  it('returns child norms for age 10', () => {
    const norms = getNormsForPatient('M', 10);
    expect(norms.nutrients.length).toBeGreaterThan(0);
  });

  it('returns senior norms for age 70', () => {
    const norms = getNormsForPatient('F', 70);
    expect(norms.nutrients.length).toBeGreaterThan(0);
  });

  it('all nutrients have a label and unit', () => {
    const norms = getNormsForPatient('male', 30);
    for (const n of norms.nutrients) {
      expect(n.label).toBeTruthy();
      expect(n.unit).toBeTruthy();
      expect(n.nutrientKey).toBeTruthy();
    }
  });
});

// ─── getTarget ──────────────────────────────────────────────────────────────

describe('getTarget', () => {
  it('returns RDA if available', () => {
    const norm = { nutrientKey: 'calciumMg', label: 'Wapń', unit: 'mg', rda: 1000, ai: 800, ear: 800 };
    expect(getTarget(norm)).toBe(1000);
  });

  it('returns AI if RDA not available', () => {
    const norm = { nutrientKey: 'potassiumMg', label: 'Potas', unit: 'mg', ai: 3500 };
    expect(getTarget(norm)).toBe(3500);
  });

  it('returns null if neither RDA nor AI', () => {
    const norm = { nutrientKey: 'test', label: 'Test', unit: 'mg' };
    expect(getTarget(norm)).toBeNull();
  });
});

// ─── assessNutrientStatus ───────────────────────────────────────────────────

describe('assessNutrientStatus', () => {
  const norm = {
    nutrientKey: 'calciumMg',
    label: 'Wapń',
    unit: 'mg',
    ear: 800,
    rda: 1000,
    ul: 2500,
  };

  it('returns ADEQUATE for intake between RDA and UL', () => {
    expect(assessNutrientStatus(1200, norm)).toBe('ADEQUATE');
  });

  it('returns DEFICIENT for intake below EAR', () => {
    expect(assessNutrientStatus(500, norm)).toBe('DEFICIENT');
  });

  it('returns SUBOPTIMAL for intake between EAR and RDA', () => {
    expect(assessNutrientStatus(900, norm)).toBe('SUBOPTIMAL');
  });

  it('returns EXCESSIVE for intake above UL', () => {
    expect(assessNutrientStatus(3000, norm)).toBe('EXCESSIVE');
  });

  it('returns ADEQUATE at exactly RDA', () => {
    expect(assessNutrientStatus(1000, norm)).toBe('ADEQUATE');
  });
});
