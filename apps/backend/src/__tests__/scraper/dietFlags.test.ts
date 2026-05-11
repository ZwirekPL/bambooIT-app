import { describe, it, expect } from 'vitest';
import { computeDietFlags, type DietFlagInput, type DietFlagCode } from '../../scraper/utils/dietFlags';

function byCode(results: ReturnType<typeof computeDietFlags>, code: DietFlagCode) {
  return results.find((r) => r.code === code)!;
}

function mk(overrides: Partial<DietFlagInput> = {}): DietFlagInput {
  return {
    ingredientNames: [],
    nutrition: {
      calories: 400, protein: 20, fat: 15, saturatedFat: 4, carbs: 40,
      sugar: 8, fiber: 5, sodium: 450, cholesterol: 40,
    },
    ...overrides,
  };
}

// ─── Vegetarian / vegan / pescatarian ──────────────────────────────────────────

describe('vegetarian / vegan', () => {
  it('plant-only → vegetarian + vegan', () => {
    const r = computeDietFlags(mk({
      ingredientNames: ['Soczewica', 'Cebula', 'Marchew', 'Oliwa z oliwek'],
    }));
    expect(byCode(r, 'vegetarian').value).toBe(true);
    expect(byCode(r, 'vegan').value).toBe(true);
  });

  it('with eggs → vegetarian, not vegan', () => {
    const r = computeDietFlags(mk({
      ingredientNames: ['Jajka', 'Szpinak', 'Ser feta'],
    }));
    expect(byCode(r, 'vegetarian').value).toBe(true);
    expect(byCode(r, 'vegan').value).toBe(false);
  });

  it('with chicken → neither', () => {
    const r = computeDietFlags(mk({
      ingredientNames: ['Pierś z kurczaka', 'Ryż', 'Brokuł'],
    }));
    expect(byCode(r, 'vegetarian').value).toBe(false);
    expect(byCode(r, 'vegan').value).toBe(false);
  });

  it('with veal stock ("Bulion cielęcy") → not vegetarian/vegan', () => {
    // Regression: 'cielec' stem must catch adjective forms (cielęcy/cielęca/cielęce),
    // not just nouns (cielęcina).
    const r = computeDietFlags(mk({
      ingredientNames: ['Dynia', 'Bulion cielęcy', 'Pestki słonecznika'],
    }));
    expect(byCode(r, 'vegetarian').value).toBe(false);
    expect(byCode(r, 'vegan').value).toBe(false);
    expect(byCode(r, 'goutFriendly').value).toBe(false);
  });

  it('pescatarian: no meat but fish OK', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Łosoś', 'Ryż', 'Brokuł'] }));
    expect(byCode(r, 'pescatarian').value).toBe(true);
    expect(byCode(r, 'vegetarian').value).toBe(false);
  });
});

// ─── Allergen-derived flags ────────────────────────────────────────────────────

describe('gluten-free / lactose-free', () => {
  it('gluten-free when no wheat/rye/barley/spelt', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Ryż', 'Warzywa', 'Łosoś'] }));
    expect(byCode(r, 'glutenFree').value).toBe(true);
  });

  it('not gluten-free with pszenica', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Mąka pszenna', 'Jajka'] }));
    expect(byCode(r, 'glutenFree').value).toBe(false);
  });

  it('not gluten-free with croissant or rogal', () => {
    // Regression: bakery items by name should match GLUTEN_WORDS without
    // requiring 'pszenic'/'maka' to appear in the ingredient label.
    expect(byCode(
      computeDietFlags(mk({ ingredientNames: ['Croissant pełnoziarnisty', 'Twaróg'] })),
      'glutenFree',
    ).value).toBe(false);
    expect(byCode(
      computeDietFlags(mk({ ingredientNames: ['Rogal maślany', 'Dżem'] })),
      'glutenFree',
    ).value).toBe(false);
  });

  it('lactose-free with no dairy', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Ryż', 'Warzywa'] }));
    expect(byCode(r, 'lactoseFree').value).toBe(true);
  });

  it('not lactose-free with jogurt', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Jogurt grecki', 'Miód'] }));
    expect(byCode(r, 'lactoseFree').value).toBe(false);
  });
});

// ─── Nutrition-thresholded flags ──────────────────────────────────────────────

