/**
 * 33.3 — Prompt builders for OpenAI diet plan generation.
 * Ported from n8n workflow Build Prompt nodes (v3).
 */

import type { PlanContent, PlanMeal } from './planValidation.service';
import type { ComplexityLevel } from './aiGeneration.service';

// ─── shared types ────────────────────────────────────────────────────────────

export interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
}

// ─── types matching TriggerPayload from n8n.service.ts ───────────────────────

export interface GeneratePromptInput {
  complexityLevel: ComplexityLevel;
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number };
  segment: {
    goal: string;
    kcalBucket: number;
    mealCount: number;
    dietType: string;
    allergies: string[];
  };
  anonymizedProfile: {
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
    ageYears: number | null;
    goal: string | null;
  };
  policyContext: {
    excludeKeywords: string[];
    clinicalNotes: string[];
    nutrientLimits: Array<{ nutrient: string; scope: string; min?: number; max?: number }>;
    appliedRuleNames: string[];
  };
  preferences: {
    mealsPerDay: number;
    dietType: string;
    preferredFoods?: string[];
    dislikedFoods?: string[];
    activityLevel?: string;
    cuisinePreferences?: string[];
    cookingTime?: string;
    budget?: string;
    additionalNotes?: string;
    supplements?: string[];
    activityTypes?: string[];
    stressLevel?: string;
    sleepHours?: string;
    alcoholFrequency?: string;
    workType?: string;
    intolerances?: string[];
    mealRhythm?: { firstMealTime?: string; lastMealTime?: string; eatsAtNight?: boolean };
  };
  constraints?: {
    maxCookingTimeMinutes?: number;
    preferredCuisines?: string[];
    mealSchedule?: Array<{ mealType: string; time: string; label: string }>;
  };
  canonicalProductNames?: string[];
  canonicalProductsGrouped?: Record<string, string[]>;
  highlyRatedRecipeNames?: string[];
  /** Health-driven product recommendations with reasons */
  healthProducts?: Array<{ name: string; reason: string; category: string }>;
  /** Products the patient dislikes (from ratings + textarea) */
  dislikedProducts?: string[];
  /** Dish names from previous plan to avoid repeating */
  previousDishNames?: string[];
}

export interface RepairPromptInput {
  violations: Array<{ day: string; mealName: string; violatingItem: string; keyword: string; restrictionLevel: string; reason?: string }>;
  violatingContent: PlanContent;
  preservedMeals: Record<string, string[]>;
  preservedDayNames: string[];
  existingDishNames: string[];
  mealTargets: Record<string, { kcal: number; proteinG: number; fatG: number; carbsG: number }>;
  dayTotals: Record<string, { kcal: number; proteinG: number; fatG: number; carbsG: number }>;
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number };
  tolerance: number;
  attemptNumber: number;
}

export interface PartialRegenPromptInput {
  targets: {
    days?: string[];
    meals?: Array<{ day: string; meal: string }>;
  };
  currentContent: PlanContent;
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number };
  excludeKeywords: string[];
  clinicalNotes: string[];
}

export interface PatientDayRegenInput {
  dayName: string;
  reason: 'DONT_LIKE' | 'TOO_COMPLEX' | 'NO_INGREDIENTS';
  keepSimilar: boolean;
  currentContent: PlanContent;
  originalDay: PlanContent['days'][number];
  nutritionTargets: { kcal: number; proteinG: number; fatG: number; carbsG: number };
  // Full generation context (same as GeneratePromptInput subset)
  segment: {
    goal: string;
    mealCount: number;
    dietType: string;
    allergies: string[];
  };
  anonymizedProfile: {
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
    ageYears: number | null;
    goal: string | null;
  };
  policyContext: {
    excludeKeywords: string[];
    clinicalNotes: string[];
    nutrientLimits: Array<{ nutrient: string; scope: string; min?: number; max?: number }>;
    appliedRuleNames: string[];
  };
  preferences: GeneratePromptInput['preferences'];
  canonicalProductNames?: string[];
  canonicalProductsGrouped?: Record<string, string[]>;
  highlyRatedRecipeNames?: string[];
  healthProducts?: Array<{ name: string; reason: string; category: string }>;
  dislikedProducts?: string[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

function getMealTypes(mealCount: number): string[] {
  if (mealCount <= 3) return ['Śniadanie', 'Obiad', 'Kolacja'];
  if (mealCount >= 5) return ['Śniadanie', 'II Śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja'];
  return ['Śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja'];
}

function buildRestrictions(
  segment: GeneratePromptInput['segment'],
  policy: GeneratePromptInput['policyContext'],
  intolerances?: string[],
): string {
  let restrictions = '';

  // Merge allergies + intolerances into one exclusion list
  const allExclusions = [...(segment.allergies ?? [])];
  if (intolerances?.length) {
    for (const intol of intolerances) {
      if (!allExclusions.some((a) => a.toLowerCase() === intol.toLowerCase())) {
        allExclusions.push(intol);
      }
    }
  }
  if (allExclusions.length > 0) {
    restrictions += `\nALERGIE/NIETOLERANCJE (BEZWZGLĘDNIE WYKLUCZ): ${allExclusions.join(', ')}.`;
  }
  if (segment.dietType && segment.dietType !== 'STANDARD') {
    restrictions += `\nTYP DIETY: ${segment.dietType}.`;
  }
  if (policy.excludeKeywords?.length > 0) {
    restrictions += `\nWYKLUCZONE PRODUKTY/SŁOWA KLUCZOWE: ${policy.excludeKeywords.join(', ')}.`;
  }
  if (policy.nutrientLimits?.length > 0) {
    const limitsText = policy.nutrientLimits.map((l) => {
      let desc = `${l.nutrient} (${l.scope})`;
      if (l.max !== undefined) desc += ` max: ${l.max}`;
      if (l.min !== undefined) desc += ` min: ${l.min}`;
      return desc;
    }).join('; ');
    restrictions += `\nLIMITY SKŁADNIKÓW: ${limitsText}.`;
  }
  restrictions += `\nPRODUKTY WĘDZONE: ZAKAZ jako główne białko w obiedzie (polędwiczka wędzona, łosoś wędzony, makrela wędzona, dorsz wędzony itp.). Wędzone produkty dopuszczalne WYŁĄCZNIE w kanapkach/sałatkach, max 2x/tydzień.`;
  restrictions += `\nJAJKA: BEZWZGLĘDNIE max 7 sztuk na tydzień. Zaplanuj z góry ile jajek w które dni.`;
  return restrictions;
}

function buildClinicalSection(
  complexity: ComplexityLevel,
  policy: GeneratePromptInput['policyContext'],
): string {
  let section = '';
  if (complexity === 'COMPLEX' && policy.clinicalNotes?.length > 0) {
    section = `\n\nANALIZA KLINICZNA (uwzględnij w doborze posiłków):\n${policy.clinicalNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;
  }
  if (complexity === 'COMPLEX' && policy.appliedRuleNames?.length > 0) {
    section += `\nZastosowane reguły kliniczne: ${policy.appliedRuleNames.join(', ')}.`;
  }
  return section;
}

function buildProductListSection(
  canonicalProducts: string[] | Record<string, string[]>,
  healthProducts?: Array<{ name: string; reason: string; category: string }>,
  dislikedProducts?: string[],
): string {
  const parts: string[] = [];

  // Health-driven products section (priority)
  if (healthProducts?.length) {
    // Group health products by reason type for readability
    const grouped = new Map<string, string[]>();
    for (const hp of healthProducts) {
      // Extract short reason label (e.g., "Bogate w żelazo" from full reason string)
      const shortReason = hp.reason.split('—')[0]?.trim() || hp.reason;
      if (!grouped.has(shortReason)) grouped.set(shortReason, []);
      grouped.get(shortReason)!.push(hp.name);
    }
    const healthLines = [...grouped.entries()]
      .map(([reason, names]) => `  ${reason}: ${names.join(', ')}`)
      .join('\n');
    parts.push(`★ ZALECANE ZDROWOTNIE (priorytet — używaj tych produktów częściej):\n${healthLines}`);
  }

  // Disliked products section (exclusion)
  if (dislikedProducts?.length) {
    parts.push(`✗ NIELUBIANE (unikaj tych produktów): ${dislikedProducts.join(', ')}`);
  }

  // Main product list
  if (Array.isArray(canonicalProducts)) {
    if (canonicalProducts.length > 0) {
      parts.push(`DOSTĘPNE PRODUKTY (używaj DOKŁADNIE tych nazw w ingredients[].name — BEZ nawiasów z gramaturą):\n${canonicalProducts.join(', ')}`);
    }
  } else {
    const entries = Object.entries(canonicalProducts);
    if (entries.length > 0) {
      const grouped = entries
        .map(([cat, names]) => `[${cat}]: ${names.join(', ')}`)
        .join('\n');
      parts.push(`DOSTĘPNE PRODUKTY (używaj DOKŁADNIE tych nazw w ingredients[].name — BEZ nawiasów z gramaturą):\n${grouped}`);
    }
  }

  if (parts.length === 0) return '';

  return '\n\n' + parts.join('\n\n') + '\n\nW ingredients[].name wpisuj TYLKO nazwę produktu (np. "Jajko kurze"), bez nawiasów z gramaturą. Nawiasy (1szt=Xg) to podpowiedź dla Ciebie, ile waży 1 sztuka — dostosuj grams do wielokrotności.\nNie zmieniaj pisowni. Jeśli potrzebujesz produktu spoza listy, użyj najbliższej nazwy z listy.';
}

function buildPatientContext(profile: GeneratePromptInput['anonymizedProfile']): string {
  let ctx = '';
  if (profile.sex) ctx += `Płeć: ${profile.sex}. `;
  if (profile.ageYears) ctx += `Wiek: ${profile.ageYears} lat. `;
  if (profile.weightKg) ctx += `Waga: ${profile.weightKg} kg. `;
  if (profile.heightCm) ctx += `Wzrost: ${profile.heightCm} cm. `;
  if (profile.goal) ctx += `Cel: ${profile.goal}. `;
  return ctx;
}

function buildPreferences(prefs: GeneratePromptInput['preferences']): string {
  let text = '';
  if (prefs.preferredFoods?.length) text += `Preferowane: ${prefs.preferredFoods.join(', ')}. `;
  if (prefs.dislikedFoods?.length) text += `Nielubiane: ${prefs.dislikedFoods.join(', ')}. `;
  if (prefs.activityLevel) text += `Aktywność: ${prefs.activityLevel}. `;
  if (prefs.activityTypes?.length) text += `Sporty: ${prefs.activityTypes.join(', ')}. `;
  if (prefs.cuisinePreferences?.length) text += `Kuchnie: ${prefs.cuisinePreferences.join(', ')}. `;
  if (prefs.supplements?.length) text += `Suplementy: ${prefs.supplements.join(', ')}. `;
  if (prefs.workType) text += `Praca: ${prefs.workType}. `;
  if (prefs.budget) text += `Budżet: ${prefs.budget}. `;
  if (prefs.additionalNotes) text += `Uwagi: ${prefs.additionalNotes}. `;
  return text;
}

function buildLifestyleSection(prefs: GeneratePromptInput['preferences']): string {
  const parts: string[] = [];
  if (prefs.stressLevel) parts.push(`Poziom stresu: ${prefs.stressLevel}`);
  if (prefs.sleepHours) parts.push(`Sen: ${prefs.sleepHours}h`);
  if (prefs.alcoholFrequency) parts.push(`Alkohol: ${prefs.alcoholFrequency}`);
  if (prefs.mealRhythm?.firstMealTime) parts.push(`Pierwszy posiłek: ${prefs.mealRhythm.firstMealTime}`);
  if (prefs.mealRhythm?.lastMealTime) parts.push(`Ostatni posiłek: ${prefs.mealRhythm.lastMealTime}`);
  if (prefs.mealRhythm?.eatsAtNight) parts.push(`Je w nocy: tak`);
  if (parts.length === 0) return '';
  return `\nSTYL ŻYCIA: ${parts.join(' | ')}`;
}

interface MealDistribution { name: string; pct: number; kcal: number }

function getMealCalorieDistribution(mealTypes: string[], totalKcal: number): MealDistribution[] {
  // Percentage distribution per meal type
  const pctMap: Record<string, number> = {
    'Śniadanie': 25,
    'II Śniadanie': 10,
    'Obiad': 35,
    'Podwieczorek': 10,
    'Kolacja': 20,
  };

  // Normalize percentages if meal set differs from default
  const raw = mealTypes.map((name) => ({ name, pct: pctMap[name] ?? 15 }));
  const sumPct = raw.reduce((s, m) => s + m.pct, 0);
  return raw.map((m) => {
    const normalizedPct = Math.round((m.pct / sumPct) * 100);
    return { name: m.name, pct: normalizedPct, kcal: Math.round((normalizedPct / 100) * totalKcal) };
  });
}

function buildConstraintText(constraints?: GeneratePromptInput['constraints']): string {
  if (!constraints) return '';
  let text = '';
  if (constraints.maxCookingTimeMinutes) {
    text += `\n- Maksymalny czas przygotowania posiłku: ${constraints.maxCookingTimeMinutes} minut`;
  }
  if (constraints.preferredCuisines?.length) {
    text += `\n- Preferowane kuchnie: ${constraints.preferredCuisines.join(', ')}`;
  }
  if (constraints.mealSchedule?.length) {
    text += `\n- Harmonogram posiłków: ${constraints.mealSchedule.map((s) => `${s.label} o ${s.time}`).join(', ')}`;
  }
  return text;
}

// ─── 33.3.2 buildDietGeneratePrompt (V1 — DEPRECATED, kept as reference) ────

/** @deprecated Use buildDietGeneratePromptV3. Kept as reference only. */
export function buildDietGeneratePrompt(input: GeneratePromptInput, skipDetailedRecipes = false): PromptResult {
  const { complexityLevel, nutritionTargets: targets, segment, anonymizedProfile, policyContext, preferences, constraints, canonicalProductNames, canonicalProductsGrouped, healthProducts, dislikedProducts } = input;

  const mealCount = segment.mealCount || 4;
  const mealTypes = getMealTypes(mealCount);

  const restrictions = buildRestrictions(segment, policyContext, preferences.intolerances);
  const clinicalSection = buildClinicalSection(complexityLevel, policyContext);
  const productListSection = buildProductListSection(canonicalProductsGrouped ?? canonicalProductNames ?? [], healthProducts, dislikedProducts);
  const patientContext = buildPatientContext(anonymizedProfile);
  const prefsText = buildPreferences(preferences);
  const lifestyleSection = buildLifestyleSection(preferences);
  const constraintText = buildConstraintText(constraints);

  // Compute per-meal calorie distribution
  const mealDistribution = getMealCalorieDistribution(mealTypes, targets.kcal);
  const distributionText = mealDistribution
    .map((m) => `  ${m.name}: ~${m.kcal} kcal (~${m.pct}%)`)
    .join('\n');

  const systemPrompt = `Jesteś doświadczonym dietetykiem klinicznym. Tworzysz spersonalizowane jadłospisy w formacie JSON.

STRUKTURA PLANU:
- 7 dni (${DAY_NAMES.join(', ')})
- ${mealCount} posiłków dziennie: ${mealTypes.join(', ')}
- Docelowe dzienne kalorie: ${targets.kcal} kcal (±5%)
- Makroskładniki: białko ${targets.proteinG}g, tłuszcze ${targets.fatG}g, węglowodany ${targets.carbsG}g (±10%)
${constraintText}

ROZKŁAD KALORII NA POSIŁKI:
${distributionText}

FORMAT DANYCH:
- item.name = nazwa dania (np. "Owsianka z bananem"), item.grams = gramatura porcji
- item.ingredients[] = składniki: [{"name": "DOKŁADNA nazwa z listy produktów", "grams": gramatura_surowego_składnika}]
- Każdy posiłek MUSI mieć pole "recipe": {"prepTimeMin": number, "steps": string[], "tips": string|null}
${skipDetailedRecipes
    ? '- recipe.steps = ["Przygotuj według składników."] — placeholder (szczegóły zostaną dodane automatycznie)\n- WAŻNE: Mimo placeholdera w recipe, wygeneruj KOMPLETNY plan na WSZYSTKIE 7 dni z PEŁNYMI składnikami i gramaturami'
    : '- recipe.steps musi mieć min. 2 kroki przygotowania'}
- Śniadanie/podwieczorek: 2-4 składniki, Obiad/kolacja: 3-6 składników (białko + węgl + warzywo + tłuszcz)

SPÓJNOŚĆ DANIA (KRYTYCZNE — każde danie musi mieć sens kulinarny):
- Nazwa dania MUSI odpowiadać składnikom. "Omlet" = jajka surowe + masło/oliwa + max 2 lekkie dodatki (ser, szczypiorek, pomidor, szpinak, pieczarki). NIE bakłażan, NIE suszone oliwki, NIE chili
- Jajka na omlet/jajecznicę = SUROWE jajka (nie "jajko gotowane"). "Jajko gotowane" używaj TYLKO w sałatkach i kanapkach
- Owsianka = płatki owsiane + mleko/napój roślinny + 1-2 owoce/orzechy. NIE mięso, NIE warzywa warzywne
- KAŻDE danie musi być takie, jakie normalny człowiek ugotowałby w domu
- Gramatura jajek: 1 jajko = ~60g. Omlet z 3 jajek = 180g jajek, NIE 272g
- Realistyczne porcje: mięso 100-180g, ryż suchy 60-100g, warzywa 100-200g, ser 30-50g

GRAMATURY PRAKTYCZNE (KRYTYCZNE):
- Produkty oznaczone "(1szt=Xg)" w liście → gramatura MUSI być wielokrotnością Xg (np. jajko 1szt=60g → dozwolone: 60, 120, 180; NIE 80, 161, 277)
- Produkty oznaczone "(1kromka=Xg)" → gramatura MUSI być wielokrotnością Xg
- Masło/oliwa/olej: 5, 10, 15ml (łyżeczka=5ml, łyżka=15ml)
- Produkty sypkie (kasza, ryż, płatki, makaron): zaokrąglaj do 5g
- Mięso/ryba/warzywa/owoce bez oznaczenia szt: zaokrąglaj do 10g

KRYTYCZNE WYMAGANIA KALORYCZNE:
- Suma kcal WSZYSTKICH items w KAŻDYM dniu MUSI wynosić ${targets.kcal} kcal ±5%
- Dopuszczalny zakres dzienny: ${Math.round(targets.kcal * 0.95)}-${Math.round(targets.kcal * 1.05)} kcal
- Po dodaniu kcal każdego item sprawdź czy suma dzienna jest w zakresie
- Jeśli suma jest za niska — zwiększ porcje lub dodaj kaloryczne składniki
- Jeśli suma jest za wysoka — zmniejsz porcje

RÓŻNORODNOŚĆ (KRYTYCZNE):
- KAŻDE danie w tygodniu MUSI być unikalne — min. 28 różnych nazw dań na 7 dni × 4 posiłki
- Nie powtarzaj tego samego dania ani wariantu (np. "Owsianka z bananem" i "Owsianka z jabłkiem" to za mało różnic)
- Min. 5 różnych źródeł białka w tygodniu (drób, ryby, rośliny strączkowe, nabiał, jaja, wołowina/wieprzowina)
- Min. 3 porcje warzyw dziennie
${segment.allergies?.some(a => /ryb/i.test(a)) ? '' : '- Min. 2 posiłki z tłustymi rybami w tygodniu (łosoś, makrela, śledź, sardynki) — źródło omega-3\n'}- OBIAD MUSI zawierać WSZYSTKIE 4 elementy: 1) białko (mięso/ryba/jajka/rośliny strączkowe) + 2) węglowodany złożone (ryż/kasza gryczana/jaglana/makaron/ziemniaki/kuskus/bulgur) + 3) warzywa + 4) tłuszcz (oliwa/olej/masło). KAŻDY z 7 obiadów MUSI mieć węgle złożone — to jest bezwzględne
- KOLACJA powinna zawierać warzywa + źródło białka
- Podwieczorek/II Śniadanie: jogurt naturalny/grecki z owocami, kanapka, sałatka owocowa — NIE produkty przetworzone
- Rotacja śniadań: owsianki, jajecznice, koktajle, kanapki, placki, musli, smoothie bowle, naleśniki — nie więcej niż 2 owsianki w tygodniu
- Różne metody przygotowania (gotowanie, pieczenie, smażenie, grillowanie, na surowo, duszenie)
- Wartości odżywcze muszą być realistyczne i sumować się poprawnie

