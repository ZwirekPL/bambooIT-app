import { describe, it, expect } from 'vitest';
import {
  buildDietGeneratePromptV3,
  buildRepairPromptV2,
  buildPartialRegenPromptV2,
  DIET_PLAN_JSON_SCHEMA_V3,
  DIET_PLAN_JSON_SCHEMA_V2,
  getPromptVersion,
  type GeneratePromptInput,
  type RepairPromptInput,
  type PartialRegenPromptInput,
} from '../../services/promptBuilder.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeBaseInput(overrides?: Partial<GeneratePromptInput>): GeneratePromptInput {
  return {
    complexityLevel: 'SIMPLE',
    nutritionTargets: { kcal: 2300, proteinG: 140, fatG: 80, carbsG: 270 },
    segment: {
      goal: 'maintain_weight',
      kcalBucket: 2300,
      mealCount: 4,
      dietType: 'STANDARD',
      allergies: [],
    },
    anonymizedProfile: {
      sex: 'M',
      heightCm: 180,
      weightKg: 80,
      ageYears: 30,
      goal: 'maintain_weight',
    },
    policyContext: {
      excludeKeywords: [],
      nutrientLimits: [],
      clinicalNotes: [],
      appliedRuleNames: [],
    },
    preferences: { mealsPerDay: 4, dietType: 'STANDARD' },
    ...overrides,
  };
}

// ─── V3 prompt structure ─────────────────────────────────────────────────────