describe('lowSodium / lowSugar / lowCarb / lowFat', () => {
  it('lowSodium when < 400 mg', () => {
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, sodium: 350 } })), 'lowSodium').value).toBe(true);
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, sodium: 500 } })), 'lowSodium').value).toBe(false);
  });

  it('lowSugar when < 5 g', () => {
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, sugar: 3 } })), 'lowSugar').value).toBe(true);
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, sugar: 10 } })), 'lowSugar').value).toBe(false);
  });

  it('lowCarb when < 20 g', () => {
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, carbs: 15 } })), 'lowCarb').value).toBe(true);
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, carbs: 50 } })), 'lowCarb').value).toBe(false);
  });

  it('lowFat when < 10 g', () => {
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, fat: 5 } })), 'lowFat').value).toBe(true);
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, fat: 25 } })), 'lowFat').value).toBe(false);
  });
});

describe('highProtein / highFiber', () => {
  it('highProtein requires ≥20g AND ≥20% kcal', () => {
    // 25g protein = 100 kcal out of 400 = 25% → PASS
    expect(byCode(
      computeDietFlags(mk({ nutrition: { calories: 400, protein: 25, fat: 10, carbs: 30, sugar: 5, fiber: 4, sodium: 300, saturatedFat: 3 } })),
      'highProtein',
    ).value).toBe(true);
    // 20g protein = 80 kcal out of 600 = 13% → FAIL (share guard)
    expect(byCode(
      computeDietFlags(mk({ nutrition: { calories: 600, protein: 20, fat: 30, carbs: 50, sugar: 10, fiber: 3, sodium: 300, saturatedFat: 5 } })),
      'highProtein',
    ).value).toBe(false);
  });

  it('highFiber when ≥ 6 g', () => {
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, fiber: 8 } })), 'highFiber').value).toBe(true);
    expect(byCode(computeDietFlags(mk({ nutrition: { ...mk().nutrition, fiber: 3 } })), 'highFiber').value).toBe(false);
  });
});

describe('ketoCompatible', () => {
  it('TRUE for high-fat low-carb', () => {
    // 70% fat, 8g carbs, 25g protein
    const r = computeDietFlags(mk({
      nutrition: { calories: 500, fat: 39, carbs: 8, protein: 25, sugar: 2, fiber: 3, sodium: 300, saturatedFat: 10 },
    }));
    expect(byCode(r, 'ketoCompatible').value).toBe(true);
  });

  it('FALSE for balanced meal', () => {
    const r = computeDietFlags(mk());
    expect(byCode(r, 'ketoCompatible').value).toBe(false);
  });
});

describe('diabeticFriendly', () => {
  it('TRUE for low-carb low-sugar with fiber boost', () => {
    const r = computeDietFlags(mk({
      nutrition: { calories: 400, protein: 25, fat: 15, carbs: 30, sugar: 6, fiber: 6, sodium: 300, saturatedFat: 4 },
    }));
    expect(byCode(r, 'diabeticFriendly').value).toBe(true);
  });

  it('FALSE at 60g carbs', () => {
    const r = computeDietFlags(mk({
      nutrition: { ...mk().nutrition, carbs: 60, sugar: 8 },
    }));
    expect(byCode(r, 'diabeticFriendly').value).toBe(false);
  });

  it('FALSE at 12g sugar', () => {
    const r = computeDietFlags(mk({
      nutrition: { ...mk().nutrition, sugar: 12 },
    }));
    expect(byCode(r, 'diabeticFriendly').value).toBe(false);
  });
});

// ─── Condition-friendly (tightened) ────────────────────────────────────────────

describe('heartFriendly', () => {
  it('TRUE for low-sodium + low-sat-fat + fiber', () => {
    const r = computeDietFlags(mk({
      nutrition: { calories: 400, protein: 20, fat: 10, saturatedFat: 2, carbs: 30, sugar: 5, fiber: 5, sodium: 350, cholesterol: 30 },
    }));
    expect(byCode(r, 'heartFriendly').value).toBe(true);
  });

  it('FALSE at 450 mg sodium', () => {
    const r = computeDietFlags(mk({
      nutrition: { ...mk().nutrition, sodium: 450, saturatedFat: 2, fiber: 5 },
    }));
    expect(byCode(r, 'heartFriendly').value).toBe(false);
  });

  it('FALSE at 4 g sat fat', () => {
    const r = computeDietFlags(mk({
      nutrition: { ...mk().nutrition, sodium: 300, saturatedFat: 4, fiber: 5 },
    }));
    expect(byCode(r, 'heartFriendly').value).toBe(false);
  });
});