ŁĄCZENIE PRODUKTÓW (zasady dietetyczne):
- Produkty bogate w żelazo (szpinak, soczewica, mięso) łącz z witaminą C (papryka, pomidor, cytryna) — lepsze wchłanianie
- NIE łącz nabiału (mleko, jogurt, ser) z produktami bogatymi w żelazo w tym samym posiłku — wapń hamuje wchłanianie żelaza
- Produkty pełnoziarniste łącz z warzywami — lepsze trawienie błonnika

KOMPLETNOŚĆ SKŁADNIKÓW:
- Każdy przepis MUSI zawierać WSZYSTKIE składniki potrzebne do przygotowania, w tym płyny
- Owsianka → płatki owsiane + płyn (mleko, napój migdałowy/kokosowy/owsiany/ryżowy, woda) + dodatki
- Koktajl/smoothie → owoce + płyn (mleko, jogurt, napój roślinny) + ewentualne dodatki
- Sałatka → warzywa + sos/dressing (oliwa, ocet, jogurt itp.)
- Makaron (pszenny, ryżowy, pełnoziarnisty, gryczany itp.) + sos/dodatki + tłuszcz
- Ryż/kasza/bulgur/kuskus → produkt + płyn do gotowania + dodatki
- Nie pomijaj oliwy, masła, mleka, wody, sosów — to składniki kaloryczne wpływające na makro
${restrictions}${lifestyleSection}${clinicalSection}${productListSection}`;

  // Build per-day calorie reminder
  const dailyKcalReminder = `WAŻNE: Każdy dzień MUSI mieć łączną sumę kcal między ${Math.round(targets.kcal * 0.95)} a ${Math.round(targets.kcal * 1.05)} kcal. Sprawdź sumę po stworzeniu każdego dnia.`;

  let userPrompt: string;
  if (complexityLevel === 'COMPLEX') {
    userPrompt = `Stwórz jadłospis na 7 dni dla pacjenta z jednostkami chorobowymi.

PROFIL PACJENTA:
${patientContext}
${prefsText}

CELE ŻYWIENIOWE (po modyfikacji klinicznej):
Kalorie: ${targets.kcal} kcal/dzień | Białko: ${targets.proteinG}g | Tłuszcze: ${targets.fatG}g | Węglowodany: ${targets.carbsG}g

${dailyKcalReminder}