describe('buildDietGeneratePromptV3', () => {
  it('returns systemPrompt and userPrompt', () => {
    const result = buildDietGeneratePromptV3(makeBaseInput());
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
    expect(result.systemPrompt.length).toBeGreaterThan(500);
    expect(result.userPrompt.length).toBeGreaterThan(100);
  });

  it('contains all 4 priority sections (P1-P4)', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    expect(systemPrompt).toContain('P1 — BEZPIECZEŃSTWO');
    expect(systemPrompt).toContain('P2 — CELE ŻYWIENIOWE');
    expect(systemPrompt).toContain('P3 — JAKOŚĆ PLANU');
    expect(systemPrompt).toContain('P4 — PERSONALIZACJA');
  });

  it('includes kcal target and tolerance range in P2', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    expect(systemPrompt).toContain('~2300 kcal');
    expect(systemPrompt).toContain('2070-2530 kcal'); // ±10%
    expect(systemPrompt).toContain('B ~140g');
    expect(systemPrompt).toContain('T ~80g');
    expect(systemPrompt).toContain('W ~270g');
  });

  it('includes kcal reference table in P2', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    expect(systemPrompt).toContain('TABELA KALORYCZNOŚCI');
    expect(systemPrompt).toContain('Pierś z kurczaka: 110');
    expect(systemPrompt).toContain('Oliwa/olej: 880');
    expect(systemPrompt).toContain('Jogurt naturalny: 60');
  });

  // ── P1: Safety rules ──

  it('includes smoked products ban in P1 (safety)', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    const p1Section = systemPrompt.split('P2 — CELE')[0];
    expect(p1Section).toContain('PRODUKTY WĘDZONE: ZAKAZ');
    expect(p1Section).toContain('główne białko w obiedzie');
  });

  it('includes egg limit in P1 (safety)', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    const p1Section = systemPrompt.split('P2 — CELE')[0];
    expect(p1Section).toContain('JAJKA: BEZWZGLĘDNIE max 7 sztuk');
  });

  it('includes allergies in P1 when present', () => {
    const input = makeBaseInput({
      segment: {
        goal: 'maintain_weight',
        kcalBucket: 2300,
        mealCount: 4,
        dietType: 'STANDARD',
        allergies: ['gluten', 'mleko'],
      },
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    const p1Section = systemPrompt.split('P2 — CELE')[0];
    expect(p1Section).toContain('WYKLUCZ');
    expect(p1Section).toContain('gluten');
    expect(p1Section).toContain('mleko');
  });

  it('includes excluded keywords from policy in P1', () => {
    const input = makeBaseInput({
      policyContext: {
        excludeKeywords: ['alkohol', 'kawa'],
        nutrientLimits: [],
        clinicalNotes: [],
        appliedRuleNames: [],
      },
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    const p1Section = systemPrompt.split('P2 — CELE')[0];
    expect(p1Section).toContain('alkohol');
    expect(p1Section).toContain('kawa');
  });

  // ── P3: Quality rules ──

  it('includes dinner rotation pattern in P3', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    expect(systemPrompt).toContain('KOLACJA (ROTACJA TYPÓW');
    expect(systemPrompt).toContain('sałatka z białkiem');
    expect(systemPrompt).toContain('zupa krem');
    expect(systemPrompt).toContain('max 2 sałatki');
  });

  it('includes lunch mandatory 4-element structure', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    expect(systemPrompt).toContain('OBIAD (OBOWIĄZKOWE min. 4 elementy');
    expect(systemPrompt).toContain('BIAŁKO');
    expect(systemPrompt).toContain('WĘGLOWODAN ZŁOŻONY');
    expect(systemPrompt).toContain('WARZYWA');
    expect(systemPrompt).toContain('TŁUSZCZ');
  });

  it('includes weekly uniqueness requirement', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    expect(systemPrompt).toContain('Każde danie w tygodniu MUSI być unikalne');
    expect(systemPrompt).toContain('Min. 5 źródeł białka');
  });

  it('includes tuna limit in P3', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    expect(systemPrompt).toContain('Tuńczyk z puszki: max 2x/tydzień');
  });

  it('P3 references P1 for smoked products (no duplication)', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    const p3Section = systemPrompt.split('P3 — JAKOŚĆ')[1]?.split('P4 —')[0] ?? '';
    expect(p3Section).toContain('patrz P1');
    // Should NOT have the full ban text repeated in P3
    expect(p3Section).not.toContain('NIE używaj produktów wędzonej');
  });

  // ── Meal count variations ──

  it('generates 3 meal types for mealCount=3', () => {
    const input = makeBaseInput({
      segment: { goal: 'maintain_weight', kcalBucket: 2000, mealCount: 3, dietType: 'STANDARD', allergies: [] },
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    expect(systemPrompt).toContain('3 posiłków');
    expect(systemPrompt).toContain('Śniadanie, Obiad, Kolacja');
    // 3-meal plan should not include II Śniadanie in the structure line
    expect(systemPrompt).toMatch(/STRUKTURA:.*Śniadanie, Obiad, Kolacja/);
  });

  it('generates 5 meal types for mealCount=5', () => {
    const input = makeBaseInput({
      segment: { goal: 'maintain_weight', kcalBucket: 2500, mealCount: 5, dietType: 'STANDARD', allergies: [] },
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    expect(systemPrompt).toContain('5 posiłków');
    expect(systemPrompt).toContain('Śniadanie, II Śniadanie, Obiad, Podwieczorek, Kolacja');
  });

  it('includes snack rotation rules for 4+ meals', () => {
    const input4 = makeBaseInput({
      segment: { goal: 'maintain_weight', kcalBucket: 2300, mealCount: 4, dietType: 'STANDARD', allergies: [] },
    });
    const prompt4 = buildDietGeneratePromptV3(input4).systemPrompt;
    expect(prompt4).toContain('ROTACJA PODWIECZOREK');
  });

  // ── P4: Personalization ──

  it('includes cooking time constraint when specified', () => {
    const input = makeBaseInput({
      preferences: { mealsPerDay: 4, dietType: 'STANDARD', cookingTime: '20' },
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    expect(systemPrompt).toContain('Max czas gotowania: 20 min');
  });

  it('includes micronutrient hints for vegetarian diet', () => {
    const input = makeBaseInput({
      segment: { goal: 'maintain_weight', kcalBucket: 2300, mealCount: 4, dietType: 'wegetariańska', allergies: [] },
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    expect(systemPrompt).toContain('B12');
    expect(systemPrompt).toContain('żelazo');
  });

  it('includes highly rated recipes when provided', () => {
    const input = makeBaseInput({
      highlyRatedRecipeNames: ['Owsianka z bananem', 'Łosoś z ryżem'],
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    expect(systemPrompt).toContain('PREFEROWANE DANIA');
    expect(systemPrompt).toContain('Owsianka z bananem');
    expect(systemPrompt).toContain('Łosoś z ryżem');
  });

  it('includes previous dish names to avoid repeating', () => {
    const input = makeBaseInput({
      previousDishNames: ['Pierś z kurczaka z kaszą', 'Owsianka z miodem'],
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    expect(systemPrompt).toContain('DANIA Z POPRZEDNIEGO PLANU');
    expect(systemPrompt).toContain('Pierś z kurczaka z kaszą');
  });

  // ── User prompt (product list) ──

  it('includes product list when provided', () => {
    const input = makeBaseInput({
      canonicalProductNames: ['Pierś z kurczaka', 'Ryż brązowy', 'Brokuły'],
    });
    const result = buildDietGeneratePromptV3(input);
    const combined = result.systemPrompt + result.userPrompt;
    expect(combined).toContain('DOSTĘPNE PRODUKTY');
    expect(combined).toContain('Pierś z kurczaka');
  });

  it('includes health products with reasons', () => {
    const input = makeBaseInput({
      healthProducts: [
        { name: 'Szpinak', reason: 'Bogate w żelazo — niedobór żelaza', category: 'Warzywa' },
      ],
      canonicalProductNames: ['Szpinak'],
    });
    const result = buildDietGeneratePromptV3(input);
    const combined = result.systemPrompt + result.userPrompt;
    expect(combined).toContain('Szpinak');
  });

  // ── Few-shot example ──

  it('includes few-shot example with _dayCheck', () => {
    const { systemPrompt } = buildDietGeneratePromptV3(makeBaseInput());
    expect(systemPrompt).toContain('PRZYKŁAD');
    expect(systemPrompt).toContain('_dayCheck');
    expect(systemPrompt).toContain('estimatedDayKcal');
    expect(systemPrompt).toContain('_weekSummary');
  });

  // ── Clinical notes for complex cases ──

  it('includes clinical notes for COMPLEX cases', () => {
    const input = makeBaseInput({
      complexityLevel: 'COMPLEX',
      policyContext: {
        excludeKeywords: [],
        nutrientLimits: [],
        clinicalNotes: ['Cukrzyca T2 — unikać cukrów prostych', 'Nadciśnienie — ograniczyć sód'],
        appliedRuleNames: ['diabetes_t2', 'hypertension'],
      },
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    expect(systemPrompt).toContain('ANALIZA KLINICZNA');
    expect(systemPrompt).toContain('Cukrzyca T2');
    expect(systemPrompt).toContain('Nadciśnienie');
    expect(systemPrompt).toContain('diabetes_t2');
  });

  it('does NOT include clinical notes for SIMPLE cases', () => {
    const input = makeBaseInput({
      complexityLevel: 'SIMPLE',
      policyContext: {
        excludeKeywords: [],
        nutrientLimits: [],
        clinicalNotes: ['Cukrzyca T2'],
        appliedRuleNames: ['diabetes_t2'],
      },
    });
    const { systemPrompt } = buildDietGeneratePromptV3(input);
    expect(systemPrompt).not.toContain('ANALIZA KLINICZNA');
  });
});

// ─── JSON Schema V3 ──────────────────────────────────────────────────────────

describe('DIET_PLAN_JSON_SCHEMA_V3', () => {
  it('has required top-level properties', () => {
    const schema = DIET_PLAN_JSON_SCHEMA_V3 as { properties: Record<string, unknown> };
    expect(schema.properties).toHaveProperty('days');
    expect(schema.properties).toHaveProperty('_weekSummary');
  });

  it('_weekSummary contains uniqueDishCount and proteinSourcesUsed', () => {
    const schema = DIET_PLAN_JSON_SCHEMA_V3 as {
      properties: {
        _weekSummary: { properties: Record<string, unknown> };
      };
    };
    const weekProps = schema.properties._weekSummary.properties;
    expect(weekProps).toHaveProperty('allDishNames');
    expect(weekProps).toHaveProperty('uniqueDishCount');
    expect(weekProps).toHaveProperty('proteinSourcesUsed');
  });
});

// ─── JSON Schema V2 ──────────────────────────────────────────────────────────

describe('DIET_PLAN_JSON_SCHEMA_V2', () => {
  it('has days property with meals', () => {
    const schema = DIET_PLAN_JSON_SCHEMA_V2 as { properties: Record<string, unknown> };
    expect(schema.properties).toHaveProperty('days');
  });

  it('does NOT have _weekSummary (V2 only)', () => {
    const schema = DIET_PLAN_JSON_SCHEMA_V2 as { properties: Record<string, unknown> };
    expect(schema.properties).not.toHaveProperty('_weekSummary');
  });
});

// ─── Repair prompt V2 ───────────────────────────────────────────────────────

describe('buildRepairPromptV2', () => {
  const makeRepairInput = (): RepairPromptInput => ({
    violations: [
      {
        day: 'Poniedziałek',
        mealName: 'Obiad',
        violatingItem: 'Sałatka z orzechami',
        keyword: 'orzechy',
        restrictionLevel: 'ALLERGY',
        reason: 'Alergia na orzechy',
      },
    ],
    violatingContent: {
      days: [
        {
          day: 'Poniedziałek',
          meals: [
            {
              name: 'Obiad',
              items: [{ name: 'Sałatka z orzechami', grams: 30, kcal: 195, protein: 4.5, fat: 19.5, carbs: 4.5, ingredients: [{ name: 'Orzechy włoskie', grams: 30 }] }],
              recipe: { prepTimeMin: 10, steps: ['Wymieszaj.'], tips: undefined },
            },
          ],
        },
      ],
    },
    preservedMeals: { Poniedziałek: ['Śniadanie', 'Kolacja'] },
    preservedDayNames: ['Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'],
    existingDishNames: ['Owsianka z bananem', 'Zupa krem z brokułów'],
    mealTargets: { Obiad: { kcal: 800, proteinG: 45, fatG: 30, carbsG: 90 } },
    dayTotals: { Poniedziałek: { kcal: 2300, proteinG: 140, fatG: 80, carbsG: 270 } },
    nutritionTargets: { kcal: 2300, proteinG: 140, fatG: 80, carbsG: 270 },
    tolerance: 0.1,
    attemptNumber: 1,
  });

  it('returns systemPrompt and userPrompt', () => {
    const result = buildRepairPromptV2(makeRepairInput());
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
  });

  it('includes violation details in prompt', () => {
    const { systemPrompt } = buildRepairPromptV2(makeRepairInput());
    expect(systemPrompt).toContain('orzechy');
    expect(systemPrompt).toContain('Poniedziałek');
  });

  it('includes existing dish names to avoid duplication', () => {
    const { systemPrompt } = buildRepairPromptV2(makeRepairInput());
    expect(systemPrompt).toContain('Owsianka z bananem');
  });
});

// ─── Partial regen prompt V2 ─────────────────────────────────────────────────

describe('buildPartialRegenPromptV2', () => {
  const makePartialInput = (): PartialRegenPromptInput => ({
    targets: {
      days: ['Poniedziałek'],
    },
    currentContent: {
      days: [
        {
          day: 'Poniedziałek',
          meals: [
            {
              name: 'Śniadanie',
              items: [{ name: 'Owsianka', grams: 80, kcal: 296, protein: 8, fat: 1.6, carbs: 56, ingredients: [{ name: 'Płatki owsiane', grams: 80 }] }],
              recipe: { prepTimeMin: 5, steps: ['Ugotuj.'], tips: undefined },
            },
          ],
        },
        {
          day: 'Wtorek',
          meals: [
            {
              name: 'Śniadanie',
              items: [{ name: 'Jajecznica', grams: 120, kcal: 186, protein: 15.6, fat: 13.2, carbs: 1.2, ingredients: [{ name: 'Jajka', grams: 120 }] }],
              recipe: { prepTimeMin: 10, steps: ['Usmaż.'], tips: undefined },
            },
          ],
        },
      ],
    },
    nutritionTargets: { kcal: 2300, proteinG: 140, fatG: 80, carbsG: 270 },
    excludeKeywords: [],
    clinicalNotes: [],
  });

  it('returns systemPrompt and userPrompt', () => {
    const result = buildPartialRegenPromptV2(makePartialInput());
    expect(result).toHaveProperty('systemPrompt');
    expect(result).toHaveProperty('userPrompt');
  });

  it('specifies which days to regenerate', () => {
    const { systemPrompt } = buildPartialRegenPromptV2(makePartialInput());
    expect(systemPrompt).toContain('Poniedziałek');
  });

  it('includes nutrition targets', () => {
    const { systemPrompt } = buildPartialRegenPromptV2(makePartialInput());
    expect(systemPrompt).toContain('2300');
  });

  it('includes existing dishes to avoid repetition', () => {
    const { systemPrompt } = buildPartialRegenPromptV2(makePartialInput());
    // Should list dishes from non-regenerated days
    expect(systemPrompt).toContain('Jajecznica');
  });

  it('includes current plan in userPrompt for context', () => {
    const { userPrompt } = buildPartialRegenPromptV2(makePartialInput());
    expect(userPrompt).toContain('Poniedziałek');
  });
});

// ─── getPromptVersion ────────────────────────────────────────────────────────

describe('getPromptVersion', () => {
  it('returns a valid prompt version', () => {
    const version = getPromptVersion();
    expect(['v1', 'v2', 'v3']).toContain(version);
  });
});
