import { describe, it, expect } from 'vitest';
import {
  classifyIngredient,
  computeRecipeProteinSource,
} from '../../scraper/utils/proteinSource';
import { classifyCuisine } from '../../scraper/utils/cuisineClassifier';
import {
  classifyMealType,
  scoreDifficulty,
} from '../../scraper/utils/recipeClassifier';

// ═══════════════════════════════════════════════════════════════════════════════
// proteinSource
// ═══════════════════════════════════════════════════════════════════════════════

describe('classifyIngredient', () => {
  it('detects poultry from "Pierś z kurczaka"', () => {
    expect(classifyIngredient('Pierś z kurczaka')).toBe('poultry');
  });

  it('detects beef from "Wołowina"', () => {
    expect(classifyIngredient('Wołowina mielona')).toBe('beef');
  });

  it('detects pork from "Schab"', () => {
    expect(classifyIngredient('Schab wieprzowy')).toBe('pork');
  });

  it('detects fish from "Łosoś"', () => {
    expect(classifyIngredient('Łosoś wędzony')).toBe('fish');
  });

  it('detects legume from "Ciecierzyca"', () => {
    expect(classifyIngredient('Ciecierzyca')).toBe('legume');
  });

  it('detects egg from "Jajka"', () => {
    expect(classifyIngredient('Jajka kurze')).toBe('egg');
  });

  it('detects dairy from "Twaróg"', () => {
    expect(classifyIngredient('Twaróg półtłusty')).toBe('dairy');
  });

  it('detects nuts from "Migdały"', () => {
    expect(classifyIngredient('Migdały prażone')).toBe('nuts');
  });

  it('defaults to vegetable for produce', () => {
    expect(classifyIngredient('Szpinak')).toBe('vegetable');
    expect(classifyIngredient('Marchew')).toBe('vegetable');
  });

  it('returns "other" for empty', () => {
    expect(classifyIngredient('')).toBe('other');
  });
});