Bezwzględnie przestrzegaj wykluczeń i limitów składników.
Używaj WYŁĄCZNIE nazw produktów z dostarczonej listy.
Wygeneruj KOMPLETNY plan na WSZYSTKIE 7 dni (${DAY_NAMES.join(', ')}).
Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;
  } else {
    userPrompt = `Stwórz jadłospis na 7 dni.

${patientContext}${prefsText}
Kalorie: ${targets.kcal} kcal/dzień | Białko: ${targets.proteinG}g | Tłuszcze: ${targets.fatG}g | Węglowodany: ${targets.carbsG}g

${dailyKcalReminder}

Używaj WYŁĄCZNIE nazw produktów z dostarczonej listy.
Wygeneruj KOMPLETNY plan na WSZYSTKIE 7 dni (${DAY_NAMES.join(', ')}).
Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;
  }

  return { systemPrompt, userPrompt };
}

// ─── 36.2 JSON schema V2 — no kcal/B/T/W per item ──────────────────────────

export const DIET_PLAN_JSON_SCHEMA_V2: Record<string, unknown> = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      ingredients: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            grams: { type: 'number' },
                          },
                          required: ['name', 'grams'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['name', 'ingredients'],
                    additionalProperties: false,
                  },
                },
                recipe: {
                  type: 'object',
                  properties: {
                    prepTimeMin: { type: 'number' },
                    steps: { type: 'array', items: { type: 'string' } },
                    tips: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  },
                  required: ['prepTimeMin', 'steps', 'tips'],
                  additionalProperties: false,
                },
              },
              required: ['name', 'items', 'recipe'],
              additionalProperties: false,
            },
          },
          _dayCheck: {
            type: 'object',
            properties: {
              proteinSourcesCount: { type: 'number' },
              vegetablePortions: { type: 'number' },
              totalProteinGrams: { type: 'number' },
              totalGrainGrams: { type: 'number' },
            },
            required: ['proteinSourcesCount', 'vegetablePortions', 'totalProteinGrams', 'totalGrainGrams'],
            additionalProperties: false,
          },
        },
        required: ['day', 'meals', '_dayCheck'],
        additionalProperties: false,
      },
    },
  },
  required: ['days'],
  additionalProperties: false,
};

// ─── 36.1 buildDietGeneratePromptV2 ─────────────────────────────────────────

/**
 * Compute guideline portion sizes from target kcal.
 * AI uses these as orientation — backend recalculates exact nutrition.
 */
function buildPortionGuidelines(targetKcal: number, mealTypes: string[]): string {
  const mealDist = getMealCalorieDistribution(mealTypes, targetKcal);

  // Rough portion mappings per ingredient category
  const proteinPer100kcal = 65;   // ~65g chicken breast ≈ 100 kcal
  const grainPer100kcal = 30;     // ~30g dry rice ≈ 100 kcal
  const vegPer100kcal = 300;      // ~300g vegetables ≈ 100 kcal
  const fatPer100kcal = 11;       // ~11g oil ≈ 100 kcal

  const guidelines = mealDist.map((m) => {
    const kcal = m.kcal;
    const isMainMeal = ['Śniadanie', 'Obiad', 'Kolacja'].includes(m.name);
    const proteinG = isMainMeal ? Math.round(kcal * 0.30 / 100 * proteinPer100kcal) : Math.round(kcal * 0.20 / 100 * proteinPer100kcal);
    const grainG = Math.round(kcal * 0.35 / 100 * grainPer100kcal);
    const vegG = isMainMeal ? Math.round(kcal * 0.10 / 100 * vegPer100kcal) : Math.round(kcal * 0.05 / 100 * vegPer100kcal);
    const fatG = Math.round(kcal * 0.10 / 100 * fatPer100kcal);

    return `  ${m.name} (~${kcal} kcal, ~${m.pct}%): białko ~${proteinG}g, zboża/węgl. ~${grainG}g, warzywa ~${vegG}g, tłuszcz ~${fatG}g`;
  });

  return guidelines.join('\n');
}

export function buildDietGeneratePromptV2(input: GeneratePromptInput, skipDetailedRecipes = false): PromptResult {
  const { complexityLevel, nutritionTargets: targets, segment, anonymizedProfile, policyContext, preferences, constraints, canonicalProductsGrouped, canonicalProductNames, highlyRatedRecipeNames, healthProducts, dislikedProducts, previousDishNames } = input;

  const mealCount = segment.mealCount || 4;
  const mealTypes = getMealTypes(mealCount);

  const restrictions = buildRestrictions(segment, policyContext, preferences.intolerances);
  const clinicalSection = buildClinicalSection(complexityLevel, policyContext);
  const productListSection = buildProductListSection(canonicalProductsGrouped ?? canonicalProductNames ?? [], healthProducts, dislikedProducts);
  const patientContext = buildPatientContext(anonymizedProfile);
  const lifestyleSection = buildLifestyleSection(preferences);
  const constraintText = buildConstraintText(constraints);
  const portionGuidelines = buildPortionGuidelines(targets.kcal, mealTypes);

  // Build P4 personalization section
  const p4Parts: string[] = [];
  if (preferences.cookingTime || constraints?.maxCookingTimeMinutes) {
    const mins = constraints?.maxCookingTimeMinutes ?? parseInt(preferences.cookingTime ?? '30', 10);
    p4Parts.push(`Pacjent ma max ${mins} min na gotowanie głównego posiłku.`);
  } else {
    p4Parts.push('Domyślne czasy: śniadanie ≤15 min, obiad ≤40 min, kolacja ≤25 min.');
  }
  if (preferences.cuisinePreferences?.length) {
    p4Parts.push(`Min 50% dań z kuchni: ${preferences.cuisinePreferences.join(', ')}.`);
  } else if (constraints?.preferredCuisines?.length) {
    p4Parts.push(`Min 50% dań z kuchni: ${constraints.preferredCuisines.join(', ')}.`);
  } else {
    p4Parts.push('Domyślnie: polska kuchnia domowa (tradycyjna, smaczna, praktyczna).');
  }
  if (preferences.preferredFoods?.length) {
    p4Parts.push(`PREFEROWANE PRODUKTY: min 60% dań powinno zawierać: ${preferences.preferredFoods.join(', ')}. Nie wyklucza to innych składników dla zachowania różnorodności.`);
  }
  if (preferences.dislikedFoods?.length) {
    p4Parts.push(`NIELUBIANE: unikaj w jadłospisie: ${preferences.dislikedFoods.join(', ')}.`);
  }
  if (preferences.budget) {
    const budgetMap: Record<string, string> = {
      niski: 'BUDŻET NISKI: preferuj tańsze składniki (jajka, kurczak, kasza, makaron, warzywa korzeniowe, rośliny strączkowe). Unikaj drogich (łosoś, krewetki, awokado, quinoa, orzechy).',
      średni: 'BUDŻET ŚREDNI: wszystkie składniki dozwolone, balans jakości i ceny.',
      wysoki: 'BUDŻET WYSOKI: możesz używać premium składników (łosoś, owoce morza, orzechy, szparagi, awokado).',
    };
    p4Parts.push(budgetMap[preferences.budget.toLowerCase()] ?? `Budżet: ${preferences.budget}.`);
  }
  if (preferences.additionalNotes) {
    p4Parts.push(`Uwagi pacjenta: ${preferences.additionalNotes}.`);
  }
  if (preferences.supplements?.length) {
    p4Parts.push(`Suplementy: ${preferences.supplements.join(', ')}.`);
  }
  if (preferences.activityTypes?.length) {
    p4Parts.push(`Sporty: ${preferences.activityTypes.join(', ')}.`);
  }
  // 37.7 Meal prep hint
  if (constraints?.maxCookingTimeMinutes && constraints.maxCookingTimeMinutes <= 30) {
    p4Parts.push('Pacjent ma mało czasu — preferuj dania nadające się do przygotowania na 2-3 dni (meal prep, batch cooking).');
  }
  // 38.6 Micronutrient hints based on diet/profile
  const microHints: string[] = [];
  if (segment.dietType === 'wegetariańska' || segment.dietType === 'wegańska') {
    microHints.push('B12 (suplementacja), żelazo (roślinne + wit. C), cynk');
  }
  if (anonymizedProfile.sex === 'F' && (anonymizedProfile.ageYears ?? 30) < 50) {
    microHints.push('żelazo (menstruacja), folian');
  }
  if ((anonymizedProfile.ageYears ?? 30) > 65) {
    microHints.push('wit. D, B12, wapń');
  }
  // Seasonal vitamin D warning (Oct-Mar)
  const month = new Date().getMonth() + 1;
  if (month >= 10 || month <= 3) {
    microHints.push('wit. D (sezon jesienny/zimowy — ograniczona synteza skórna)');
  }
  if (microHints.length > 0) {
    p4Parts.push(`UWAGI MIKROSKŁADNIKOWE: zwróć uwagę na źródła: ${microHints.join('; ')}.`);
  }

  if (highlyRatedRecipeNames?.length) {
    p4Parts.push(`PREFEROWANE DANIA (wysoko oceniane przez pacjentów): ${highlyRatedRecipeNames.join(', ')}. Włącz kilka z nich jeśli pasują do profilu.`);
  }

  const systemPrompt = `Jesteś doświadczonym dietetykiem klinicznym. Tworzysz spersonalizowane jadłospisy w formacie JSON.
Backend obliczy dokładne wartości odżywcze z bazy danych — Ty skupiasz się na doborze składników i gramatur.

═══ P1 — BEZPIECZEŃSTWO (bezwzględne) ═══
${restrictions || 'Brak ograniczeń.'}
${clinicalSection}

═══ P2 — CELE ŻYWIENIOWE (orientacyjne gramatury) ═══
Docelowe dzienne wartości: ~${targets.kcal} kcal | B ~${targets.proteinG}g | T ~${targets.fatG}g | W ~${targets.carbsG}g

ORIENTACYJNE GRAMATURY PER POSIŁEK (backend przeliczy dokładnie):
${portionGuidelines}

Tabela orientacyjna gramatur per typ składnika:
  Białko (mięso/ryba/tofu): 100-180g per posiłek główny
  Węglowodany złożone (ryż/kasza sucha): 50-120g
  Warzywa: 150-250g per posiłek główny
  Tłuszcz (oliwa/masło): 5-15ml
  Nabiał (jogurt/twaróg): 100-200g

═══ P3 — JAKOŚĆ PLANU ═══
STRUKTURA:
- 7 dni (${DAY_NAMES.join(', ')})
- ${mealCount} posiłków dziennie: ${mealTypes.join(', ')}
${constraintText}

RÓŻNORODNOŚĆ (KRYTYCZNE):
- KAŻDE danie w tygodniu MUSI być unikalne — min. ${mealCount * 7} różnych nazw dań
- Nie powtarzaj tego samego dania ani wariantu
- Min. 5 różnych źródeł białka w tygodniu
- Min. 3 porcje warzyw dziennie
- Rotacja śniadań: max 2 owsianki w tygodniu
- Różne metody przygotowania (gotowanie, pieczenie, smażenie, grillowanie, duszenie)${previousDishNames?.length ? `\n\nDANIA Z POPRZEDNIEGO PLANU (NIE powtarzaj — stwórz zupełnie nowe):\n${previousDishNames.slice(0, 50).join(', ')}` : ''}

KOMPLETNOŚĆ SKŁADNIKÓW:
- Każdy przepis MUSI zawierać WSZYSTKIE składniki, w tym płyny i tłuszcze
- Owsianka → płatki + mleko/napój roślinny + dodatki
- Koktajl → owoce + płyn + ewentualne dodatki
- Sałatka → warzywa + sos/dressing
- Nie pomijaj oliwy, masła, mleka — to składniki wpływające na odżywczość

SPÓJNOŚĆ DANIA (KRYTYCZNE — każde danie musi mieć sens kulinarny):
- Nazwa dania MUSI odpowiadać składnikom. "Omlet" = jajka surowe + masło/oliwa + max 2 lekkie dodatki (ser, szczypiorek, pomidor, szpinak, pieczarki). NIE bakłażan, NIE suszone oliwki, NIE chili
- Jajka na omlet/jajecznicę = SUROWE jajka (nie "jajko gotowane"). "Jajko gotowane" używaj TYLKO w sałatkach i kanapkach
- Owsianka = płatki owsiane + mleko/napój roślinny + 1-2 owoce/orzechy. NIE mięso, NIE warzywa warzywne
- Sałatka = warzywa świeże + białko (kurczak/tuńczyk/jajko/ser) + dressing. NIE owoce tropikalne w sałatkach warzywnych
- Kanapka = pieczywo + białko (ser/wędlina/jajko/hummus) + warzywo (pomidor/ogórek/sałata). Max 4-5 składników
- Zupa = baza (bulion/woda) + warzywa + ewentualnie białko + przyprawy. NIE owoce w zupach warzywnych
- Danie z makaronem = makaron + sos (pomidorowy/śmietanowy/pesto) + białko + warzywa
- KAŻDE danie musi być takie, jakie normalny człowiek ugotowałby w domu
- Gramatura jajek: 1 jajko = ~60g. Omlet z 3 jajek = 180g jajek, NIE 272g
- Realistyczne porcje: mięso 100-180g, ryż suchy 60-100g, warzywa 100-200g, ser 30-50g

GRAMATURY PRAKTYCZNE (KRYTYCZNE):
- Produkty oznaczone "(1szt=Xg)" w liście → gramatura MUSI być wielokrotnością Xg (np. jajko 1szt=60g → dozwolone: 60, 120, 180; NIE 80, 161, 277)
- Produkty oznaczone "(1kromka=Xg)" → gramatura MUSI być wielokrotnością Xg
- Masło/oliwa/olej: 5, 10, 15ml (łyżeczka=5ml, łyżka=15ml)
- Produkty sypkie (kasza, ryż, płatki, makaron): zaokrąglaj do 5g
- Mięso/ryba/warzywa/owoce bez oznaczenia szt: zaokrąglaj do 10g
- 2-5 składników (items) per posiłek
${skipDetailedRecipes
    ? '- recipe.steps = ["Przygotuj."] — placeholder, przepisy zostaną uzupełnione osobno'
    : '- Każdy posiłek z recipe (min 2 kroki)'}

═══ P4 — PERSONALIZACJA ═══
${p4Parts.join('\n')}
${lifestyleSection}
${productListSection}

═══ POLE _dayCheck ═══
Dla KAŻDEGO dnia wypełnij pole _dayCheck z szacunkową samokontrolą:
- proteinSourcesCount: ile różnych źródeł białka w tym dniu
- vegetablePortions: ile porcji warzyw
- totalProteinGrams: szacunkowa suma gramatur źródeł białka
- totalGrainGrams: szacunkowa suma gramatur zbóż/węglowodanów`;

  let userPrompt: string;
  if (complexityLevel === 'COMPLEX') {
    userPrompt = `Stwórz jadłospis na 7 dni dla pacjenta z jednostkami chorobowymi.

PROFIL: ${patientContext}

Bezwzględnie przestrzegaj wykluczeń i limitów składników (P1).
Używaj WYŁĄCZNIE nazw produktów z dostarczonej listy.
Wygeneruj KOMPLETNY plan na WSZYSTKIE 7 dni (${DAY_NAMES.join(', ')}).
Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;
  } else {
    userPrompt = `Stwórz jadłospis na 7 dni.

PROFIL: ${patientContext}

Używaj WYŁĄCZNIE nazw produktów z dostarczonej listy.
Wygeneruj KOMPLETNY plan na WSZYSTKIE 7 dni (${DAY_NAMES.join(', ')}).
Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;
  }

  return { systemPrompt, userPrompt };
}

// ─── 36.7 buildRepairPromptV2 ───────────────────────────────────────────────

export function buildRepairPromptV2(input: RepairPromptInput): PromptResult {
  const { violations, violatingContent, preservedMeals, preservedDayNames, existingDishNames, attemptNumber } = input;

  const violationList = violations.map((v) =>
    `- Dzień: ${v.day}, Posiłek: ${v.mealName}, Produkt: "${v.violatingItem}" zawiera "${v.keyword}" (${v.restrictionLevel}${v.reason ? `, powód: ${v.reason}` : ''})`
  ).join('\n');

  const systemPrompt = `Jesteś dietetykiem klinicznym. Naprawiasz jadłospis, w którym wykryto naruszenia ograniczeń żywieniowych.
Backend obliczy wartości odżywcze — Ty skup się na doborze bezpiecznych składników z odpowiednimi gramaturami.

ZADANIE: Zamień TYLKO posiłki z naruszeniami na nowe, bezpieczne alternatywy. NIE zmieniaj posiłków bez naruszeń.

NARUSZENIA (próba ${attemptNumber}):
${violationList}

DNI ZACHOWANE (nie wysyłaj ich): ${preservedDayNames.join(', ')}
ZACHOWANE POSIŁKI w dniach z naruszeniami:
${Object.entries(preservedMeals).map(([day, meals]) => `  ${day}: ${meals.join(', ')}`).join('\n')}

ISTNIEJĄCE DANIA (NIE powtarzaj): ${existingDishNames.join(', ')}

ZASADY:
- Zwróć TYLKO naprawione posiłki w formacie: {"days": [{"day": "...", "meals": [...]}]}
- Każdy posiłek MUSI mieć "recipe" z krokami przygotowania (min. 4 kroki)
- Każdy item: "name" + "ingredients"[{"name","grams"}] — BEZ kcal/protein/fat/carbs
- NIE używaj produktów z naruszeń
- meal.name MUSI być polską nazwą posiłku: Śniadanie, II Śniadanie, Obiad, Podwieczorek, Kolacja
- item.name MUSI być prawdziwą nazwą dania po polsku (np. "Owsianka z bananem", "Grillowany łosoś z warzywami")
- NIGDY nie używaj nazw typu "Posiłek (breakfast)" ani angielskich nazw — zawsze polska nazwa dania`;

  const userPrompt = `Napraw poniższe posiłki:

${JSON.stringify(violatingContent, null, 2)}

Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;

  return { systemPrompt, userPrompt };
}