describe('goutFriendly', () => {
  it('TRUE for vegetarian no alcohol', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Ciecierzyca', 'Ryż', 'Pomidor'] }));
    expect(byCode(r, 'goutFriendly').value).toBe(true);
  });

  it('FALSE with beef', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Wołowina', 'Ryż'] }));
    expect(byCode(r, 'goutFriendly').value).toBe(false);
  });

  it('FALSE with shellfish', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Krewetki', 'Makaron'] }));
    expect(byCode(r, 'goutFriendly').value).toBe(false);
  });

  it('FALSE with organ meats', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Wątróbka drobiowa', 'Cebula'] }));
    expect(byCode(r, 'goutFriendly').value).toBe(false);
  });
});

describe('pregnancyFriendly requires positive signal', () => {
  it('TRUE when safe + iron source (lentils)', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Soczewica', 'Szpinak', 'Ryż'] }));
    expect(byCode(r, 'pregnancyFriendly').value).toBe(true);
  });

  it('FALSE when safe but no nutritional signal (plain rice)', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Ryż', 'Cebula'] }));
    expect(byCode(r, 'pregnancyFriendly').value).toBe(false);
  });

  it('FALSE with raw fish (sushi)', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Sushi z łososiem', 'Ryż', 'Szpinak'] }));
    expect(byCode(r, 'pregnancyFriendly').value).toBe(false);
  });

  it('FALSE with high-mercury fish', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Tuńczyk', 'Szpinak'] }));
    expect(byCode(r, 'pregnancyFriendly').value).toBe(false);
  });

  it('FALSE with alcohol', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Wino białe', 'Soczewica'] }));
    expect(byCode(r, 'pregnancyFriendly').value).toBe(false);
  });
});

describe('ibsFriendly / renalFriendly / liverFriendly', () => {
  it('ibsFriendly FALSE with onion (FODMAP)', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Cebula', 'Marchew', 'Ryż'] }));
    expect(byCode(r, 'ibsFriendly').value).toBe(false);
  });

  it('ibsFriendly TRUE with plain rice + ginger', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Ryż', 'Imbir', 'Kurczak'] }));
    expect(byCode(r, 'ibsFriendly').value).toBe(true);
  });

  it('renalFriendly FALSE when protein ≥ 20 g', () => {
    const r = computeDietFlags(mk({
      ingredientNames: ['Ryż'],
      nutrition: { ...mk().nutrition, protein: 25, sodium: 300 },
    }));
    expect(byCode(r, 'renalFriendly').value).toBe(false);
  });

  it('liverFriendly FALSE when alcohol present', () => {
    const r = computeDietFlags(mk({ ingredientNames: ['Wino', 'Kurczak'] }));
    expect(byCode(r, 'liverFriendly').value).toBe(false);
  });
});

// ─── Missing-data fallback ────────────────────────────────────────────────────

describe('missing nutrition downgrades confidence', () => {
  it('nutrition null → low confidence on nutrition flags', () => {
    const r = computeDietFlags({ ingredientNames: ['Ryż'], nutrition: null });
    expect(byCode(r, 'lowSodium').confidence).toBeLessThan(0.5);
    expect(byCode(r, 'highProtein').confidence).toBeLessThan(0.5);
    expect(byCode(r, 'heartFriendly').confidence).toBeLessThan(0.5);
  });

  it('ingredient-only flags still high confidence', () => {
    const r = computeDietFlags({ ingredientNames: ['Mąka pszenna'], nutrition: null });
    expect(byCode(r, 'glutenFree').confidence).toBeGreaterThanOrEqual(0.8);
  });
});

// ─── Output shape ──────────────────────────────────────────────────────────────

describe('returns all 19 flags', () => {
  it('every call returns exactly 19 flags', () => {
    expect(computeDietFlags(mk()).length).toBe(19);
  });

  it('each result has code, value, confidence, reasons', () => {
    const r = computeDietFlags(mk());
    for (const f of r) {
      expect(f).toHaveProperty('code');
      expect(f).toHaveProperty('value');
      expect(f).toHaveProperty('confidence');
      expect(f).toHaveProperty('reasons');
      expect(Array.isArray(f.reasons)).toBe(true);
    }
  });
});