describe('computeRecipeProteinSource', () => {
  it('picks poultry when chicken dominates protein', () => {
    const r = computeRecipeProteinSource([
      { name: 'Pierś z kurczaka', grams: 200, proteinPer100g: 22 },
      { name: 'Ryż biały', grams: 150, proteinPer100g: 7 },
      { name: 'Marchew', grams: 80, proteinPer100g: 1 },
    ]);
    expect(r.source).toBe('poultry');
    expect(r.topIngredient?.name).toBe('Pierś z kurczaka');
  });

  it('picks legume for hummus-style dish', () => {
    const r = computeRecipeProteinSource([
      { name: 'Ciecierzyca', grams: 300, proteinPer100g: 9 },
      { name: 'Tahina', grams: 40, proteinPer100g: 17 },
      { name: 'Czosnek', grams: 5, proteinPer100g: 6 },
    ]);
    expect(r.source).toBe('legume');
  });

  it('picks fish for salmon with vegetables', () => {
    const r = computeRecipeProteinSource([
      { name: 'Łosoś', grams: 150, proteinPer100g: 20 },
      { name: 'Szparagi', grams: 200, proteinPer100g: 2 },
    ]);
    expect(r.source).toBe('fish');
  });

  it('returns "other" when no ingredient has protein', () => {
    const r = computeRecipeProteinSource([
      { name: 'Woda', grams: 250, proteinPer100g: 0 },
      { name: 'Cukier', grams: 50, proteinPer100g: 0 },
    ]);
    expect(r.source).toBe('other');
  });

  it('gives vegetable for a legit veggie dish when protein > 2g total', () => {
    const r = computeRecipeProteinSource([
      { name: 'Szpinak', grams: 300, proteinPer100g: 3 },
      { name: 'Pomidor', grams: 200, proteinPer100g: 1 },
    ]);
    expect(r.source).toBe('vegetable');
    expect(r.totalProteinG).toBeGreaterThan(2);
  });

  it('exposes contributions sorted by protein desc', () => {
    const r = computeRecipeProteinSource([
      { name: 'Kurczak', grams: 150, proteinPer100g: 22 },
      { name: 'Marchew', grams: 100, proteinPer100g: 1 },
    ]);
    expect(r.contributions[0].name).toBe('Kurczak');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// cuisineClassifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('classifyCuisine', () => {
  it('identifies włoska from pasta + parmezan + bazylia', () => {
    const r = classifyCuisine('Spaghetti carbonara', ['Makaron spaghetti', 'Parmezan', 'Bazylia', 'Oliwa z oliwek']);
    expect(r.cuisine).toBe('włoska');
  });

  it('identifies azjatycka from sos sojowy + imbir', () => {
    const r = classifyCuisine('Stir-fry z kurczakiem', ['Sos sojowy', 'Imbir', 'Makaron ryżowy', 'Tofu']);
    expect(r.cuisine).toBe('azjatycka');
  });

  it('identifies indyjska from curry + garam masala', () => {
    const r = classifyCuisine('Dal curry', ['Soczewica czerwona', 'Kurkuma', 'Garam masala', 'Mleko kokosowe']);
    expect(r.cuisine).toBe('indyjska');
  });

  it('identifies meksykańska from tortilla + jalapeño', () => {
    const r = classifyCuisine('Burrito z fasolą', ['Tortilla', 'Czarna fasola', 'Jalapeño', 'Awokado']);
    expect(r.cuisine).toBe('meksykańska');
  });

  it('identifies grecka from feta + tzatziki', () => {
    const r = classifyCuisine('Sałatka grecka', ['Feta', 'Pomidor', 'Ogórek', 'Oliwki kalamata', 'Tzatziki']);
    expect(r.cuisine).toBe('grecka');
  });

  it('identifies polska from pierogi', () => {
    const r = classifyCuisine('Pierogi ruskie', ['Ziemniaki', 'Twaróg', 'Cebula']);
    expect(r.cuisine).toBe('polska');
  });

  it('returns "inna" when no strong signal', () => {
    const r = classifyCuisine('Prosty przepis', ['Cebula', 'Marchew', 'Sól']);
    expect(r.cuisine).toBe('inna');
  });

  it('exposes topSignals for debugging', () => {
    const r = classifyCuisine('Pizza margherita', ['Mozzarella', 'Pomidor', 'Bazylia']);
    expect(r.topSignals.length).toBeGreaterThan(0);
    expect(r.topSignals[0].cuisine).toBe('włoska');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// mealTypeClassifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('classifyMealType', () => {
  it('picks DESSERT for "Sernik"', () => {
    expect(classifyMealType('Sernik królewski', 400).mealType).toBe('DESSERT');
  });

  it('picks BREAKFAST for "Owsianka"', () => {
    expect(classifyMealType('Owsianka bananowa', 350).mealType).toBe('BREAKFAST');
  });

  it('picks DRINK for "Smoothie"', () => {
    expect(classifyMealType('Smoothie truskawkowe', 200).mealType).toBe('DRINK');
  });

  it('picks SAUCE for "Sos pomidorowy"', () => {
    expect(classifyMealType('Sos pomidorowy domowy', 100).mealType).toBe('SAUCE');
  });

  it('picks SNACK for "Przekąska"', () => {
    expect(classifyMealType('Przekąska energetyczna', 150).mealType).toBe('SNACK');
  });

  it('picks LUNCH for "Kotlet schabowy" regardless of kcal', () => {
    expect(classifyMealType('Kotlet schabowy tradycyjny', 800).mealType).toBe('LUNCH');
  });

  it('falls back to LUNCH kcal range when title is generic', () => {
    const r = classifyMealType('Szybkie danie', 700);
    expect(r.mealType).toBe('LUNCH');
    expect(r.confidence).toBe('MEDIUM');
  });

  it('falls back to SNACK range for low-kcal generic title', () => {
    const r = classifyMealType('Lekki posiłek', 150);
    expect(r.mealType).toBe('SNACK');
  });

  it('low confidence when nothing matches', () => {
    const r = classifyMealType('Generic title', null);
    expect(r.confidence).toBe('LOW');
    expect(r.mealType).toBe('LUNCH'); // default fallback
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// difficultyScore
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreDifficulty', () => {
  it('EASY for short recipe with few steps', () => {
    const r = scoreDifficulty(15, 3);
    expect(r.difficulty).toBe('EASY');
  });

  it('MEDIUM for moderately long recipe', () => {
    const r = scoreDifficulty(60, 6);
    expect(r.difficulty).toBe('MEDIUM');
  });

  it('HARD for long recipe with many steps', () => {
    const r = scoreDifficulty(180, 12);
    expect(r.difficulty).toBe('HARD');
  });

  it('bumps difficulty when complex technique detected', () => {
    const easyNoTechnique = scoreDifficulty(30, 4);
    const sameWithTechnique = scoreDifficulty(30, 4, 'Marynowany schab', [
      'Składniki marynaty wymieszać', 'Mięso marynować przez noc',
    ]);
    expect(sameWithTechnique.score).toBeGreaterThan(easyNoTechnique.score);
  });

  it('handles null time', () => {
    const r = scoreDifficulty(null, 2);
    expect(r.difficulty).toBe('EASY');
  });

  it('score capped at 100', () => {
    const r = scoreDifficulty(400, 20, 'Sous vide z konfitowanym schabem fermentowanym', []);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.difficulty).toBe('HARD');
  });
});