// ─── 36.8 buildPartialRegenPromptV2 ─────────────────────────────────────────

export function buildPartialRegenPromptV2(input: PartialRegenPromptInput): PromptResult {
  const { targets, currentContent, nutritionTargets, excludeKeywords, clinicalNotes } = input;

  let targetDescription = '';
  if (targets.days?.length) {
    targetDescription += `PEŁNE DNI do regeneracji: ${targets.days.join(', ')}`;
  }
  if (targets.meals?.length) {
    const mealDesc = targets.meals.map((m) => `${m.day} → ${m.meal}`).join(', ');
    targetDescription += `${targetDescription ? '\n' : ''}KONKRETNE POSIŁKI: ${mealDesc}`;
  }

  // Collect existing dish names from non-regenerated parts
  const regenDays = new Set(targets.days ?? []);
  const regenMeals = new Map<string, Set<string>>();
  for (const m of targets.meals ?? []) {
    if (!regenMeals.has(m.day)) regenMeals.set(m.day, new Set());
    regenMeals.get(m.day)!.add(m.meal);
  }

  const existingDishes: string[] = [];
  for (const day of currentContent.days) {
    if (regenDays.has(day.day)) continue;
    const mealSet = regenMeals.get(day.day);
    for (const meal of day.meals) {
      if (mealSet?.has(meal.name)) continue;
      for (const item of meal.items) {
        existingDishes.push(item.name);
      }
    }
  }

  let restrictionsText = '';
  if (excludeKeywords.length > 0) {
    restrictionsText = `\nWYKLUCZONE PRODUKTY: ${excludeKeywords.join(', ')}`;
  }

  let clinicalText = '';
  if (clinicalNotes.length > 0) {
    clinicalText = `\nUWAGI KLINICZNE:\n${clinicalNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;
  }

  const systemPrompt = `Jesteś dietetykiem klinicznym. Regenerujesz wybrane części jadłospisu.
Backend obliczy wartości odżywcze — Ty skup się na doborze składników i gramatur.

${targetDescription}

ORIENTACJA KALORYCZNA (dzienne cele):
~${nutritionTargets.kcal} kcal | B ~${nutritionTargets.proteinG}g | T ~${nutritionTargets.fatG}g | W ~${nutritionTargets.carbsG}g

ISTNIEJĄCE DANIA (NIE powtarzaj): ${existingDishes.slice(0, 50).join(', ')}
${restrictionsText}${clinicalText}

ZASADY:
- Zwróć TYLKO regenerowane dni/posiłki: {"days": [{"day": "...", "meals": [...]}]}
- Każdy posiłek MUSI mieć "recipe" z krokami przygotowania
- Każdy item: "name" + "ingredients"[{"name","grams"}] — BEZ kcal/protein/fat/carbs
- Przepis MUSI zawierać WSZYSTKIE składniki (w tym płyny, tłuszcze, sosy)`;

  const userPrompt = `Zregeneruj wskazane posiłki/dni. Kontekst aktualnego planu:

${JSON.stringify(currentContent, null, 2)}

Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;

  return { systemPrompt, userPrompt };
}

// ─── 71.v3 buildPartialRegenPromptV3 ─────────────────────────────────────────

export function buildPartialRegenPromptV3(input: PartialRegenPromptInput): PromptResult {
  const { targets, currentContent, nutritionTargets, excludeKeywords, clinicalNotes } = input;

  let targetDescription = '';
  if (targets.days?.length) {
    targetDescription += `PEŁNE DNI do regeneracji: ${targets.days.join(', ')}`;
  }
  if (targets.meals?.length) {
    const mealDesc = targets.meals.map((m) => `${m.day} → ${m.meal}`).join(', ');
    targetDescription += `${targetDescription ? '\n' : ''}KONKRETNE POSIŁKI: ${mealDesc}`;
  }

  // Collect existing dish names from non-regenerated parts
  const regenDays = new Set(targets.days ?? []);
  const regenMeals = new Map<string, Set<string>>();
  for (const m of targets.meals ?? []) {
    if (!regenMeals.has(m.day)) regenMeals.set(m.day, new Set());
    regenMeals.get(m.day)!.add(m.meal);
  }

  const existingDishes: string[] = [];
  for (const day of currentContent.days) {
    if (regenDays.has(day.day)) continue;
    const mealSet = regenMeals.get(day.day);
    for (const meal of day.meals) {
      if (mealSet?.has(meal.name)) continue;
      for (const item of meal.items) {
        existingDishes.push(item.name);
      }
    }
  }

  let restrictionsText = '';
  if (excludeKeywords.length > 0) {
    restrictionsText = `\nWYKLUCZONE PRODUKTY: ${excludeKeywords.join(', ')}`;
  }

  let clinicalText = '';
  if (clinicalNotes.length > 0) {
    clinicalText = `\nUWAGI KLINICZNE:\n${clinicalNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;
  }

  const kcalLow = Math.round(nutritionTargets.kcal * 0.90);
  const kcalHigh = Math.round(nutritionTargets.kcal * 1.10);

  const systemPrompt = `Jesteś doświadczonym dietetykiem klinicznym. Regenerujesz wybrane części jadłospisu.
Backend obliczy wartości odżywcze — Ty skup się na doborze składników i gramatur.

${targetDescription}

═══ P1 — BEZPIECZEŃSTWO (bezwzględne) ═══
${restrictionsText || 'Brak ograniczeń.'}
PRODUKTY WĘDZONE: ZAKAZ jako główne białko w obiedzie. Wędzone dopuszczalne WYŁĄCZNIE w kanapkach/sałatkach, max 2x/tydzień.
JAJKA: BEZWZGLĘDNIE max 7 sztuk na tydzień.${clinicalText}

═══ P2 — CELE ŻYWIENIOWE ═══
Dzienne wartości: ~${nutritionTargets.kcal} kcal | B ~${nutritionTargets.proteinG}g | T ~${nutritionTargets.fatG}g | W ~${nutritionTargets.carbsG}g
Dopuszczalny zakres dzienny: ${kcalLow}-${kcalHigh} kcal (±10%)

TABELA KALORYCZNOŚCI (kcal/100g):
  Pierś z kurczaka: 110 | Łosoś: 208 | Dorsz: 82 | Jajko: 155 (1szt≈93kcal)
  Ryż brązowy (suchy): 350 | Kasza gryczana (sucha): 340 | Makaron (suchy): 350 | Ziemniaki: 77
  Płatki owsiane: 370 | Chleb razowy: 220 | Oliwa/olej: 880 | Masło: 740
  Jogurt naturalny: 60 | Twaróg chudy: 100 | Banan: 90 | Jabłko: 52

ISTNIEJĄCE DANIA (NIE powtarzaj): ${existingDishes.slice(0, 50).join(', ')}

═══ P3 — JAKOŚĆ ═══
- OBIAD: min. 4 elementy (białko 100-180g + węglowodan 50-120g + warzywa 150-250g + tłuszcz 5-15g)
- Kolacja lżejsza niż obiad, rotacja typów (sałatka/zupa/omlet/kanapka/wrap/zapiekanka)
- Każde danie unikalne — NIE powtarzaj nazw istniejących dań
- Min. 2 źródła białka per dzień, min. 3 porcje warzyw
- "Jajko gotowane" TYLKO w sałatkach i kanapkach. Do omletu/jajecznicy = jajka surowe
- Każdy przepis MUSI zawierać WSZYSTKIE składniki (płyny, tłuszcze, sosy)

GRAMATURY:
- Produkty (1szt=Xg) → gramatura wielokrotnością X
- Masło/oliwa/olej: wielokrotność 5g
- Sypkie (kasza, ryż, makaron): zaokrąglaj do 5g
- Reszta: zaokrąglaj do 10g

ZASADY:
- Zwróć TYLKO regenerowane dni/posiłki: {"days": [{"day": "...", "meals": [...], "_dayCheck": {...}}]}
- Każdy posiłek MUSI mieć "recipe" z krokami przygotowania
- Każdy item: "name" + "ingredients"[{"name","grams"}] — BEZ kcal/protein/fat/carbs
- Wypełnij _dayCheck per dzień (estimatedDayKcal, proteinSourcesCount, vegetablePortions, totalProteinGrams, totalGrainGrams, uniqueDishNames)
- estimatedDayKcal MUSI być w zakresie ${kcalLow}-${kcalHigh}`;

  const userPrompt = `Zregeneruj wskazane posiłki/dni. Kontekst aktualnego planu:

${JSON.stringify(currentContent, null, 2)}

Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;

  return { systemPrompt, userPrompt };
}

// ─── V3 partial JSON schema (no _weekSummary, only _dayCheck) ───────────────

export const DIET_PLAN_JSON_SCHEMA_V3_PARTIAL: Record<string, unknown> = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      ingredients: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            grams: { type: 'number' },
                          },
                          required: ['name', 'grams'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['name', 'ingredients'],
                    additionalProperties: false,
                  },
                },
                recipe: {
                  type: 'object',
                  properties: {
                    prepTimeMin: { type: 'number' },
                    steps: { type: 'array', items: { type: 'string' } },
                    tips: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  },
                  required: ['prepTimeMin', 'steps', 'tips'],
                  additionalProperties: false,
                },
              },
              required: ['name', 'items', 'recipe'],
              additionalProperties: false,
            },
          },
          _dayCheck: {
            type: 'object',
            properties: {
              estimatedDayKcal: { type: 'number' },
              proteinSourcesCount: { type: 'number' },
              vegetablePortions: { type: 'number' },
              totalProteinGrams: { type: 'number' },
              totalGrainGrams: { type: 'number' },
              uniqueDishNames: { type: 'array', items: { type: 'string' } },
            },
            required: ['estimatedDayKcal', 'proteinSourcesCount', 'vegetablePortions', 'totalProteinGrams', 'totalGrainGrams', 'uniqueDishNames'],
            additionalProperties: false,
          },
        },
        required: ['day', 'meals', '_dayCheck'],
        additionalProperties: false,
      },
    },
  },
  required: ['days'],
  additionalProperties: false,
};

// ─── Patient Day Regeneration prompt ─────────────────────────────────────────

