import { describe, it, expect } from 'vitest';
import {
  computeCanonicalProteinBucket,
  projectProteinSourceToBucket,
} from '../../scraper/utils/proteinSourceCanonical';
import type { RecipeIngredientInput } from '../../scraper/utils/proteinSource';

function ing(name: string, grams: number, proteinPer100g: number | null = 0): RecipeIngredientInput {
  return { name, grams, proteinPer100g };
}

describe('projectProteinSourceToBucket (per-source projection)', () => {
  it('poultry → poultry', () => {
    expect(projectProteinSourceToBucket('poultry')).toBe('poultry');
  });

  it('beef / pork / lamb → red_meat', () => {
    expect(projectProteinSourceToBucket('beef')).toBe('red_meat');
    expect(projectProteinSourceToBucket('pork')).toBe('red_meat');
    expect(projectProteinSourceToBucket('lamb')).toBe('red_meat');
  });

  it('fish + fatty stem → fish_fatty', () => {
    expect(projectProteinSourceToBucket('fish', 'Łosoś atlantycki')).toBe('fish_fatty');
    expect(projectProteinSourceToBucket('fish', 'Makrela wędzona')).toBe('fish_fatty');
    expect(projectProteinSourceToBucket('fish', 'Pstrąg tęczowy')).toBe('fish_fatty');
    expect(projectProteinSourceToBucket('fish', 'Sardynki w oleju')).toBe('fish_fatty');
  });

  it('fish without fatty stem → fish_white', () => {
    expect(projectProteinSourceToBucket('fish', 'Dorsz atlantycki')).toBe('fish_white');
    expect(projectProteinSourceToBucket('fish', 'Mintaj filet')).toBe('fish_white');
    expect(projectProteinSourceToBucket('fish', 'Halibut')).toBe('fish_white');
  });

  it('fish without ingredient name defaults to fish_white', () => {
    expect(projectProteinSourceToBucket('fish')).toBe('fish_white');
    expect(projectProteinSourceToBucket('fish', null)).toBe('fish_white');
  });

  it('seafood / egg / legume / tofu → direct mapping', () => {
    expect(projectProteinSourceToBucket('seafood')).toBe('seafood');
    expect(projectProteinSourceToBucket('egg')).toBe('eggs');
    expect(projectProteinSourceToBucket('legume')).toBe('legumes');
    expect(projectProteinSourceToBucket('tofu')).toBe('tofu');
  });

  it('dairy / nuts / grain / vegetable / other → null (no SC30 bucket)', () => {
    expect(projectProteinSourceToBucket('dairy')).toBeNull();
    expect(projectProteinSourceToBucket('nuts')).toBeNull();
    expect(projectProteinSourceToBucket('grain')).toBeNull();
    expect(projectProteinSourceToBucket('vegetable')).toBeNull();
    expect(projectProteinSourceToBucket('other')).toBeNull();
  });
});

describe('computeCanonicalProteinBucket (recipe-level)', () => {
  it('chicken main → poultry', () => {
    const r = computeCanonicalProteinBucket([
      ing('Pierś z kurczaka', 200, 23),
      ing('Ryż biały', 80, 7),
      ing('Brokuł', 100, 3),
    ]);
    expect(r.bucket).toBe('poultry');
    expect(r.proteinSource).toBe('poultry');
  });

  it('beef stew → red_meat', () => {
    const r = computeCanonicalProteinBucket([
      ing('Wołowina, łopatka', 250, 26),
      ing('Marchew', 100, 1),
      ing('Cebula', 80, 1),
    ]);
    expect(r.bucket).toBe('red_meat');
    expect(r.proteinSource).toBe('beef');
  });

  it('pork roast → red_meat', () => {
    const r = computeCanonicalProteinBucket([
      ing('Schab wieprzowy', 220, 22),
      ing('Ziemniaki', 200, 2),
    ]);
    expect(r.bucket).toBe('red_meat');
    expect(r.proteinSource).toBe('pork');
  });

  it('salmon teriyaki → fish_fatty (fatty stem detected)', () => {
    const r = computeCanonicalProteinBucket([
      ing('Łosoś filet', 200, 20),
      ing('Ryż jaśminowy', 80, 7),
    ]);
    expect(r.bucket).toBe('fish_fatty');
    expect(r.proteinSource).toBe('fish');
    expect(r.topFishIngredient).toContain('Łosoś');
  });

  it('cod with potatoes → fish_white (no fatty stem)', () => {
    const r = computeCanonicalProteinBucket([
      ing('Dorsz atlantycki', 200, 18),
      ing('Ziemniaki', 200, 2),
      ing('Cytryna', 30, 1),
    ]);
    expect(r.bucket).toBe('fish_white');
    expect(r.proteinSource).toBe('fish');
  });

  it('shrimp salad → seafood', () => {
    const r = computeCanonicalProteinBucket([
      ing('Krewetki', 150, 24),
      ing('Sałata', 80, 1),
    ]);
    expect(r.bucket).toBe('seafood');
    expect(r.proteinSource).toBe('seafood');
  });

  it('omelet → eggs', () => {
    const r = computeCanonicalProteinBucket([
      ing('Jajko kurze', 150, 13),
      ing('Pomidor', 80, 1),
      ing('Szpinak', 50, 3),
    ]);
    expect(r.bucket).toBe('eggs');
    expect(r.proteinSource).toBe('egg');
  });

  it('lentil dahl → legumes', () => {
    const r = computeCanonicalProteinBucket([
      ing('Soczewica czerwona', 150, 24),
      ing('Pomidor pelati', 200, 1),
      ing('Cebula', 50, 1),
    ]);
    expect(r.bucket).toBe('legumes');
    expect(r.proteinSource).toBe('legume');
  });

  it('tofu stir-fry → tofu', () => {
    const r = computeCanonicalProteinBucket([
      ing('Tofu', 200, 16),
      ing('Brokuł', 150, 3),
      ing('Sos sojowy', 20, 6),
    ]);
    expect(r.bucket).toBe('tofu');
    expect(r.proteinSource).toBe('tofu');
  });

  it('pure veg side → null bucket', () => {
    const r = computeCanonicalProteinBucket([
      ing('Marchew', 200, 1),
      ing('Ziemniaki', 200, 2),
      ing('Pietruszka', 40, 3),
    ]);
    expect(r.bucket).toBeNull();
    // proteinSource may be 'vegetable' — not in SC30 scope
    expect(['vegetable', 'other']).toContain(r.proteinSource);
  });

  it('twaróg breakfast → null (dairy, not in SC30 scope)', () => {
    const r = computeCanonicalProteinBucket([
      ing('Twaróg chudy', 200, 20),
      ing('Borówki', 100, 0.7),
      ing('Pestki słonecznika', 20, 21),
    ]);
    expect(r.bucket).toBeNull();
    expect(r.proteinSource).toBe('dairy');
  });

  it('ultra-low-protein recipe → null bucket regardless of source', () => {
    const r = computeCanonicalProteinBucket([
      ing('Cytryna sok', 30, 1),
      ing('Ogórek', 50, 0.5),
    ]);
    // total protein < 2g → falls back to 'other' in the upstream classifier
    expect(r.bucket).toBeNull();
  });
});
