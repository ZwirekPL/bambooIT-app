import { describe, it, expect } from 'vitest';
import {
  computeRecipeTags,
  CUISINE_TAGS,
  MEAL_TYPE_TAGS,
  COOKING_METHOD_TAGS,
  KNOWN_TAGS,
  TAG_CONFLICTS,
  type AutotagInput,
} from '../../scraper/utils/autotagger';

function mk(overrides: Partial<AutotagInput> = {}): AutotagInput {
  return {
    cuisineType: 'polska',
    mealType: 'LUNCH',
    cookingMethod: 'BAKED',
    totalTimeMinutes: 30,
    containsVegetableServing: false,
    vegetableWeightG: null,
    ingredientNames: ['Pierś z kurczaka', 'Ziemniaki'],
    dietFlags: [],
    existingTags: [],
    ...overrides,
  };
}

describe('cuisine + meal-type + cookingMethod echo', () => {
  it('emits cuisine + lowercase mealType + PL cooking method', () => {
    const tags = computeRecipeTags(mk());
    expect(tags).toContain('polska');
    expect(tags).toContain('lunch');
    expect(tags).toContain('pieczone');
  });

  it('skips mealType when value is outside the canonical enum', () => {
    const tags = computeRecipeTags(mk({ mealType: 'NONSTANDARD' }));
    expect(tags).not.toContain('nonstandard');
  });

  it('skips cuisine when not in canonical 9-set', () => {
    const tags = computeRecipeTags(mk({ cuisineType: 'uniwersalna' }));
    expect(tags).not.toContain('uniwersalna');
  });
});

describe('time class buckets', () => {
  it('szybkie when totalTimeMinutes ≤ 20', () => {
    expect(computeRecipeTags(mk({ totalTimeMinutes: 15 }))).toContain('szybkie');
    expect(computeRecipeTags(mk({ totalTimeMinutes: 20 }))).toContain('szybkie');
  });

  it('wymaga-czasu when ≥ 60', () => {
    expect(computeRecipeTags(mk({ totalTimeMinutes: 60 }))).toContain('wymaga-czasu');
    expect(computeRecipeTags(mk({ totalTimeMinutes: 90 }))).toContain('wymaga-czasu');
  });

  it('no time tag in the middle band', () => {
    const tags = computeRecipeTags(mk({ totalTimeMinutes: 40 }));
    expect(tags.some((t) => t === 'szybkie' || t === 'wymaga-czasu')).toBe(false);
  });

  it('no time tag when null', () => {
    const tags = computeRecipeTags(mk({ totalTimeMinutes: null }));
    expect(tags.some((t) => t === 'szybkie' || t === 'wymaga-czasu')).toBe(false);
  });
});

describe('curated diet flags', () => {
  it('emits flags above confidence threshold only', () => {
    const tags = computeRecipeTags(mk({
      dietFlags: [
        { flagCode: 'glutenFree', value: true, confidence: 90 },
        { flagCode: 'highProtein', value: true, confidence: 60 }, // below threshold
        { flagCode: 'lactoseFree', value: false, confidence: 90 },  // value=false
      ],
    }));
    expect(tags).toContain('glutenFree');
    expect(tags).not.toContain('highProtein');
    expect(tags).not.toContain('lactoseFree');
  });

  it('strictest veggie wins (vegan over vegetarian over pescatarian)', () => {
    const tags = computeRecipeTags(mk({
      dietFlags: [
        { flagCode: 'vegan', value: true, confidence: 85 },
        { flagCode: 'vegetarian', value: true, confidence: 90 },
        { flagCode: 'pescatarian', value: true, confidence: 90 },
      ],
    }));
    expect(tags).toContain('vegan');
    expect(tags).not.toContain('vegetarian');
    expect(tags).not.toContain('pescatarian');
  });

  it('keeps non-veggie diet tags alongside vegan', () => {
    const tags = computeRecipeTags(mk({
      dietFlags: [
        { flagCode: 'vegan', value: true, confidence: 85 },
        { flagCode: 'glutenFree', value: true, confidence: 90 },
        { flagCode: 'highProtein', value: true, confidence: 90 },
      ],
    }));
    expect(tags).toContain('vegan');
    expect(tags).toContain('glutenFree');
    expect(tags).toContain('highProtein');
  });

  it('drops uncurated diet flags (lowSugar, ketoCompatible, etc.)', () => {
    const tags = computeRecipeTags(mk({
      dietFlags: [
        { flagCode: 'lowSugar', value: true, confidence: 90 },
        { flagCode: 'ketoCompatible', value: true, confidence: 90 },
        { flagCode: 'goutFriendly', value: true, confidence: 90 },
      ],
    }));
    expect(tags).not.toContain('lowSugar');
    expect(tags).not.toContain('ketoCompatible');
    expect(tags).not.toContain('goutFriendly');
  });
});