export function buildPatientDayRegenPrompt(input: PatientDayRegenInput): PromptResult {
  const {
    dayName, reason, keepSimilar, currentContent, originalDay,
    nutritionTargets: targets, segment, anonymizedProfile, policyContext,
    preferences, canonicalProductsGrouped, canonicalProductNames,
    highlyRatedRecipeNames, healthProducts, dislikedProducts,
  } = input;

  const mealCount = segment.mealCount || 4;
  const mealTypes = getMealTypes(mealCount);
  const restrictions = buildRestrictions(
    { ...segment, kcalBucket: targets.kcal } as GeneratePromptInput['segment'],
    policyContext,
    preferences.intolerances,
  );
  const clinicalSection = buildClinicalSection(
    policyContext.clinicalNotes?.length ? 'COMPLEX' : 'SIMPLE',
    policyContext,
  );
  const productListSection = buildProductListSection(
    canonicalProductsGrouped ?? canonicalProductNames ?? [],
    healthProducts,
    dislikedProducts,
  );
  const patientContext = buildPatientContext(anonymizedProfile);

  // ─── Weekly analysis from remaining 6 days ───────────────────────────────
  const otherDays = currentContent.days.filter((d) => d.day !== dayName);
  const existingDishes: string[] = [];
  const proteinPerDay: string[] = [];
  const carbPerDay: string[] = [];

  for (const day of otherDays) {
    const dayProteins: string[] = [];
    const dayCarbs: string[] = [];
    for (const meal of day.meals) {
      existingDishes.push(...meal.items.map((item) => item.name));
      for (const item of meal.items) {
        const ings = (item as unknown as Record<string, unknown>).ingredients as
          | Array<{ name: string; grams: number }>
          | undefined;
        if (!ings) continue;
        for (const ing of ings) {
          const name = ing.name.toLowerCase();
          if (/kurczak|indyk|łosoś|dorsz|tuńczyk|wołowin|wieprzow|tofu|soczewic|ciecierzyc|jaj[ko]|twaróg/i.test(name)) {
            dayProteins.push(ing.name);
          }
          if (/ryż|kasza|makaron|ziemniak|bulgur|kuskus|quinoa|chleb|płatki/i.test(name)) {
            dayCarbs.push(ing.name);
          }
        }
      }
    }
    if (dayProteins.length > 0) {
      proteinPerDay.push(`${day.day}: ${[...new Set(dayProteins)].join(', ')}`);
    }
    if (dayCarbs.length > 0) {
      carbPerDay.push(`${day.day}: ${[...new Set(dayCarbs)].join(', ')}`);
    }
  }

  // ─── Original day dishes (what patient rejected) ─────────────────────────
  const rejectedDishes = originalDay.meals.map((m) => m.items.map((i) => i.name)).flat();
  const originalIngredients: string[] = [];
  for (const meal of originalDay.meals) {
    for (const item of meal.items) {
      const ings = (item as unknown as Record<string, unknown>).ingredients as
        | Array<{ name: string; grams: number }>
        | undefined;
      if (ings) {
        for (const ing of ings) {
          if (ing.grams > 10) originalIngredients.push(ing.name);
        }
      }
    }
  }
  const mainIngredients = [...new Set(originalIngredients)];

  // ─── Reason-specific instructions ────────────────────────────────────────
  let reasonInstruction: string;
  switch (reason) {
    case 'DONT_LIKE':
      reasonInstruction = `Pacjent NIE LUBI dań z tego dnia. Wygeneruj KOMPLETNIE inne dania.
ODRZUCONE DANIA (NIE używaj): ${rejectedDishes.join(', ')}.
Zaproponuj inne smaki, inne techniki gotowania, inne połączenia składników.`;
      break;
    case 'TOO_COMPLEX':
      reasonInstruction = `Pacjent uważa posiłki za ZBYT SKOMPLIKOWANE.
ZASADY PROSTOTY:
- Max 15 min przygotowania per posiłek
- Max 5 składników per danie (+ przyprawy)
- Proste techniki: gotowanie, mieszanie, smarowanie — unikaj pieczenia, duszenia, wieloetapowych
- Preferuj: owsianka, kanapki, sałatki, jajecznica, gotowany ryż + białko`;
      break;
    case 'NO_INGREDIENTS':
      reasonInstruction = `Pacjent NIE MA DOSTĘPU do składników z oryginalnego dnia.
ZASADY DOSTĘPNOŚCI:
- Używaj TYLKO produktów dostępnych w każdym dyskoncie (Biedronka, Lidl, Żabka)
- Preferuj: jajka, kurczak, ryż, makaron, chleb, masło, ser żółty, jogurt, pomidory, ogórek, marchew, jabłka, banany
- Unikaj: egzotycznych produktów, świeżych ziół (basil, rukola), specjalistycznych (tahini, tofu, quinoa)
- Preferuj produkty z dłuższą datą ważności`;
      break;
  }

  // ─── Keep similar ingredients ────────────────────────────────────────────
  let keepSimilarText = '';
  if (keepSimilar && mainIngredients.length > 0) {
    // Find primary protein and carb from original day
    const origProteins = mainIngredients.filter((n) =>
      /kurczak|indyk|łosoś|dorsz|tuńczyk|wołowin|wieprzow|tofu|soczewic|ciecierzyc|jaj[ko]|twaróg|ser /i.test(n),
    );
    const origCarbs = mainIngredients.filter((n) =>
      /ryż|kasza|makaron|ziemniak|bulgur|kuskus|quinoa|chleb|płatki/i.test(n),
    );
    keepSimilarText = `\nZACHOWAJ PODOBNE SKŁADNIKI (pacjent już je kupił):`;
    if (origProteins.length) keepSimilarText += `\n- Białko: ${origProteins.join(', ')} — użyj w nowych daniach`;
    if (origCarbs.length) keepSimilarText += `\n- Węglowodany: ${origCarbs.join(', ')} — użyj w nowych daniach`;
    keepSimilarText += `\nZmień DANIA (inne nazwy, inne przygotowanie), ale zachowaj te bazowe składniki.`;
  }

  // ─── Cooking time ────────────────────────────────────────────────────────
  let cookingTimeText = '';
  if (reason === 'TOO_COMPLEX') {
    cookingTimeText = 'Max czas gotowania: 15 min per posiłek.';
  } else if (preferences.cookingTime) {
    cookingTimeText = `Max czas gotowania: ${preferences.cookingTime} min.`;
  }

  const kcalLow = Math.round(targets.kcal * 0.90);
  const kcalHigh = Math.round(targets.kcal * 1.10);

  const systemPrompt = `Jesteś doświadczonym dietetykiem klinicznym. Regenerujesz JEDEN dzień jadłospisu na prośbę pacjenta.
Backend obliczy dokładne wartości odżywcze — Ty skup się na doborze składników i gramatur.

REGENEROWANY DZIEŃ: ${dayName}

═══ POWÓD ZMIANY ═══
${reasonInstruction}${keepSimilarText}

═══ P1 — BEZPIECZEŃSTWO (bezwzględne) ═══
${restrictions || 'Brak ograniczeń.'}
${clinicalSection}

═══ P2 — CELE ŻYWIENIOWE ═══
PROFIL: ${patientContext}
Dzienne wartości: ~${targets.kcal} kcal | B ~${targets.proteinG}g | T ~${targets.fatG}g | W ~${targets.carbsG}g
Dopuszczalny zakres: ${kcalLow}-${kcalHigh} kcal (±10%)
${cookingTimeText}

TABELA KALORYCZNOŚCI (kcal/100g):
  Pierś z kurczaka: 110 | Łosoś: 208 | Dorsz: 82 | Jajko: 155 (1szt≈93kcal)
  Ryż brązowy (suchy): 350 | Kasza gryczana (sucha): 340 | Makaron (suchy): 350 | Ziemniaki: 77
  Płatki owsiane: 370 | Chleb razowy: 220 | Oliwa/olej: 880 | Masło: 740
  Jogurt naturalny: 60 | Twaróg chudy: 100 | Banan: 90 | Jabłko: 52
PRZELICZAJ: kcal = suma(grams × kcal/100g ÷ 100). Suma dnia MUSI być ${kcalLow}-${kcalHigh} kcal.

═══ P3 — KONTEKST TYGODNIA ═══
DANIA Z POZOSTAŁYCH DNI (NIE powtarzaj): ${existingDishes.slice(0, 60).join(', ')}

BIAŁKO W TYGODNIU (zachowaj rotację):
${proteinPerDay.join('\n') || 'Brak danych'}
→ Wybierz białko którego BRAKUJE w tygodniu (min. 5 źródeł: drób, ryby, rośliny strączkowe, nabiał, jaja)

WĘGLOWODANY W TYGODNIU:
${carbPerDay.join('\n') || 'Brak danych'}
→ Nie powtarzaj tego samego węglowodanu 3 dni z rzędu

═══ P4 — JAKOŚĆ ═══
STRUKTURA: ${mealCount} posiłków: ${mealTypes.join(', ')}
- OBIAD: min. 4 elementy (białko 100-180g + węglowodan 50-120g + warzywa 150-250g + tłuszcz 5-15g)
- Kolacja lżejsza niż obiad
- Min. 2 źródła białka w dniu, min. 3 porcje warzyw
- Każdy przepis MUSI mieć WSZYSTKIE składniki (płyny, tłuszcze, sosy)
- "Jajko gotowane" TYLKO w sałatkach/kanapkach. Do omletu = jajka surowe.

GRAMATURY:
- Jajko 1szt=60g → wielokrotność 60g
- Masło/oliwa/olej: wielokrotność 5g
- Sypkie (kasza, ryż, makaron): zaokrąglaj do 5g
- Reszta: zaokrąglaj do 10g
${productListSection}

FORMAT ODPOWIEDZI:
Zwróć JSON: {"days": [{"day": "${dayName}", "meals": [...], "_dayCheck": {...}}]}
Każdy item: "name" + "ingredients"[{"name","grams"}] — BEZ kcal/protein/fat/carbs (backend obliczy)
Każdy posiłek MUSI mieć "recipe": {"prepTimeMin": N, "steps": [...], "tips": "..."}
_dayCheck: {"estimatedDayKcal": N, "proteinSourcesCount": N, "vegetablePortions": N, "totalProteinGrams": N, "totalGrainGrams": N, "uniqueDishNames": [...]}
estimatedDayKcal MUSI być w zakresie ${kcalLow}-${kcalHigh}.`;

  const userPrompt = `Wygeneruj nowy dzień "${dayName}" dla pacjenta. Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;

  return { systemPrompt, userPrompt };
}

// ─── V3 JSON schema — extended _dayCheck with uniqueDishNames ───────────────

export const DIET_PLAN_JSON_SCHEMA_V3: Record<string, unknown> = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      ingredients: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            grams: { type: 'number' },
                          },
                          required: ['name', 'grams'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['name', 'ingredients'],
                    additionalProperties: false,
                  },
                },
                recipe: {
                  type: 'object',
                  properties: {
                    prepTimeMin: { type: 'number' },
                    steps: { type: 'array', items: { type: 'string' } },
                    tips: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  },
                  required: ['prepTimeMin', 'steps', 'tips'],
                  additionalProperties: false,
                },
              },
              required: ['name', 'items', 'recipe'],
              additionalProperties: false,
            },
          },
          _dayCheck: {
            type: 'object',
            properties: {
              estimatedDayKcal: { type: 'number' },
              proteinSourcesCount: { type: 'number' },
              vegetablePortions: { type: 'number' },
              totalProteinGrams: { type: 'number' },
              totalGrainGrams: { type: 'number' },
              uniqueDishNames: { type: 'array', items: { type: 'string' } },
            },
            required: ['estimatedDayKcal', 'proteinSourcesCount', 'vegetablePortions', 'totalProteinGrams', 'totalGrainGrams', 'uniqueDishNames'],
            additionalProperties: false,
          },
        },
        required: ['day', 'meals', '_dayCheck'],
        additionalProperties: false,
      },
    },
    _weekSummary: {
      type: 'object',
      properties: {
        allDishNames: { type: 'array', items: { type: 'string' } },
        uniqueDishCount: { type: 'number' },
        proteinSourcesUsed: { type: 'array', items: { type: 'string' } },
        overusedIngredients: { type: 'array', items: { type: 'string' } },
      },
      required: ['allDishNames', 'uniqueDishCount', 'proteinSourcesUsed', 'overusedIngredients'],
      additionalProperties: false,
    },
  },
  required: ['days', '_weekSummary'],
  additionalProperties: false,
};

// ─── V3 few-shot example ────────────────────────────────────────────────────

function buildFewShotExample(mealTypes: string[], targetKcal: number, mealCount: number): string {
  // Adapt example based on meal count
  const has2ndBreakfast = mealTypes.includes('II Śniadanie');
  const hasSnack = mealTypes.includes('Podwieczorek');

  const meals: string[] = [];

  meals.push(`    {"name": "Śniadanie", "items": [
      {"name": "Owsianka z bananem i orzechami", "ingredients": [
        {"name": "Płatki owsiane", "grams": 60},
        {"name": "Mleko 2%", "grams": 200},
        {"name": "Banan", "grams": 120},
        {"name": "Orzechy włoskie", "grams": 15}
      ]}
    ], "recipe": {"prepTimeMin": 10, "steps": ["Przygotuj."], "tips": "Można dodać łyżeczkę miodu lub cynamon."}}`);

  if (has2ndBreakfast) {
    meals.push(`    {"name": "II Śniadanie", "items": [
      {"name": "Kanapka z hummusem i warzywami", "ingredients": [
        {"name": "Chleb żytni razowy", "grams": 70},
        {"name": "Hummus", "grams": 40},
        {"name": "Ogórek", "grams": 60},
        {"name": "Pomidor", "grams": 80}
      ]}
    ], "recipe": {"prepTimeMin": 5, "steps": ["Przygotuj."], "tips": "Można zastąpić hummus pastą z awokado."}}`);
  }

  meals.push(`    {"name": "Obiad", "items": [
      {"name": "Pierś z kurczaka z kaszą gryczaną i surówką", "ingredients": [
        {"name": "Pierś z kurczaka", "grams": 150},
        {"name": "Kasza gryczana", "grams": 80},
        {"name": "Marchew", "grams": 100},
        {"name": "Kapusta biała", "grams": 100},
        {"name": "Oliwa z oliwek", "grams": 10}
      ]}
    ], "recipe": {"prepTimeMin": 35, "steps": ["Przygotuj."], "tips": "Kaszę można przygotować dzień wcześniej."}}`);

  if (hasSnack) {
    meals.push(`    {"name": "Podwieczorek", "items": [
      {"name": "Jogurt grecki z jagodami", "ingredients": [
        {"name": "Jogurt naturalny", "grams": 150},
        {"name": "Jagody", "grams": 80}
      ]}
    ], "recipe": {"prepTimeMin": 3, "steps": ["Przygotuj."], "tips": "Można dodać łyżkę granoli."}}`);
  }

  meals.push(`    {"name": "Kolacja", "items": [
      {"name": "Jajecznica z pomidorem na chlebie", "ingredients": [
        {"name": "Jajko kurze", "grams": 120},
        {"name": "Pomidor", "grams": 80},
        {"name": "Masło extra 82%", "grams": 10},
        {"name": "Chleb żytni razowy", "grams": 70}
      ]}
    ], "recipe": {"prepTimeMin": 10, "steps": ["Przygotuj."], "tips": "Smakuje też ze szczypiorkiem."}}`);

  const dishNames = [
    '"Owsianka z bananem i orzechami"',
    ...(has2ndBreakfast ? ['"Kanapka z hummusem i warzywami"'] : []),
    '"Pierś z kurczaka z kaszą gryczaną i surówką"',
    ...(hasSnack ? ['"Jogurt grecki z jagodami"'] : []),
    '"Jajecznica z pomidorem na chlebie"',
  ];

  return `═══ PRZYKŁAD WZORCOWY (1 dzień — naśladuj strukturę, NIE kopiuj dań) ═══
{"days": [{"day": "Poniedziałek", "meals": [
${meals.join(',\n')}
  ], "_dayCheck": {"estimatedDayKcal": ${targetKcal}, "proteinSourcesCount": 3, "vegetablePortions": 3, "totalProteinGrams": 420, "totalGrainGrams": 210, "uniqueDishNames": [${dishNames.join(', ')}]}},
  ... (pozostałe 6 dni z UNIKALNYMI daniami) ...
], "_weekSummary": {"allDishNames": ["(wszystkie ${mealCount * 7} unikalnych nazw dań)"], "uniqueDishCount": ${mealCount * 7}, "proteinSourcesUsed": ["kurczak", "ryba", "jajka", "indyk", "soczewica"], "overusedIngredients": []}}
═══ KONIEC PRZYKŁADU ═══`;
}

// ─── V3 prompt builder ──────────────────────────────────────────────────────

export function buildDietGeneratePromptV3(input: GeneratePromptInput, skipDetailedRecipes = false): PromptResult {
  const { complexityLevel, nutritionTargets: targets, segment, anonymizedProfile, policyContext, preferences, constraints, canonicalProductsGrouped, canonicalProductNames, highlyRatedRecipeNames, healthProducts, dislikedProducts, previousDishNames } = input;

  const mealCount = segment.mealCount || 4;
  const mealTypes = getMealTypes(mealCount);

  const restrictions = buildRestrictions(segment, policyContext, preferences.intolerances);
  const clinicalSection = buildClinicalSection(complexityLevel, policyContext);
  const productListSection = buildProductListSection(canonicalProductsGrouped ?? canonicalProductNames ?? [], healthProducts, dislikedProducts);
  const patientContext = buildPatientContext(anonymizedProfile);
  const lifestyleSection = buildLifestyleSection(preferences);
  const constraintText = buildConstraintText(constraints);
  const portionGuidelines = buildPortionGuidelines(targets.kcal, mealTypes);
  const fewShot = buildFewShotExample(mealTypes, targets.kcal, mealCount);

  // P4 personalization
  const p4Parts: string[] = [];
  if (preferences.cookingTime || constraints?.maxCookingTimeMinutes) {
    const mins = constraints?.maxCookingTimeMinutes ?? parseInt(preferences.cookingTime ?? '30', 10);
    p4Parts.push(`Max czas gotowania: ${mins} min.`);
  } else {
    p4Parts.push('Czasy: śniadanie ≤15 min, obiad ≤40 min, kolacja ≤25 min.');
  }
  if (preferences.cuisinePreferences?.length) {
    p4Parts.push(`Min 50% dań z kuchni: ${preferences.cuisinePreferences.join(', ')}.`);
  } else if (constraints?.preferredCuisines?.length) {
    p4Parts.push(`Min 50% dań z kuchni: ${constraints.preferredCuisines.join(', ')}.`);
  } else {
    p4Parts.push('Domyślnie: polska kuchnia domowa.');
  }
  if (preferences.preferredFoods?.length) {
    p4Parts.push(`PREFEROWANE: min 60% dań z: ${preferences.preferredFoods.join(', ')}.`);
  }
  if (preferences.dislikedFoods?.length) {
    p4Parts.push(`NIELUBIANE: unikaj: ${preferences.dislikedFoods.join(', ')}.`);
  }
  if (preferences.budget) {
    const budgetMap: Record<string, string> = {
      niski: 'BUDŻET NISKI: tańsze składniki (jajka, kurczak, kasza, makaron, warzywa korzeniowe). Unikaj łososia, krewetek, awokado.',
      średni: 'BUDŻET ŚREDNI: balans jakości i ceny.',
      wysoki: 'BUDŻET WYSOKI: dozwolone premium (łosoś, owoce morza, orzechy, szparagi).',
    };
    p4Parts.push(budgetMap[preferences.budget.toLowerCase()] ?? `Budżet: ${preferences.budget}.`);
  }
  if (preferences.additionalNotes) p4Parts.push(`Uwagi: ${preferences.additionalNotes}.`);
  if (preferences.supplements?.length) p4Parts.push(`Suplementy: ${preferences.supplements.join(', ')}.`);
  if (preferences.activityTypes?.length) p4Parts.push(`Sporty: ${preferences.activityTypes.join(', ')}.`);
  if (constraints?.maxCookingTimeMinutes && constraints.maxCookingTimeMinutes <= 30) {
    p4Parts.push('Mało czasu — preferuj dania meal prep (na 2-3 dni).');
  }

  // Micronutrient hints
  const microHints: string[] = [];
  if (segment.dietType === 'wegetariańska' || segment.dietType === 'wegańska') {
    microHints.push('B12, żelazo (roślinne + wit. C), cynk');
  }
  if (anonymizedProfile.sex === 'F' && (anonymizedProfile.ageYears ?? 30) < 50) {
    microHints.push('żelazo, folian');
  }
  if ((anonymizedProfile.ageYears ?? 30) > 65) {
    microHints.push('wit. D, B12, wapń');
  }
  const month = new Date().getMonth() + 1;
  if (month >= 10 || month <= 3) {
    microHints.push('wit. D (sezon jesienny/zimowy)');
  }
  if (microHints.length > 0) {
    p4Parts.push(`MIKROSKŁADNIKI: uwzględnij źródła: ${microHints.join('; ')}.`);
  }

  if (highlyRatedRecipeNames?.length) {
    p4Parts.push(`PREFEROWANE DANIA: ${highlyRatedRecipeNames.join(', ')}. Włącz kilka jeśli pasują.`);
  }

  const systemPrompt = `Jesteś doświadczonym dietetykiem klinicznym. Tworzysz spersonalizowane jadłospisy w formacie JSON.
Backend obliczy dokładne wartości odżywcze — Ty skupiasz się na doborze składników i gramatur.

═══ P1 — BEZPIECZEŃSTWO (bezwzględne) ═══
${restrictions || 'Brak ograniczeń.'}
${clinicalSection}

═══ P2 — CELE ŻYWIENIOWE (KRYTYCZNE — sprawdzaj po każdym dniu!) ═══
Dzienne wartości: ~${targets.kcal} kcal | B ~${targets.proteinG}g | T ~${targets.fatG}g | W ~${targets.carbsG}g
Dopuszczalny zakres dzienny: ${Math.round(targets.kcal * 0.90)}-${Math.round(targets.kcal * 1.10)} kcal (±10%)
Makroskładniki: B ${Math.round(targets.proteinG * 0.85)}-${Math.round(targets.proteinG * 1.15)}g | T ${Math.round(targets.fatG * 0.85)}-${Math.round(targets.fatG * 1.15)}g | W ${Math.round(targets.carbsG * 0.85)}-${Math.round(targets.carbsG * 1.15)}g (±15%)
WAŻNE: Po stworzeniu KAŻDEGO dnia szacuj sumę kcal i makro. Jeśli dzień wykracza poza zakres — popraw gramatury ZANIM przejdziesz do następnego dnia.

ORIENTACYJNE GRAMATURY PER POSIŁEK:
${portionGuidelines}

TABELA KALORYCZNOŚCI (kcal/100g — używaj do szacowania sum dziennych):
  Pierś z kurczaka: 110 | Indyk filet: 105 | Wołowina chuda: 150 | Wieprzowina polędwica: 145
  Łosoś: 208 | Dorsz: 82 | Tuńczyk (puszka): 130 | Jajko kurze: 155 (1szt≈93kcal)
  Ryż brązowy (suchy): 350 | Kasza gryczana (sucha): 340 | Makaron (suchy): 350 | Ziemniaki: 77
  Płatki owsiane: 370 | Chleb razowy: 220 | Bulgur (suchy): 340 | Kasza jaglana (sucha): 350
  Oliwa/olej: 880 | Masło: 740 | Orzechy włoskie: 650 | Migdały: 580
  Jogurt naturalny: 60 | Twaróg chudy: 100 | Ser żółty: 350 | Mleko 2%: 50
  Banan: 90 | Jabłko: 52 | Marchew: 35 | Brokuły: 34 | Szpinak: 23
  Soczewica gotowana: 116 | Ciecierzyca gotowana: 160 | Hummus: 170
PRZELICZAJ: kcal dania = suma(grams × kcal/100g ÷ 100) dla każdego składnika. Suma dnia musi wynosić ${Math.round(targets.kcal * 0.90)}-${Math.round(targets.kcal * 1.10)} kcal.

═══ P3 — JAKOŚĆ PLANU ═══
STRUKTURA: 7 dni (${DAY_NAMES.join(', ')}), ${mealCount} posiłków: ${mealTypes.join(', ')}
${constraintText}

WZORCE DAŃ (dozwolone kombinacje składników):
- Omlet/jajecznica: jajka surowe + masło/oliwa + max 2 z [ser, szczypiorek, pomidor, szpinak, pieczarki, papryka]
- Owsianka: płatki owsiane + mleko/napój roślinny + max 2 z [banan, jagody, orzechy, miód, cynamon, jabłko]
- Sałatka: warzywa świeże + białko (kurczak/tuńczyk/jajko gotowane/ser) + dressing (oliwa/jogurt)
- Kanapka: pieczywo + białko (ser/wędlina/jajko/hummus) + warzywo (max 4-5 składników)
- Koktajl/smoothie: owoce + płyn (mleko/jogurt) + opcjonalnie orzechy/nasiona
- Zupa: bulion/woda + warzywa + opcjonalnie białko + przyprawy
- OBIAD (OBOWIĄZKOWE min. 4 elementy w KAŻDYM z 7 obiadów):
  1) BIAŁKO (100-180g): kurczak, indyk, wołowina, wieprzowina, ryba, jajka, tofu, soczewica, ciecierzyca
  2) WĘGLOWODAN ZŁOŻONY (50-120g suchy): ryż, kasza gryczana/jaglana, makaron, ziemniaki, bulgur, kuskus
  3) WARZYWA (150-250g): brokuły, marchew, cukinia, papryka, szpinak, kalafior, fasolka szparagowa
  4) TŁUSZCZ (5-15g): oliwa z oliwek, masło, olej rzepakowy
  Przykład ✓: "Łosoś z ryżem i surówką z marchewki" (białko+węgl+warzywa+tłuszcz)
  Przykład ✗: "Pierogi ruskie" (brak osobnego białka, warzyw, tłuszczu)
