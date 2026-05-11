import { describe, it, expect } from 'vitest';
import {
  getRetentionFactor,
  applyRetention,
  detectCookingMethod,
  getCookingMethodLabel,
} from '../../services/retentionFactors';

// ─── getRetentionFactor ─────────────────────────────────────────────────────

describe('getRetentionFactor', () => {
  it('returns 1.0 for raw', () => {
    expect(getRetentionFactor('raw', 'vitaminC')).toBe(1.0);
  });

  it('returns 1.0 for undefined method', () => {
    expect(getRetentionFactor(undefined, 'vitaminC')).toBe(1.0);
  });

  it('returns correct factor for boiling + vitaminC', () => {
    expect(getRetentionFactor('boiling', 'vitaminC')).toBe(0.50);
  });

  it('returns correct factor for steaming + vitaminC', () => {
    expect(getRetentionFactor('steaming', 'vitaminC')).toBe(0.75);
  });

  it('returns 1.0 for unknown nutrient', () => {
    expect(getRetentionFactor('boiling', 'unknownNutrient')).toBe(1.0);
  });

  it('returns 1.0 for unknown method', () => {
    expect(getRetentionFactor('deep_frying_from_mars', 'vitaminC')).toBe(1.0);
  });

  it('frying has lower vitaminC retention than steaming', () => {
    const frying = getRetentionFactor('frying', 'vitaminC');
    const steaming = getRetentionFactor('steaming', 'vitaminC');
    expect(frying).toBeLessThan(steaming);
  });
});

// ─── applyRetention ─────────────────────────────────────────────────────────

describe('applyRetention', () => {
  it('returns unmodified nutrients for raw', () => {
    const nutrients = { vitaminCMg: 100, ironMg: 10 };
    const result = applyRetention(nutrients, 'raw');
    expect(result.vitaminCMg).toBe(100);
    expect(result.ironMg).toBe(10);
  });

  it('applies retention for boiling', () => {
    const nutrients = { vitaminCMg: 100, calciumMg: 200 };
    const result = applyRetention(nutrients, 'boiling');
    expect(result.vitaminCMg).toBe(50); // 0.50 retention
    expect(result.calciumMg).toBe(170); // 0.85 retention
  });

  it('does not mutate original object', () => {
    const nutrients = { vitaminCMg: 100 };
    applyRetention(nutrients, 'boiling');
    expect(nutrients.vitaminCMg).toBe(100);
  });
});

// ─── detectCookingMethod ────────────────────────────────────────────────────

describe('detectCookingMethod', () => {
  it('detects boiling from Polish text', () => {
    expect(detectCookingMethod(['Ugotuj makaron w osolonej wodzie'])).toBe('boiling');
  });

  it('detects frying from Polish text', () => {
    expect(detectCookingMethod(['Usmaż cebulę na patelni'])).toBe('frying');
  });

  it('detects baking from Polish text', () => {
    expect(detectCookingMethod(['Piecz w piekarniku 180°C przez 30 min'])).toBe('baking');
  });

  it('detects steaming from Polish text', () => {
    expect(detectCookingMethod(['Gotuj na parze przez 15 minut'])).toBe('steaming');
  });

  it('detects grilling from Polish text', () => {
    expect(detectCookingMethod(['Grilluj kurczaka 10 min z każdej strony'])).toBe('grilling');
  });

  it('detects stewing from Polish text', () => {
    expect(detectCookingMethod(['Duś na wolnym ogniu 2 godziny'])).toBe('stewing');
  });

  it('detects microwaving', () => {
    expect(detectCookingMethod(['Podgrzej w mikrofalówce 2 minuty'])).toBe('microwaving');
  });

  it('detects pressure cooking', () => {
    expect(detectCookingMethod(['Gotuj w szybkowarze 20 minut'])).toBe('pressure_cooking');
  });

  it('returns raw for no cooking steps', () => {
    expect(detectCookingMethod(['Wymieszaj składniki', 'Podawaj na zimno'])).toBe('raw');
  });

  it('detects English boil', () => {
    expect(detectCookingMethod(['Boil the pasta for 10 minutes'])).toBe('boiling');
  });
});

// ─── getCookingMethodLabel ──────────────────────────────────────────────────

describe('getCookingMethodLabel', () => {
  it('returns Polish label for raw', () => {
    expect(getCookingMethodLabel('raw')).toBe('Surowe');
  });

  it('returns Polish label for boiling', () => {
    expect(getCookingMethodLabel('boiling')).toBe('Gotowanie');
  });
});