describe('ingredient signal tags', () => {
  it('emits "pełnoziarniste" when ingredient name carries the stem', () => {
    const tags = computeRecipeTags(mk({
      ingredientNames: ['Chleb żytni razowy', 'Twaróg'],
    }));
    expect(tags).toContain('pełnoziarniste');
  });

  it('emits "pełnoziarniste" for English wholegrain marker', () => {
    const tags = computeRecipeTags(mk({
      ingredientNames: ['Whole grain pasta', 'Tomatoes'],
    }));
    expect(tags).toContain('pełnoziarniste');
  });

  it('does NOT emit "pełnoziarniste" without matching ingredient', () => {
    const tags = computeRecipeTags(mk({
      ingredientNames: ['Pierś z kurczaka', 'Ryż biały', 'Marchew'],
    }));
    expect(tags).not.toContain('pełnoziarniste');
  });

  it('emits "bogate-w-warzywa" by containsVegetableServing flag', () => {
    const tags = computeRecipeTags(mk({ containsVegetableServing: true }));
    expect(tags).toContain('bogate-w-warzywa');
  });

  it('emits "bogate-w-warzywa" by vegetableWeightG ≥ 100', () => {
    const tags = computeRecipeTags(mk({ vegetableWeightG: 120 }));
    expect(tags).toContain('bogate-w-warzywa');
  });

  it('does NOT emit "bogate-w-warzywa" below threshold', () => {
    const tags = computeRecipeTags(mk({
      containsVegetableServing: false,
      vegetableWeightG: 50,
    }));
    expect(tags).not.toContain('bogate-w-warzywa');
  });
});

describe('existing tags + dedup + sort', () => {
  it('preserves caller-supplied tags (e.g. ai-generated marker)', () => {
    const tags = computeRecipeTags(mk({ existingTags: ['ai-generated', 'imported'] }));
    expect(tags).toContain('ai-generated');
    expect(tags).toContain('imported');
  });

  it('returns sorted unique tags', () => {
    const tags = computeRecipeTags(mk({ existingTags: ['ai-generated', 'side', 'basic'] }));
    const sorted = [...tags].sort();
    expect(tags).toEqual(sorted);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('strips stale KNOWN_TAGS from existingTags so corrections propagate', () => {
    // Recipe was tagged "pieczone" before cookingMethod got corrected to
    // BOILED. The passthrough must drop the stale tag and let the new run
    // emit "gotowane" instead.
    const tags = computeRecipeTags(mk({
      cookingMethod: 'BOILED',
      existingTags: ['pieczone', 'ai-generated'],
    }));
    expect(tags).toContain('gotowane');
    expect(tags).not.toContain('pieczone');
    expect(tags).toContain('ai-generated'); // out-of-vocab marker preserved
  });
});

describe('output shape sanity', () => {
  it('typical recipe lands in 3-8 tag range', () => {
    const tags = computeRecipeTags(mk({
      cuisineType: 'polska',
      mealType: 'BREAKFAST',
      cookingMethod: 'FRIED',
      totalTimeMinutes: 15,
      ingredientNames: ['Jajko kurze', 'Szpinak', 'Chleb żytni razowy'],
      dietFlags: [
        { flagCode: 'vegetarian', value: true, confidence: 90 },
        { flagCode: 'highFiber', value: true, confidence: 85 },
      ],
    }));
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags.length).toBeLessThanOrEqual(8);
  });

  it('every emitted tag is in KNOWN_TAGS unless it was an existingTag passthrough', () => {
    const tags = computeRecipeTags(mk({
      existingTags: ['ai-generated'], // not in KNOWN_TAGS, allowed via passthrough
      dietFlags: [{ flagCode: 'glutenFree', value: true, confidence: 90 }],
    }));
    for (const t of tags) {
      expect(KNOWN_TAGS.has(t) || t === 'ai-generated').toBe(true);
    }
  });

  it('TAG_CONFLICTS pairs are mutually exclusive in normal output', () => {
    // szybkie vs wymaga-czasu: only one bucket triggers per recipe
    const fast = computeRecipeTags(mk({ totalTimeMinutes: 10 }));
    const slow = computeRecipeTags(mk({ totalTimeMinutes: 90 }));
    for (const [a, b] of TAG_CONFLICTS) {
      expect(fast.includes(a) && fast.includes(b)).toBe(false);
      expect(slow.includes(a) && slow.includes(b)).toBe(false);
    }
  });
});

describe('exported dictionaries are non-empty', () => {
  it('each export has at least one entry', () => {
    expect(CUISINE_TAGS.size).toBeGreaterThan(0);
    expect(MEAL_TYPE_TAGS.size).toBeGreaterThan(0);
    expect(COOKING_METHOD_TAGS.size).toBeGreaterThan(0);
    expect(KNOWN_TAGS.size).toBeGreaterThan(15);
  });
});