- KOLACJA (ROTACJA TYPÓW — OBOWIĄZKOWA, max 2 sałatki w tygodniu):
  Dzień 1: sałatka z białkiem | Dzień 2: zupa krem z warzywami | Dzień 3: omlet/jajecznica z warzywami | Dzień 4: kanapki z białkiem i warzywami | Dzień 5: wrap/tortilla z białkiem | Dzień 6: warzywa zapiekane/duszone z białkiem | Dzień 7: zupa lub danie ciepłe
  ZAKAZ: więcej niż 2 sałatki na kolację w tygodniu. ZAKAZ: ta sama kategoria kolacji 2 dni pod rząd.
  Kolacja: białko + warzywa + opcjonalnie lekki węglowodan. Lżejsza niż obiad.
  Kolacja min. 2-3h przed snem — unikaj smażonych/ciężkostrawnych. Preferuj źródła tryptofanu (nabiał, indyk, jajka).
- "Jajko gotowane" TYLKO w sałatkach i kanapkach. Do omletu/jajecznicy = jajka surowe.
- KAŻDE danie musi być takie, jakie normalny człowiek ugotowałby w domu.

REALIZM KULINARNY (KRYTYCZNE — naruszenie = odrzucony plan):
- TEST ZDROWEGO ROZSĄDKU: Przed dodaniem dania zadaj sobie pytanie: "Czy ktoś naprawdę tak je?". Jeśli odpowiedź brzmi "nie" — zmień danie.
- ZAKAZ SZTUCZNYCH KOMBINACJI: Nie łącz przypadkowych składników tylko dlatego, że pasują makrami. Danie musi mieć sens kulinarny.
  Przykłady ZAKAZANE: "Lasagne z brukselką", "Sałatka z kiełbasą i granatem", "Makaron z dynią i mozzarellą i granatem", "Zupa krem z brukselki z granatem"
  Przykłady DOBRE: "Spaghetti bolognese z sałatką z pomidorów", "Pierś z kurczaka z ryżem i surówką z marchewki", "Zupa pomidorowa z makaronem"
