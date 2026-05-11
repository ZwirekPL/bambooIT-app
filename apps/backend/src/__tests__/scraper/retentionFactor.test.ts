import { describe, it, expect } from 'vitest';
import {
  classifyCookingMethod,
  retentionFor,
  aggregateRetention,
} from '../../scraper/utils/retentionFactor';

// ─── classifyCookingMethod ─────────────────────────────────────────────────────

describe('classifyCookingMethod', () => {
  it('detects boil from "zagotuj"', () => {
    expect(classifyCookingMethod('Zagotuj wodę w dużym garnku')).toBe('boil');
  });

  it('detects steam from "na parze"', () => {
    expect(classifyCookingMethod('Gotuj na parze przez 10 minut')).toBe('steam');
  });

  it('detects fry from "smażyć"', () => {
    expect(classifyCookingMethod('Smażyć na rozgrzanym oleju')).toBe('fry');
  });

  it('detects bake from "piekarnik"', () => {
    expect(classifyCookingMethod('Włóż do piekarnika rozgrzanego do 180°C')).toBe('bake');
  });

  it('detects deep_fry from "głębokim oleju"', () => {
    expect(classifyCookingMethod('Smażyć w głębokim oleju aż zezłocieje')).toBe('deep_fry');
  });

  it('detects stew from "dusić"', () => {
    expect(classifyCookingMethod('Dusić na wolnym ogniu 30 minut')).toBe('stew');
  });

  it('detects grill', () => {
    expect(classifyCookingMethod('Grillować z obu stron')).toBe('grill');
  });

  it('detects marinate', () => {
    expect(classifyCookingMethod('Marynować przez 2 godziny w lodówce')).toBe('marinate');
  });

  it('detects microwave', () => {
    expect(classifyCookingMethod('Podgrzać w mikrofalówce przez minutę')).toBe('microwave');
  });

  it('returns "unknown" for unrelated text', () => {
    expect(classifyCookingMethod('Podaj na talerzu')).toBe('unknown');
  });

  it('returns "unknown" for empty', () => {
    expect(classifyCookingMethod('')).toBe('unknown');
  });

  it('detects sous_vide', () => {
    expect(classifyCookingMethod('Sous vide przez 2 godziny w 60°C')).toBe('sous_vide');
  });

  it('detects raw', () => {
    expect(classifyCookingMethod('Podać na surowo z oliwą')).toBe('raw');
  });
});

// ─── retentionFor ──────────────────────────────────────────────────────────────

describe('retentionFor', () => {
  it('boil preserves less vit C than steam', () => {
    expect(retentionFor('boil', 'vitC')).toBeLessThan(retentionFor('steam', 'vitC'));
  });

  it('raw has no loss', () => {
    expect(retentionFor('raw', 'vitC')).toBe(1);
    expect(retentionFor('raw', 'vitB1')).toBe(1);
  });

  it('fat-soluble vitamin A more stable than water-soluble vit C during boil', () => {
    // vitA not modeled for boil → returns 1.0 default (stable).
    // vitC explicitly low in boil.
    expect(retentionFor('boil', 'vitA')).toBeGreaterThan(retentionFor('boil', 'vitC'));
  });

  it('deep_fry destroys omega-3 most', () => {
    expect(retentionFor('deep_fry', 'omega3')).toBeLessThan(retentionFor('grill', 'omega3'));
  });

  it('protein always retained (no cooking model for it)', () => {
    expect(retentionFor('deep_fry', 'protein')).toBe(1);
    expect(retentionFor('boil', 'protein')).toBe(1);
  });
});

// ─── aggregateRetention ───────────────────────────────────────────────────────

describe('aggregateRetention', () => {
  it('picks most destructive method across steps', () => {
    const r = aggregateRetention([
      'Pokrój warzywa na kostkę',
      'Gotuj na parze 5 minut',
      'Smaż na patelni w głębokim oleju 3 minuty',
    ]);
    expect(r.primaryMethod).toBe('deep_fry');
    expect(r.methods).toEqual(['unknown', 'steam', 'deep_fry']);
  });

  it('falls back to raw when no cooking detected', () => {
    const r = aggregateRetention([
      'Pokrój pomidory',
      'Wymieszaj z oliwą',
      'Podaj schłodzone',
    ]);
    expect(r.primaryMethod).toBe('raw');
  });

  it('per-nutrient factors reflect primary method', () => {
    const r = aggregateRetention(['Zagotuj wodę i gotuj makaron 10 minut']);
    expect(r.perNutrient.vitC).toBe(retentionFor('boil', 'vitC'));
    expect(r.perNutrient.protein).toBe(1);
  });

  it('single steam step preserves most nutrients', () => {
    const r = aggregateRetention(['Gotuj brokuły na parze 5 minut']);
    expect(r.primaryMethod).toBe('steam');
    expect(r.perNutrient.vitC).toBeGreaterThanOrEqual(0.7);
  });
});