- DANIE = ROZPOZNAWALNY PRZEPIS: Każde danie musi być rozpoznawalne jako prawdziwe danie kuchni polskiej/europejskiej/światowej. NIE twórz nowych "wynalazków" kulinarnych.
- GARNIRURY MUSZĄ PASOWAĆ: Dodatki warzywne muszą smakować z daniem głównym. Brukselka NIE pasuje do lasagne. Granat NIE jest uniwersalnym dodatkiem.
- PROSTY OBIAD: Obiad = klasyczna kompozycja (białko + kasza/ziemniaki/makaron + surówka/gotowane warzywa). NIE komplikuj.
- PRZEPIS MUSI BYĆ LOGICZNY: Jeśli w przepisie piszesz "ugotuj X, podawaj z Y" — zastanów się czy ktokolwiek tak robi w rzeczywistości.

RÓŻNORODNOŚĆ:
- Każde danie w tygodniu MUSI być unikalne — wpisz nazwy w _dayCheck.uniqueDishNames
- Min. 5 źródeł białka w tygodniu (drób, ryby, rośliny strączkowe, nabiał, jaja)
- Min. 3 porcje warzyw dziennie
- Max 2 owsianki w tygodniu
- Różne metody przygotowania (gotowanie, pieczenie, smażenie, grillowanie, duszenie)
- Preferuj warzywa i owoce sezonowe (tańsze, smaczniejsze, bardziej wartościowe odżywczo)
- LIMIT POWTÓRZEŃ SKŁADNIKÓW (KRYTYCZNE):
  Żaden pojedynczy owoc/warzywo NIE może pojawić się jako składnik więcej niż 3x w tygodniu (we WSZYSTKICH posiłkach łącznie).
  Wyjątki: pomidor, ogórek, marchew, cebula, czosnek, cytryna (podstawowe — bez limitu).
  SZCZEGÓLNIE PILNUJ: brukselka max 1x/tyg, dynia max 2x/tyg, granat max 1x/tyg, mozzarella max 2x/tyg, awokado max 2x/tyg.
  Jeśli czujesz, że wracasz do tego samego składnika — ZAMIEŃ na alternatywę:
  brukselka → brokuły, kalafior, fasolka szparagowa | dynia → cukinia, bataty, marchew | granat → borówki, maliny, jabłko | mozzarella → feta, twaróg, ricotta
- UNIKAJ MONOTONII SMAKÓW: Nie powtarzaj tego samego profilu smakowego 2 dni pod rząd (np. 2x z kolei słodka owsianka, 2x z kolei sałatka z oliwą i cytryną)
- ROTACJA II ŚNIADANIE (każdy dzień INNY typ, max 2x ten sam typ w tygodniu):
  jogurt z owocami/bakaliami | kanapka z białkiem | smoothie/koktajl | twaróg z dodatkami | sałatka owocowa | hummus z warzywami | muesli/granola z mlekiem
- ROTACJA PODWIECZOREK (OBOWIĄZKOWA — każdy dzień INNY typ, max 2x ten sam typ w tygodniu):
  Dzień 1: jogurt grecki/naturalny z orzechami/bakaliami | Dzień 2: twaróg z rzodkiewką/szczypiorkiem | Dzień 3: hummus z warzywami (marchew, papryka — BEZ pieczywa) | Dzień 4: koktajl białkowy (jogurt + orzechy + nasiona) | Dzień 5: kanapka z białkiem (ser/jajko/pasta rybna) | Dzień 6: muesli/granola z mlekiem/jogurtem | Dzień 7: orzechy z suszonymi owocami lub mix studencki
  ZAKAZ: same pasty/kanapki na pieczywie — max 2x/tydzień podwieczorek z pieczywem.
  PODWIECZOREK: unikaj owoców surowych i cukrów prostych — preferuj białko + tłuszcz (stabilny poziom cukru we krwi)

LIMITY TYGODNIOWE:
- Tuńczyk z puszki: max 2x/tydzień (rtęć)
- Produkty wędzone: patrz P1 (ZAKAZ jako główne białko w obiedzie, max 2x/tydzień)
- Jajka: BEZWZGLĘDNIE max 7 sztuk/tydzień. 1 jajko = 60g. Licząc: omlety (2 jajka=120g), jajecznice (2 jajka=120g), jajko gotowane (1szt=60g), pasta jajeczna (2 jajka=120g). Zaplanuj jajka z góry: np. Pon omlet 2jajka + Śr jajecznica 2jajka + Pt pasta 2jajka + Nd jajko gotowane 1szt = 7 szt. NIE przekraczaj.
- Mozzarella/ser żółty: max 2x/tydzień jako główny składnik (ok jako dodatek 20-30g)
- Granat: max 1x/tydzień (to dodatek, nie podstawa diety)
- Brukselka: max 1x/tydzień
- Dynia: max 2x/tydzień
- Awokado: max 2x/tydzień
${segment.allergies?.some(a => /ryb/i.test(a)) ? '' : '- Min. 2 posiłki z tłustymi rybami w tygodniu (łosoś, makrela, śledź) — preferuj świeże/mrożone zamiast wędzonych\n'}${previousDishNames?.length ? `\nDANIA Z POPRZEDNIEGO PLANU (NIE powtarzaj):\n${previousDishNames.slice(0, 50).join(', ')}` : ''}

ZASADY DIETETYCZNE:
- "Tęcza na talerzu": warzywa w min. 3 różnych kolorach dziennie (zielone, czerwone/pomarańczowe, białe/fioletowe)
- Śniadanie MUSI zawierać źródło białka (jajka/nabiał/orzechy) — nie sam węglowodan
- Białko rozłożone równomiernie na posiłki (~15-40g per posiłek główny), nie >50% dziennego białka w jednym posiłku
- Preferuj produkty pełnoziarniste (chleb razowy, makaron pełnoziarnisty, brązowy ryż, pełnoziarniste płatki)
- Tłuszcze: preferuj nienasycone (oliwa, olej rzepakowy, orzechy, awokado) nad nasycone (masło max 1x/dzień)
- Tłuszcze omega-3 > omega-6: preferuj olej rzepakowy nad słonecznikowy, dodawaj orzechy włoskie, siemię lniane
- Unikaj cukrów dodanych i słodyczy we wszystkich posiłkach
- Preferuj minimalne przetworzenie — im krótsza lista składników na etykiecie, tym lepiej
- Dąż do min. 25g błonnika dziennie — warzywa, owoce, produkty pełnoziarniste, rośliny strączkowe
- Rośliny strączkowe min. 2-3x/tydzień (soczewica, ciecierzyca, fasola, groch) — białko roślinne + błonnik + żelazo
- Orzechy/nasiona: ~30g dziennie (garść) — zdrowe tłuszcze, magnez, selen
- Nabiał/wapń: min 1 porcja dziennie (jogurt, twaróg, ser, mleko, kefir lub napój roślinny fortyfikowany), łącznie min 7 porcji/tydzień
- Odstępy między posiłkami: co 3-4h — stabilny poziom glukozy i kontrola apetytu
- Węglowodany zawsze łącz z białkiem lub tłuszczem — spłaszczenie odpowiedzi glikemicznej

KOMPLETNOŚĆ SKŁADNIKÓW:
- Każdy przepis MUSI zawierać WSZYSTKIE składniki, w tym płyny i tłuszcze
- Nie pomijaj oliwy, masła, mleka — to składniki wpływające na odżywczość
- Uwzględnij nawodnienie: do każdego posiłku z kaszą/ryżem dodaj odpowiednią ilość wody/bulionu
- W recipe.tips dodawaj wskazówki o nawodnieniu (np. "Wypij szklankę wody do posiłku" lub "Dopij herbatę ziołową")

ŁĄCZENIE PRODUKTÓW:
- Żelazo (szpinak, soczewica, mięso) + witamina C (papryka, pomidor, cytryna) → lepsze wchłanianie
- NIE łącz nabiału z produktami bogatymi w żelazo w tym samym posiłku
- Wapń (nabiał) najlepiej w osobnych posiłkach od żelaza

GRAMATURY:
- Produkty z oznaczeniem (1szt=Xg) → gramatura wielokrotnością X (np. jajko 1szt=60g → 60, 120, 180)
- Masło/oliwa/olej: wielokrotność 5g
- Sypkie (kasza, ryż, płatki, makaron): zaokrąglaj do 5g
- Reszta: zaokrąglaj do 10g
- 2-5 składników (items) per posiłek
${skipDetailedRecipes
    ? '- recipe.steps = ["Przygotuj."] — placeholder, przepisy zostaną uzupełnione osobno'
    : '- Każdy posiłek z recipe (min 2 kroki)'}

═══ P4 — PERSONALIZACJA ═══
${p4Parts.join('\n')}
${lifestyleSection}
${productListSection}

═══ _dayCheck (WYMAGANE dla każdego dnia) ═══
Wypełnij pole _dayCheck dla KAŻDEGO dnia:
- estimatedDayKcal: OBLICZ sumę kcal dnia używając tabeli kaloryczności (grams × kcal/100g ÷ 100 dla każdego składnika). MUSI być w zakresie ${Math.round(targets.kcal * 0.90)}-${Math.round(targets.kcal * 1.10)}.
  Jeśli estimatedDayKcal POZA zakresem → WRÓĆ i popraw gramatury tego dnia ZANIM przejdziesz do następnego.
- proteinSourcesCount: ile różnych źródeł białka w tym dniu (min. 2)
- vegetablePortions: ile porcji warzyw (min. 3)
- totalProteinGrams: szacunkowa suma gramatur białka
- totalGrainGrams: szacunkowa suma gramatur zbóż
- uniqueDishNames: tablica nazw WSZYSTKICH dań w tym dniu — KAŻDA nazwa musi być unikalna w CAŁYM tygodniu

═══ _weekSummary (WYMAGANE na końcu, po wszystkich dniach) ═══
Po wygenerowaniu 7 dni wypełnij pole _weekSummary:
- allDishNames: PEŁNA lista WSZYSTKICH nazw dań z 7 dni (powinna mieć ${mealCount * 7} pozycji i ZERO powtórzeń)
- uniqueDishCount: ile unikalnych nazw (MUSI być = ${mealCount * 7})
- proteinSourcesUsed: jakie źródła białka użyłeś (min. 5 różnych)
- overusedIngredients: tablica składników które pojawiły się >3x w tygodniu (POWINNA BYĆ PUSTA! wyjątki: pomidor, ogórek, marchew, cebula, czosnek, cytryna)
Jeśli uniqueDishCount < ${mealCount * 7}, WRÓĆ i zmień powtarzające się dania zanim wyślesz odpowiedź.
Jeśli overusedIngredients nie jest puste — WRÓĆ i zamień nadużywane składniki na alternatywy.

CHECKLIST TYGODNIOWY (sprawdź PRZED wysłaniem odpowiedzi):
□ Każdy estimatedDayKcal w zakresie ${Math.round(targets.kcal * 0.90)}-${Math.round(targets.kcal * 1.10)} kcal? Jeśli NIE → popraw gramatury.
□ Kolacja: max 2 sałatki, min 3 różne typy?
□ Podwieczorek: max 2x pieczywo, min 4 różne typy?
□ Nabiał/wapń: min 1 porcja dziennie?
□ Jajka: max 7 sztuk w tygodniu (licząc omlety, jajecznice, pasty jajeczne)?
□ Zero powtórzonych nazw dań?
□ REALIZM: Każde danie to rozpoznawalny przepis? Żadnych absurdalnych kombinacji?
□ POWTÓRKI SKŁADNIKÓW: brukselka ≤1x, granat ≤1x, dynia ≤2x, mozzarella ≤2x? overusedIngredients puste?
□ CZYNNIK LUDZKI: Czy ten jadłospis wygląda jak coś, co dietetyk napisałby ręcznie?

${fewShot}`;

  let userPrompt: string;
  if (complexityLevel === 'COMPLEX') {
    userPrompt = `Stwórz jadłospis na 7 dni dla pacjenta z jednostkami chorobowymi.

PROFIL: ${patientContext}

Bezwzględnie przestrzegaj wykluczeń i limitów (P1).
Używaj WYŁĄCZNIE nazw produktów z dostarczonej listy.
Wygeneruj KOMPLETNY plan na WSZYSTKIE 7 dni (${DAY_NAMES.join(', ')}).
Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;
  } else {
    userPrompt = `Stwórz jadłospis na 7 dni.

PROFIL: ${patientContext}

Używaj WYŁĄCZNIE nazw produktów z dostarczonej listy.
Wygeneruj KOMPLETNY plan na WSZYSTKIE 7 dni (${DAY_NAMES.join(', ')}).
Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;
  }

  return { systemPrompt, userPrompt };
}

// ─── prompt version helper ──────────────────────────────────────────────────

export type PromptVersion = 'v1' | 'v2' | 'v3';

export function getPromptVersion(): PromptVersion {
  const v = process.env.PROMPT_VERSION ?? 'v3';
  if (v === 'v2' || v === 'v1') return v;
  return 'v3';
}

// ─── recipe generation mode ─────────────────────────────────────────────────

export type RecipeGenerationMode = 'single' | 'two-phase' | 'per-day';

export function getRecipeGenerationMode(): RecipeGenerationMode {
  const mode = process.env.RECIPE_GENERATION_MODE ?? 'single';
  if (mode === 'two-phase' || mode === 'per-day') return mode;
  return 'single';
}

// ─── recipe detail prompt (Phase 2) ─────────────────────────────────────────

export interface RecipeDetailInput {
  day: string;
  mealName: string;
  dishName: string;
  ingredients: Array<{ name: string; grams: number }>;
}

export const RECIPE_DETAIL_JSON_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string' },
          mealName: { type: 'string' },
          dishName: { type: 'string' },
          recipe: {
            type: 'object',
            properties: {
              prepTimeMin: { type: 'number' },
              steps: { type: 'array', items: { type: 'string' } },
              tips: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
            required: ['prepTimeMin', 'steps', 'tips'],
            additionalProperties: false,
          },
        },
        required: ['day', 'mealName', 'dishName', 'recipe'],
        additionalProperties: false,
      },
    },
  },
  required: ['recipes'],
  additionalProperties: false,
};

export function buildRecipeDetailPrompt(
  meals: RecipeDetailInput[],
  dayFilter?: string,
): PromptResult {
  const filtered = dayFilter ? meals.filter((m) => m.day === dayFilter) : meals;

  const mealList = filtered
    .map((m) => {
      const ings = m.ingredients.map((i) => `${i.name} (${i.grams}g)`).join(', ');
      return `- ${m.day} | ${m.mealName} | "${m.dishName}" | Składniki: ${ings}`;
    })
    .join('\n');

  const systemPrompt = `Jesteś doświadczonym kucharzem-dietetykiem. Twoim zadaniem jest napisanie SZCZEGÓŁOWYCH przepisów kulinarnych.

WYMAGANIA DLA KAŻDEGO PRZEPISU:
- 4-8 kroków przygotowania (steps)
- Konkretne temperatury ("piekarnik 180°C, termoobieg", "średni ogień")
- Konkretne czasy ("smaż 3-4 minuty aż zmiękną", "gotuj 12 minut")
- Techniki krojenia ("pokrój w kostkę 1cm", "zetrzyj na tarce o drobnych oczkach")
- Kolejność dodawania składników
- Przyprawy i doprawianie ("dopraw solą, pieprzem i odrobiną soku z cytryny")
- prepTimeMin = realistyczny czas przygotowania w minutach
- tips = jedna praktyczna wskazówka (np. "można przygotować dzień wcześniej", "smakuje też na zimno")

STYL:
- Pisz jak profesjonalny dietetyk tworzący jadłospis dla pacjenta
- Jasne, precyzyjne instrukcje — pacjent może nie mieć doświadczenia w kuchni
- Każdy krok to jedno zdanie, zaczynające się od czasownika (Pokrój, Wymieszaj, Podgrzej, Dodaj)

Zwróć JSON z polem "recipes" — tablica przepisów. Dla każdego: day, mealName, dishName, recipe.`;

  const userPrompt = `Napisz szczegółowe przepisy dla poniższych posiłków:

${mealList}

Odpowiedz WYŁĄCZNIE poprawnym JSON-em.`;

  return { systemPrompt, userPrompt };
}

// ─── 33.3.3 buildRepairPrompt ───────────────────────────────────────────────

export function buildRepairPrompt(input: RepairPromptInput): PromptResult {
  const { violations, violatingContent, preservedMeals, preservedDayNames, existingDishNames, mealTargets, dayTotals, nutritionTargets, tolerance, attemptNumber } = input;

  const violationList = violations.map((v) =>
    `- Dzień: ${v.day}, Posiłek: ${v.mealName}, Produkt: "${v.violatingItem}" zawiera "${v.keyword}" (${v.restrictionLevel}${v.reason ? `, powód: ${v.reason}` : ''})`
  ).join('\n');

  const mealTargetText = Object.entries(mealTargets).map(
    ([name, t]) => `  ${name}: ${t.kcal} kcal, B: ${t.proteinG}g, T: ${t.fatG}g, W: ${t.carbsG}g`
  ).join('\n');

  const dayTotalText = Object.entries(dayTotals).map(
    ([day, t]) => `  ${day}: ${t.kcal} kcal, B: ${t.proteinG}g, T: ${t.fatG}g, W: ${t.carbsG}g`
  ).join('\n');

  const systemPrompt = `Jesteś dietetykiem klinicznym. Naprawiasz jadłospis, w którym wykryto naruszenia ograniczeń żywieniowych.

ZADANIE: Zamień TYLKO posiłki z naruszeniami na nowe, bezpieczne alternatywy. NIE zmieniaj posiłków bez naruszeń.

NARUSZENIA (próba ${attemptNumber}):
${violationList}

DNI ZACHOWANE (nie wysyłaj ich w odpowiedzi): ${preservedDayNames.join(', ')}
ZACHOWANE POSIŁKI w dniach z naruszeniami:
${Object.entries(preservedMeals).map(([day, meals]) => `  ${day}: ${meals.join(', ')}`).join('\n')}

ISTNIEJĄCE DANIA (NIE powtarzaj ich):
${existingDishNames.join(', ')}

CELE ŻYWIENIOWE PER POSIŁEK:
${mealTargetText}

AKTUALNE SUMY DNIOWE (przed naprawą):
${dayTotalText}

DOCELOWE SUMY DNIOWE: ${nutritionTargets.kcal} kcal (±${Math.round(tolerance * 100)}%)
Białko: ${nutritionTargets.proteinG}g | Tłuszcze: ${nutritionTargets.fatG}g | Węglowodany: ${nutritionTargets.carbsG}g

ZASADY:
- Zwróć TYLKO naprawione posiłki w formacie identycznym z oryginalnym planem
- Każdy naprawiony posiłek MUSI mieć pole "recipe" z krokami przygotowania (min. 4 kroki)
- NIE używaj produktów z naruszeń (wykluczone słowa kluczowe)
- Suma kalorii naprawionych posiłków musi wyrównać dzienne cele
- Zachowaj format: {"days": [{"day": "...", "meals": [...]}]}
- meal.name MUSI być polską nazwą posiłku: Śniadanie, II Śniadanie, Obiad, Podwieczorek, Kolacja
- item.name MUSI być prawdziwą nazwą dania po polsku (np. "Sałatka z kurczakiem", "Kasza z warzywami")
- NIGDY nie używaj nazw typu "Posiłek (breakfast)" ani angielskich nazw — zawsze polska nazwa dania`;

  const userPrompt = `Napraw poniższe posiłki zastępując produkty naruszające ograniczenia:

${JSON.stringify(violatingContent, null, 2)}

Odpowiedz WYŁĄCZNIE poprawnym JSON-em z naprawionymi dniami/posiłkami.`;

  return { systemPrompt, userPrompt };
}

// ─── 33.3.4 buildPartialRegenPrompt ─────────────────────────────────────────

export function buildPartialRegenPrompt(input: PartialRegenPromptInput): PromptResult {
  const { targets, currentContent, nutritionTargets, excludeKeywords, clinicalNotes } = input;

  // Build description of what to regenerate
  let targetDescription = '';
  if (targets.days?.length) {
    targetDescription += `PEŁNE DNI do regeneracji: ${targets.days.join(', ')}`;
  }
  if (targets.meals?.length) {
    const mealDesc = targets.meals.map((m) => `${m.day} → ${m.meal}`).join(', ');
    targetDescription += `${targetDescription ? '\n' : ''}KONKRETNE POSIŁKI do regeneracji: ${mealDesc}`;
  }

  // Collect existing dish names from non-regenerated parts
  const regenDays = new Set(targets.days ?? []);
  const regenMeals = new Map<string, Set<string>>();
  for (const m of targets.meals ?? []) {
    if (!regenMeals.has(m.day)) regenMeals.set(m.day, new Set());
    regenMeals.get(m.day)!.add(m.meal);
  }

  const existingDishes: string[] = [];
  for (const day of currentContent.days) {
    if (regenDays.has(day.day)) continue;
    const mealSet = regenMeals.get(day.day);
    for (const meal of day.meals) {
      if (mealSet?.has(meal.name)) continue;
      for (const item of meal.items) {
        existingDishes.push(item.name);
      }
    }
  }

  let restrictionsText = '';
  if (excludeKeywords.length > 0) {
    restrictionsText = `\nWYKLUCZONE PRODUKTY: ${excludeKeywords.join(', ')}`;
  }

  let clinicalText = '';
  if (clinicalNotes.length > 0) {
    clinicalText = `\nUWAGI KLINICZNE:\n${clinicalNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;
  }

  const systemPrompt = `Jesteś dietetykiem klinicznym. Regenerujesz wybrane części jadłospisu zachowując spójność z resztą planu.

${targetDescription}

CELE ŻYWIENIOWE (dzienne):
Kalorie: ${nutritionTargets.kcal} kcal (±5%)
Białko: ${nutritionTargets.proteinG}g | Tłuszcze: ${nutritionTargets.fatG}g | Węglowodany: ${nutritionTargets.carbsG}g

ISTNIEJĄCE DANIA (NIE powtarzaj): ${existingDishes.slice(0, 50).join(', ')}
${restrictionsText}${clinicalText}

ZASADY:
- Zwróć TYLKO regenerowane dni/posiłki w formacie: {"days": [{"day": "...", "meals": [...]}]}
- Każdy posiłek MUSI mieć pole "recipe" z krokami przygotowania
- Każdy item MUSI mieć pole "ingredients" z dokładnymi nazwami produktów
- Zachowaj kalorie i makroskładniki zbliżone do celów
- Zaproponuj nowe, zróżnicowane dania — nie kopiuj istniejących
- Każdy przepis MUSI zawierać WSZYSTKIE składniki (w tym płyny: mleko, woda, jogurt, oliwa, sos)
- Nie pomijaj tłuszczów, sosów i płynów — wpływają na kalorie i makro`;

  const userPrompt = `Zregeneruj wskazane posiłki/dni. Kontekst aktualnego planu:

${JSON.stringify(currentContent, null, 2)}

Odpowiedz WYŁĄCZNIE poprawnym JSON-em z regenerowanymi dniami/posiłkami.`;

  return { systemPrompt, userPrompt };
}
