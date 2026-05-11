import type { PolicyRule, PatientContext, NutrientLimitEffect } from './types';

// ─── Helper: check if patient has a condition ─────────────────────────────────

function hasCondition(ctx: PatientContext, ...terms: string[]): boolean {
  const all = [...ctx.chronicDiseases, ...ctx.digestiveIssues].map(s => s.toLowerCase());
  return terms.some(t => all.some(c => c.includes(t)));
}

function hasAllergy(ctx: PatientContext, ...terms: string[]): boolean {
  return terms.some(t => ctx.allergies.some(a => a.toLowerCase().includes(t)));
}

function hasDiet(ctx: PatientContext, ...terms: string[]): boolean {
  const dt = ctx.dietType.toLowerCase();
  return terms.some(t => dt.includes(t));
}

function hasSurgery(ctx: PatientContext, ...terms: string[]): boolean {
  if (!ctx.surgeryHistory) return false;
  return terms.some(t => ctx.surgeryHistory!.some(s => s.toLowerCase().includes(t)));
}

// ─── Allergen / Elimination Rules ─────────────────────────────────────────────

const ALLERGEN_RULES: PolicyRule[] = [
  // EU 1: Gluten
  {
    id: 'allergy-gluten',
    name: 'Eliminacja glutenu',
    description: 'EU 1: Zboża zawierające gluten (pszenica, żyto, jęczmień, owies, orkisz, kamut)',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'gluten'),
    effects: [
      { type: 'EXCLUDE_PRODUCTS', flagKey: 'glutenFree', flagValue: false },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['pszenica', 'żyto', 'jęczmień', 'owies', 'orkisz', 'kamut', 'kasza manna', 'kuskus', 'bulgur', 'makaron', 'chleb', 'bułka', 'mąka pszenna', 'wheat', 'rye', 'barley', 'oats', 'spelt', 'semolina', 'couscous', 'bulgur', 'pasta', 'bread', 'flour'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia/nietolerancja glutenu (EU alergen nr 1): eliminacja pszenicy, żyta, jęczmienia, owsa, orkiszu, kamut. Dozwolone: ryż, kukurydza, gryka, amarant, quinoa, proso, tapioka. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 2: Shellfish (crustaceans)
  {
    id: 'allergy-shellfish',
    name: 'Eliminacja skorupiaków',
    description: 'EU 2: Skorupiaki i produkty pochodne (krewetki, kraby, homary, langusty)',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'shellfish', 'skorupiaki', 'krewetki', 'crustaceans'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['krewetka', 'krewetki', 'krab', 'homar', 'langusta', 'rak', 'shrimp', 'crab', 'lobster', 'crayfish', 'prawn', 'crustacean'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na skorupiaki (EU alergen nr 2): eliminacja krewetek, krabów, homarów, langust, raków. UWAGA: możliwa reaktywność krzyżowa z mięczakami. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 3: Eggs
  {
    id: 'allergy-eggs',
    name: 'Eliminacja jaj',
    description: 'EU 3: Jaja i produkty pochodne',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'eggs', 'jajka', 'jaja', 'egg'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['jajko', 'jajka', 'jaje', 'białko jaja', 'żółtko', 'egg', 'eggs', 'omlet', 'omelette', 'frittata', 'majonezy', 'mayonnaise'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na jaja (EU alergen nr 3): eliminacja jaj i produktów jajecznych (majonez, biszkopt, lody, pankierowane). Sprawdzać etykiety — jaja w wielu produktach przetworzonych. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 4: Fish
  {
    id: 'allergy-fish',
    name: 'Eliminacja ryb',
    description: 'EU 4: Ryby i produkty pochodne',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'fish', 'ryby', 'ryba'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['ryba', 'łosoś', 'tuńczyk', 'dorsz', 'makrela', 'śledź', 'halibut', 'pstrąg', 'sandacz', 'tilapia', 'sardynka', 'szprot', 'anchois', 'fish', 'salmon', 'tuna', 'cod', 'mackerel', 'herring', 'trout', 'anchovy', 'sardine'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na ryby (EU alergen nr 4): eliminacja wszystkich ryb i produktów rybnych. Rozważyć suplementację omega-3 z alg (EPA/DHA). Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 z alg (EPA+DHA)', dose: '250-500 mg/d', reason: 'Alternatywne źródło omega-3 przy eliminacji ryb' },
    ],
  },
  // EU 5: Peanuts (NOWA)
  {
    id: 'allergy-peanuts',
    name: 'Eliminacja orzeszków ziemnych',
    description: 'EU 5: Orzeszki ziemne (arachidowe) i produkty pochodne',
    priority: 100,
    version: '1.0',
    condition: (ctx) => hasAllergy(ctx, 'peanut', 'orzeszki ziemne', 'arachidowe', 'orzech ziemny'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['orzeszek ziemny', 'orzeszki ziemne', 'arachidowy', 'masło orzechowe', 'peanut', 'peanuts', 'peanut butter', 'groundnut'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na orzeszki ziemne (EU alergen nr 5): eliminacja orzeszków ziemnych i produktów pochodnych (masło orzechowe, olej arachidowy). UWAGA: jeden z najczęstszych alergenów wywołujących anafilaksję. Sprawdzać etykiety. Źródło: Rozporządzenie (UE) 1169/2011, EAACI 2014', category: 'RESTRICTION' },
    ],
  },
  // EU 6: Soy
  {
    id: 'allergy-soy',
    name: 'Eliminacja soi',
    description: 'EU 6: Soja i produkty pochodne',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'soy', 'soja', 'soybean'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['soja', 'tofu', 'tempeh', 'edamame', 'miso', 'natto', 'lecytyna sojowa', 'olej sojowy', 'sos sojowy', 'soy', 'soybean', 'soy sauce', 'soy lecithin', 'soy milk'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na soję (EU alergen nr 6): eliminacja soi i produktów sojowych (tofu, tempeh, sos sojowy, miso, lecytyna sojowa). Soja obecna w wielu produktach przetworzonych. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 7: Milk / Lactose
  {
    id: 'allergy-milk',
    name: 'Eliminacja mleka',
    description: 'EU 7: Mleko i produkty pochodne (w tym laktoza)',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'milk', 'mleko', 'lactose', 'laktoza', 'dairy', 'nabiał'),
    effects: [
      { type: 'EXCLUDE_PRODUCTS', flagKey: 'lactoseFree', flagValue: false },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['mleko', 'jogurt', 'kefir', 'śmietana', 'twaróg', 'ser', 'masło', 'serwatka', 'kazeina', 'milk', 'yogurt', 'cream', 'cottage cheese', 'cheese', 'butter', 'whey', 'casein'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na białka mleka / nietolerancja laktozy (EU alergen nr 7): eliminacja mleka i produktów mlecznych. Przy alergii na białka mleka — pełna eliminacja (w tym masło, serwatka, kazeina). Przy nietolerancji laktozy — ser dojrzewający i masło zwykle tolerowane. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Wapń', dose: '800-1000 mg/d', reason: 'Uzupełnienie wapnia przy eliminacji nabiału — rozważyć napoje roślinne wzbogacone w Ca' },
    ],
  },
  // EU 8: Tree nuts
  {
    id: 'allergy-nuts',
    name: 'Eliminacja orzechów',
    description: 'EU 8: Orzechy (migdały, laskowe, włoskie, nerkowce, pekan, brazylijskie, pistacje, makadamia)',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'nuts', 'orzechy', 'tree nuts'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['orzech', 'migdał', 'orzech laskowy', 'orzech włoski', 'nerkowiec', 'kasztan', 'pistacja', 'pekan', 'makadamia', 'orzech brazylijski', 'marcepan', 'nut', 'almond', 'walnut', 'cashew', 'pistachio', 'pecan', 'hazelnut', 'macadamia', 'brazil nut', 'marzipan'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na orzechy (EU alergen nr 8): eliminacja migdałów, orzechów laskowych, włoskich, nerkowców, pekan, brazylijskich, pistacji, makadamia. Sprawdzać: marcepan, nougat, pralinki, oleje orzechowe. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 9: Celery
  {
    id: 'allergy-celery',
    name: 'Eliminacja selera',
    description: 'EU 9: Seler i produkty pochodne',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'celery', 'seler'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['seler', 'seler naciowy', 'seler korzeniowy', 'celery', 'celeriac'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na seler (EU alergen nr 9): eliminacja selera naciowego i korzeniowego. UWAGA: seler częsty w przyprawach, bulionach, zupach instant. Możliwa reaktywność krzyżowa z pyłkiem brzozy (zespół brzoza-seler). Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 10: Mustard
  {
    id: 'allergy-mustard',
    name: 'Eliminacja gorczycy',
    description: 'EU 10: Gorczyca i produkty pochodne',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'mustard', 'gorczyca'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['gorczyca', 'musztarda', 'mustard', 'nasiona gorczycy', 'olej gorczycowy', 'mustard seed', 'mustard oil'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na gorczycę (EU alergen nr 10): eliminacja gorczycy i musztardy. Gorczyca może być ukryta w sosach, dressingach, marynatach, curry. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 11: Sesame
  {
    id: 'allergy-sesame',
    name: 'Eliminacja sezamu',
    description: 'EU 11: Nasiona sezamu i produkty pochodne',
    priority: 100,
    version: '2.0',
    condition: (ctx) => hasAllergy(ctx, 'sesame', 'sezam'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['sezam', 'tahini', 'tahina', 'halwa', 'sesame', 'sesame oil', 'tahini', 'halvah'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na sezam (EU alergen nr 11): eliminacja nasion sezamu, tahini, halwy, oleju sezamowego. Sezam częsty w pieczywie, bułkach, hummusie, kuchni azjatyckiej. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 12: Sulfites (NOWA)
  {
    id: 'allergy-sulfites',
    name: 'Eliminacja dwutlenku siarki i siarczyny',
    description: 'EU 12: Dwutlenek siarki i siarczyny w stężeniu >10 mg/kg (SO₂)',
    priority: 100,
    version: '1.0',
    condition: (ctx) => hasAllergy(ctx, 'sulfite', 'siarczyny', 'dwutlenek siarki', 'sulfur dioxide', 'so2'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['wino', 'suszone owoce', 'suszone morele', 'wine', 'dried fruit', 'dried apricots', 'sulfite', 'siarczyny'] },
      { type: 'CLINICAL_NOTE', note: 'Wrażliwość na siarczyny (EU alergen nr 12): unikać produktów z dodatkiem SO₂/siarczyny (E220-E228). Częste w: winie, suszone owoce, konserwy, soki, ocet winny. Szczególnie ważne u astmatyków. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 13: Lupin (NOWA)
  {
    id: 'allergy-lupin',
    name: 'Eliminacja łubinu',
    description: 'EU 13: Łubin i produkty pochodne',
    priority: 100,
    version: '1.0',
    condition: (ctx) => hasAllergy(ctx, 'lupin', 'łubin', 'lupine'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['łubin', 'mąka łubinowa', 'lupin', 'lupine', 'lupin flour'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na łubin (EU alergen nr 13): eliminacja łubinu i mąki łubinowej. Łubin stosowany w pieczywie bezglutenowym, makaronach, wegetariańskich zamiennikach. UWAGA: reaktywność krzyżowa z orzeszkami ziemnymi! Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // EU 14: Mollusks (NOWA)
  {
    id: 'allergy-mollusks',
    name: 'Eliminacja mięczaków',
    description: 'EU 14: Mięczaki i produkty pochodne (ośmiornice, kalmary, małże, ślimaki)',
    priority: 100,
    version: '1.0',
    condition: (ctx) => hasAllergy(ctx, 'mollusks', 'mięczaki', 'małże', 'ośmiornica', 'kałamarnica', 'mollusc'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['małż', 'małże', 'ostryga', 'ośmiornica', 'kałamarnica', 'ślimak', 'przegrzebek', 'omułek', 'mussel', 'oyster', 'octopus', 'squid', 'snail', 'scallop', 'clam', 'mollusc'] },
      { type: 'CLINICAL_NOTE', note: 'Alergia na mięczaki (EU alergen nr 14): eliminacja małży, ostryg, ośmiornic, kalmarów, ślimaków, przegrzebków. UWAGA: możliwa reaktywność krzyżowa ze skorupiakami. Źródło: Rozporządzenie (UE) 1169/2011', category: 'RESTRICTION' },
    ],
  },
  // Dodatkowe nietolerancje
  {
    id: 'allergy-fructose',
    name: 'Nietolerancja fruktozy',
    description: 'Nietolerancja fruktozy — ograniczenie fruktozy i polioli',
    priority: 90,
    version: '1.0',
    condition: (ctx) => hasAllergy(ctx, 'fructose', 'fruktoza'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 5 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['miód', 'agawa', 'syrop', 'syrop glukozowo-fruktozowy', 'sok jabłkowy', 'honey', 'agave', 'syrup', 'high fructose corn syrup', 'apple juice'] },
      { type: 'CLINICAL_NOTE', note: 'Nietolerancja fruktozy: ograniczenie fruktozy (<25g/posiłek), unikanie HFCS, miodu, agawy, soku jabłkowego. Owoce o niskiej zawartości fruktozy (banany, jagody, cytrusy) zwykle tolerowane. Źródło: DGVS 2014', category: 'RESTRICTION' },
    ],
  },
];

// ─── Insulin Resistance / Diabetes ────────────────────────────────────────────

const METABOLIC_RULES: PolicyRule[] = [
  // 27.2.1 Otyłość (BMI 30+)
  {
    id: 'obesity',
    name: 'Otyłość',
    description: 'BMI >= 30 — deficyt kaloryczny, wysokie białko, błonnik',
    priority: 78,
    version: '1.0',
    condition: (ctx) => {
      const bmi = ctx.weightKg / ((ctx.heightCm / 100) ** 2);
      return bmi >= 30;
    },
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetKcal', operation: 'ADD', value: -500 },
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MULTIPLY', value: 1.3 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 35 },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['fast food', 'słodycze', 'cukierek', 'czekolada', 'chipsy', 'napój gazowany', 'soda', 'cola', 'candy', 'chips', 'chocolate'] },
      { type: 'CLINICAL_NOTE', note: 'Otyłość (BMI ≥30): deficyt 500 kcal/d, białko 1.2-1.5g/kg, błonnik 25-30g/d, preferencja produktów niskoglikemicznych i sycących', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000 IU/d', reason: 'Częsty niedobór u osób z otyłością' },
    ],
  },
  // 27.2.2 Zespół metaboliczny
  {
    id: 'metabolic-syndrome',
    name: 'Zespół metaboliczny',
    description: 'Kombinacja zaburzeń metabolicznych — dieta śródziemnomorska, ograniczenie cukrów i sodu',
    priority: 79,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'metabolic_syndrome', 'zespół metaboliczny', 'zespol metaboliczny', 'syndrom metaboliczny'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetKcal', operation: 'ADD', value: -400 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 6 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2300 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 20 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25 },
      { type: 'MEAL_DISTRIBUTION', nutrient: 'carbs', maxPerMealPct: 30 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'heartFriendly', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cukier', 'dżem', 'syrop', 'słodycze', 'napój gazowany', 'soda', 'sugar', 'candy', 'soda'] },
      { type: 'CLINICAL_NOTE', note: 'Zespół metaboliczny: dieta śródziemnomorska, ograniczenie cukrów prostych i sodu, zwiększony błonnik, redukcja masy ciała', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez', dose: '300-400 mg/d', reason: 'Wsparcie insulinowrażliwości i kontroli ciśnienia' },
    ],
  },
  // 27.2.3 Insulinooporność (ULEPSZENIE — naprawa placeholder, IG, chrom, Mg)
  {
    id: 'insulin-resistance',
    name: 'Insulinooporność',
    description: 'Pacjent zgłosił insulinooporność — węglowodany 40-45%, niski IG, suplementacja chrom/Mg',
    priority: 80,
    version: '2.0',
    condition: (ctx) => hasCondition(ctx, 'insulin_resistance', 'insulinooporność', 'insulinoopornosc'),
    effects: [
      // Carbs 40-45% of energy: for 2000kcal = 200-225g → cap at 45%
      { type: 'MODIFY_TARGETS', field: 'targetCarbsG', operation: 'MULTIPLY', value: 0.9 },
      { type: 'MEAL_DISTRIBUTION', nutrient: 'carbs', maxPerMealPct: 28 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 6 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'diabeticFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cukier', 'dżem', 'konfitura', 'syrop', 'biały chleb', 'biały ryż', 'sugar', 'jam', 'syrup', 'candy', 'cukierek', 'white bread', 'white rice'] },
      { type: 'CLINICAL_NOTE', note: 'Insulinooporność: węglowodany 40-45% energii, produkty o niskim IG, równomierny rozkład węgli w posiłkach, ograniczenie cukrów prostych', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Chrom', dose: '200-400 µg/d', reason: 'Wsparcie wrażliwości na insulinę (PTD 2024)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez', dose: '300-400 mg/d', reason: 'Poprawa insulinowrażliwości, częsty niedobór' },
    ],
  },
  // 27.2.4 Cukrzyca typu 2 (doprecyzowanie + stage)
  {
    id: 'diabetes-type2',
    name: 'Cukrzyca typu 2',
    description: 'Pacjent zgłosił cukrzycę typu 2 — węglowodany 45%, niski IG, regularne posiłki',
    priority: 85,
    version: '2.0',
    conflictsWith: ['Cukrzyca typu 1'],
    condition: (ctx) => hasCondition(ctx, 'diabetes_type2', 'cukrzyca typu 2', 'cukrzyca type 2', 'diabetes type 2', 'diabetes', 'cukrzyca'),
    effects: [
      { type: 'MEAL_DISTRIBUTION', nutrient: 'carbs', maxPerMealPct: 25 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 5 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25 },
      { type: 'PREFER_PRODUCTS', flagKey: 'diabeticFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cukier', 'dżem', 'syrop', 'słodycze', 'biały chleb', 'biały ryż', 'sugar', 'candy', 'soda', 'cola', 'white bread'] },
      { type: 'CLINICAL_NOTE', note: 'Cukrzyca typu 2: węglowodany 45% energii, niski IG, regularne posiłki (4-5/d), eliminacja cukrów prostych. Źródło: PTD 2024, ADA Standards of Care 2024', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Chrom', dose: '200 µg/d', reason: 'Wsparcie kontroli glikemii' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez', dose: '300 mg/d', reason: 'Częsty niedobór u diabetyków' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000 IU/d', reason: 'Wsparcie wrażliwości na insulinę' },
    ],
  },
  // 27.2.5 Cukrzyca typu 1 (NOWA)
  {
    id: 'diabetes-type1',
    name: 'Cukrzyca typu 1',
    description: 'Pacjent zgłosił cukrzycę typu 1 — wymienniki WW, niski-średni IG, RED FLAG HIGH',
    priority: 86,
    version: '1.0',
    conflictsWith: ['Cukrzyca typu 2'],
    condition: (ctx) => hasCondition(ctx, 'diabetes_type1', 'cukrzyca typu 1', 'cukrzyca type 1', 'diabetes type 1'),
    effects: [
      { type: 'MEAL_DISTRIBUTION', nutrient: 'carbs', maxPerMealPct: 25 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 5 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25 },
      { type: 'PREFER_PRODUCTS', flagKey: 'diabeticFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cukier', 'dżem', 'syrop', 'słodycze', 'sugar', 'candy', 'soda', 'cola'] },
      { type: 'CLINICAL_NOTE', note: 'Cukrzyca typu 1: wymienniki węglowodanowe (WW), niski-średni IG, regularne posiłki + przekąski, koordynacja z diabetologiem. Źródło: PTD 2024, ISPAD 2022', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA: Plan wymaga koordynacji dawek insuliny z diabetologiem. Każdy posiłek powinien mieć podaną liczbę WW.', category: 'WARNING' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000 IU/d', reason: 'Wsparcie autoimmunologiczne i metaboliczne' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez', dose: '300 mg/d', reason: 'Częsty niedobór, wspiera kontrolę glikemii' },
    ],
  },
  // 27.2.6 Stan przedcukrzycowy
  {
    id: 'prediabetes',
    name: 'Stan przedcukrzycowy',
    description: 'Pacjent ze stanem przedcukrzycowym — łagodniejsze ograniczenia niż T2, redukcja masy 5-7%',
    priority: 77,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'prediabetes', 'przedcukrzycowy', 'stan przedcukrzycowy', 'prediabetes', 'insulin resistance borderline', 'nieprawidłowa glikemia'),
    effects: [
      { type: 'MEAL_DISTRIBUTION', nutrient: 'carbs', maxPerMealPct: 30 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 8 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cukier', 'dżem', 'syrop', 'słodycze', 'napój gazowany', 'sugar', 'candy', 'soda'] },
      { type: 'CLINICAL_NOTE', note: 'Stan przedcukrzycowy: węglowodany 45-50% energii, niski IG, redukcja masy ciała o 5-7% jeśli nadwaga. Źródło: PTD 2024, ADA Prevention Guidelines', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Chrom', dose: '200 µg/d', reason: 'Wsparcie normalizacji glikemii' },
    ],
  },
  // 27.2.7 Hipoglikemia reaktywna
  {
    id: 'reactive-hypoglycemia',
    name: 'Hipoglikemia reaktywna',
    description: 'Pacjent zgłosił hipoglikemię reaktywną — małe częste posiłki, unikanie cukrów prostych',
    priority: 76,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'reactive_hypoglycemia', 'hipoglikemia reaktywna', 'hipoglikemia', 'reactive hypoglycemia'),
    effects: [
      { type: 'MEAL_DISTRIBUTION', nutrient: 'carbs', maxPerMealPct: 20 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 5 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cukier', 'dżem', 'syrop', 'miód', 'słodycze', 'sok owocowy', 'napój gazowany', 'sugar', 'candy', 'soda', 'juice', 'honey'] },
      { type: 'CLINICAL_NOTE', note: 'Hipoglikemia reaktywna: małe częste posiłki (5-6/d), białko + tłuszcz przy każdym posiłku, unikanie cukrów prostych, ograniczenie alkoholu. Źródło: Endocrine Society Guidelines', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane 5-6 posiłków dziennie z równomiernym rozkładem węglowodanów — każdy posiłek musi zawierać białko i tłuszcz dla spowolnienia wchłaniania glukozy', category: 'RECOMMENDATION' },
    ],
  },
  // 27.2.8 Dna moczanowa (ULEPSZENIE — stage: atak vs remisja, nawodnienie)
  // Note: moved from ORGAN_RULES to METABOLIC_RULES for consistency
  {
    id: 'gout',
    name: 'Dna moczanowa',
    description: 'Pacjent zgłosił dnę moczanową — ograniczenie puryn, nawodnienie 2-3L/d, ograniczenie fruktozy',
    priority: 70,
    version: '2.0',
    condition: (ctx) => hasCondition(ctx, 'gout', 'dna moczanowa', 'dna'),
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'goutFriendly', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['podroby', 'wątróbka', 'nerki', 'sardynka', 'szprot', 'anchois', 'piwo', 'alkohol', 'offal', 'liver', 'kidney', 'sardine', 'anchovy', 'sprat', 'beer', 'alcohol'] },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 8 },
      { type: 'CLINICAL_NOTE', note: 'Dna moczanowa: ograniczono produkty bogate w puryny (podroby, małe ryby morskie), ograniczenie fruktozy, nawodnienie 2-3L/d, eliminacja alkoholu (zwłaszcza piwa). Źródło: EULAR 2016, ACR 2020', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'W fazie ataku dny: dieta płynna/lekkostrawna, zwiększone nawodnienie, unikanie mięsa i ryb. W remisji: normalna dieta z ograniczeniem puryn.', category: 'INFO' },
    ],
  },
  // 27.2.9 Hiperurykemia (bez objawów dny)
  {
    id: 'hyperuricemia',
    name: 'Hiperurykemia',
    description: 'Podwyższony kwas moczowy bez objawów dny — łagodne ograniczenie puryn, nawodnienie',
    priority: 65,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'hyperuricemia', 'hiperurykemia', 'kwas moczowy', 'podwyższony kwas moczowy'),
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'goutFriendly', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['podroby', 'wątróbka', 'nerki', 'piwo', 'offal', 'liver', 'kidney', 'beer'] },
      { type: 'CLINICAL_NOTE', note: 'Hiperurykemia: ograniczenie puryn, alkoholu i fruktozy, preferencja nabiału niskotłuszczowego (obniża kwas moczowy), nawodnienie. Źródło: ACR 2020', category: 'RESTRICTION' },
    ],
  },
];

// ─── Cardiovascular Rules ─────────────────────────────────────────────────────

const CARDIO_RULES: PolicyRule[] = [
  // 27.3.1 Nadciśnienie tętnicze (ULEPSZENIE — DASH, potas, suplementacja)
  {
    id: 'hypertension',
    name: 'Nadciśnienie tętnicze',
    description: 'Nadciśnienie — dieta DASH, sód <2000mg, potas 4700mg/d, suplementacja Mg i CoQ10',
    priority: 75,
    version: '2.0',
    condition: (ctx) => hasCondition(ctx, 'hypertension', 'nadciśnienie', 'nadcisnienie', 'nadciśnienie tętnicze'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2000 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'potassium', scope: 'DAILY_TOTAL', min: 4700 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 35 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 20 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSodium', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'heartFriendly', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['solony', 'marynowany', 'konserwowy', 'salted', 'pickled', 'canned', 'zupa instant', 'kostka rosołowa', 'sos sojowy', 'soy sauce'] },
      { type: 'CLINICAL_NOTE', note: 'Nadciśnienie tętnicze: dieta DASH — sód <2000mg/d, potas 4700mg/d (banany, awokado, ziemniaki, szpinak), błonnik 25-35g/d, ograniczenie alkoholu. Źródło: ESC/ESH 2023, DASH trial', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: owoce i warzywa 8-10 porcji/d, nabiał niskotłuszczowy 2-3 porcje/d, ryby 2-3x/tyg, orzechy/nasiona', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez', dose: '300-400 mg/d', reason: 'Wsparcie kontroli ciśnienia tętniczego (ESC/ESH 2023)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Koenzym Q10', dose: '100-200 mg/d', reason: 'Wsparcie funkcji śródbłonka naczyniowego' },
    ],
  },
  // 27.3.2 Miażdżyca (NOWA)
  {
    id: 'atherosclerosis',
    name: 'Miażdżyca',
    description: 'Miażdżyca — dieta śródziemnomorska, omega-3, antyoksydanty, eliminacja tłuszczów trans',
    priority: 78,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'atherosclerosis', 'miażdżyca', 'miazdzyca', 'arterosclerosis'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 16 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 40 },
      { type: 'PREFER_PRODUCTS', flagKey: 'heartFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['tłuszcz trans', 'trans fat', 'margaryna twarda', 'hard margarine', 'fast food', 'boczek', 'smalec', 'bacon', 'lard', 'palmowy', 'palm oil', 'chipsy', 'chips'] },
      { type: 'CLINICAL_NOTE', note: 'Miażdżyca: dieta śródziemnomorska, tłuszcze nasycone <7% energii, tłuszcze trans 0%, preferencja oliwy, orzechów, ryb, warzyw. Omega-3 (EPA+DHA) 1g/d. Źródło: ESC 2021 Prevention Guidelines', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: ryby tłuste 2-3x/tyg, orzechy 30g/d, oliwa z oliwek extra virgin, warzywa bogate w antyoksydanty (jagody, szpinak, brokuły)', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '1 g/d', reason: 'Działanie przeciwmiażdżycowe i przeciwzapalne (ESC 2021)' },
    ],
  },
  // 27.3.3 Choroba niedokrwienna serca — CHD (ULEPSZENIE — omega-3, błonnik rozpuszczalny, CoQ10)
  {
    id: 'chd',
    name: 'Choroba niedokrwienna serca',
    description: 'CHD — ścisłe ograniczenie tłuszczów nasyconych, omega-3, błonnik rozpuszczalny 10-25g/d',
    priority: 80,
    version: '2.0',
    condition: (ctx) => hasCondition(ctx, 'chd', 'choroba wieńcowa', 'wieńcowa', 'choroba niedokrwienna serca', 'niedokrwienna serca', 'coronary heart disease'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 15 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2000 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'cholesterol', scope: 'DAILY_TOTAL', max: 200 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 40 },
      { type: 'PREFER_PRODUCTS', flagKey: 'heartFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['boczek', 'smalec', 'bacon', 'lard', 'palmowy', 'palm oil', 'tłuszcz trans', 'trans fat', 'fast food'] },
      { type: 'CLINICAL_NOTE', note: 'Choroba niedokrwienna serca: tłuszcze nasycone <15g/d, cholesterol <200mg/d, błonnik rozpuszczalny 10-25g/d (owies, jęczmień, psyllium), omega-3 z ryb 2-3x/tyg. Źródło: ESC 2019 CCS Guidelines', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Koenzym Q10', dose: '100-200 mg/d', reason: 'Wsparcie funkcji mięśnia sercowego (ESC 2019)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '1 g/d', reason: 'Redukcja ryzyka zdarzeń sercowo-naczyniowych' },
    ],
  },
  // 27.3.4 Dyslipidemia ogólna (NOWA)
  {
    id: 'dyslipidemia',
    name: 'Dyslipidemia',
    description: 'Dyslipidemia — tłuszcze nasycone <10% energii, trans 0%, błonnik 25-40g/d, sterole roślinne',
    priority: 73,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'dyslipidemia', 'dyslipidemia', 'zaburzenia lipidowe', 'zaburzenia gospodarki lipidowej'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 22 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 40 },
      { type: 'PREFER_PRODUCTS', flagKey: 'heartFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['tłuszcz trans', 'trans fat', 'margaryna twarda', 'fast food', 'smalec', 'lard', 'palmowy', 'palm oil'] },
      { type: 'CLINICAL_NOTE', note: 'Dyslipidemia: tłuszcze nasycone <10% energii, tłuszcze trans 0%, błonnik 25-40g/d, sterole/stanole roślinne 2g/d (margaryny wzbogacane). Źródło: ESC/EAS 2019 Dyslipidemia Guidelines', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: oliwa z oliwek, orzechy, ryby tłuste, rośliny strączkowe, produkty pełnoziarniste. Rozważyć margaryny z fitosterolami.', category: 'RECOMMENDATION' },
    ],
  },
  // 27.3.5 Hipercholesterolemia (ULEPSZENIE — Portfolio diet, sterole roślinne, błonnik rozpuszczalny)
  {
    id: 'hypercholesterolemia',
    name: 'Hipercholesterolemia',
    description: 'Hipercholesterolemia — Portfolio diet approach, sterole roślinne, błonnik rozpuszczalny, ograniczenie tłuszczów nasyconych',
    priority: 75,
    version: '2.0',
    condition: (ctx) => hasCondition(ctx, 'hypercholesterol', 'cholesterol', 'hipercholesterol', 'hipercholesterolemia', 'podwyższony cholesterol', 'wysoki cholesterol'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 18 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'cholesterol', scope: 'DAILY_TOTAL', max: 200 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 40 },
      { type: 'PREFER_PRODUCTS', flagKey: 'heartFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['boczek', 'smalec', 'bacon', 'lard', 'palmowy', 'palm oil', 'tłuszcz trans', 'trans fat', 'fast food'] },
      { type: 'CLINICAL_NOTE', note: 'Hipercholesterolemia: Portfolio diet — sterole roślinne 2g/d, białko sojowe 25g/d, orzechy 30g/d, błonnik rozpuszczalny 10-25g/d (owies, psyllium, jęczmień). Tłuszcze nasycone <10% energii, cholesterol <200mg/d. Źródło: ESC/EAS 2019', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: owies/otręby owsiane codziennie, orzechy włoskie/migdały 30g/d, rośliny strączkowe 3-4x/tyg, margaryny z fitosterolami', category: 'RECOMMENDATION' },
    ],
  },
  // 27.3.6 Hipertriglicerydemia (NOWA)
  {
    id: 'hypertriglyceridemia',
    name: 'Hipertriglicerydemia',
    description: 'Hipertriglicerydemia — ograniczenie cukrów prostych, eliminacja alkoholu, omega-3 2-4g/d',
    priority: 74,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'hypertriglyceridemia', 'hipertriglicerydemia', 'triglicerydy', 'wysokie triglicerydy', 'podwyższone triglicerydy', 'trójglicerydy'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 5 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 20 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'heartFriendly', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cukier', 'dżem', 'syrop', 'miód', 'słodycze', 'sok owocowy', 'napój gazowany', 'alkohol', 'piwo', 'wino', 'wódka', 'sugar', 'candy', 'soda', 'juice', 'honey', 'alcohol', 'beer', 'wine'] },
      { type: 'CLINICAL_NOTE', note: 'Hipertriglicerydemia: cukry proste <10% energii, eliminacja alkoholu, omega-3 (EPA+DHA) 2-4g/d, ograniczenie fruktozy (sok owocowy max 150ml/d). Redukcja masy ciała jeśli nadwaga. Źródło: ESC/EAS 2019, Endocrine Society 2020', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: ryby tłuste 3-4x/tyg (łosoś, makrela, sardynki), produkty pełnoziarniste, warzywa, unikanie fast foodu i przetworzonej żywności', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '2-4 g/d', reason: 'Redukcja triglicerydów o 15-30% (ESC/EAS 2019, Endocrine Society 2020)' },
    ],
  },
];

// ─── Liver / Hepatic Rules (27.4) ────────────────────────────────────────────

const LIVER_RULES: PolicyRule[] = [
  // 27.4.1 NAFLD (Niealkoholowa stłuszczeniowa choroba wątroby)
  {
    id: 'nafld',
    name: 'NAFLD',
    description: 'Niealkoholowa stłuszczeniowa choroba wątroby — redukcja masy 7-10%, ograniczenie fruktozy, dieta śródziemnomorska',
    priority: 72,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'nafld', 'stłuszczenie wątroby', 'stluszczenie watroby', 'niealkoholowa stłuszczeniowa', 'fatty liver', 'non-alcoholic fatty liver'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetKcal', operation: 'ADD', value: -500 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 5 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 20 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 35 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'piwo', 'wino', 'wódka', 'alcohol', 'beer', 'wine', 'vodka', 'syrop fruktozowy', 'fruktoza', 'fructose syrup', 'high fructose', 'napój gazowany', 'soda', 'cola', 'fast food', 'frytki', 'fries'] },
      { type: 'CLINICAL_NOTE', note: 'NAFLD: redukcja masy ciała o 7-10% (najskuteczniejsza interwencja), dieta śródziemnomorska, ograniczenie fruktozy i cukrów prostych, eliminacja alkoholu, błonnik 25-35g/d. Źródło: EASL/EASD/EASO 2016, AASLD 2023', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: oliwa z oliwek, orzechy, ryby tłuste, kawa (2-3 filiżanki/d — działanie hepatoprotekcyjne), warzywa, produkty pełnoziarniste', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina E', dose: '800 IU/d', reason: 'Działanie przeciwutleniające w stłuszczeniu wątroby (AASLD 2023 — tylko bez cukrzycy)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '1-2 g/d', reason: 'Redukcja stłuszczenia i triglicerydów wątrobowych' },
    ],
  },
  // 27.4.2 NASH (Niealkoholowe stłuszczeniowe zapalenie wątroby)
  {
    id: 'nash',
    name: 'NASH',
    description: 'Niealkoholowe stłuszczeniowe zapalenie wątroby — jak NAFLD + bardziej restrykcyjne, wit. E',
    priority: 76,
    version: '1.0',
    conflictsWith: ['NAFLD'],
    condition: (ctx) => hasCondition(ctx, 'nash', 'stłuszczeniowe zapalenie wątroby', 'stluszczeniowe zapalenie watroby', 'non-alcoholic steatohepatitis', 'steatohepatitis'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetKcal', operation: 'ADD', value: -500 },
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MULTIPLY', value: 1.2 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 4 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 16 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 35 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'piwo', 'wino', 'wódka', 'alcohol', 'beer', 'wine', 'vodka', 'syrop fruktozowy', 'fruktoza', 'fructose syrup', 'high fructose', 'napój gazowany', 'soda', 'cola', 'fast food', 'frytki', 'fries', 'słodycze', 'candy', 'cukier', 'sugar'] },
      { type: 'CLINICAL_NOTE', note: 'NASH: stan zapalny wątroby — redukcja masy 7-10%, bezwzględna eliminacja alkoholu, tłuszcze nasycone <7% energii, cukry proste minimalne, dieta śródziemnomorska. Źródło: EASL/EASD/EASO 2016, AASLD 2023', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA: NASH może prowadzić do włóknienia i marskości. Regularna kontrola hepatologiczna obowiązkowa. Białko 1.2-1.5g/kg dla ochrony masy mięśniowej przy redukcji.', category: 'WARNING' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina E', dose: '800 IU/d', reason: 'Redukcja stanu zapalnego w NASH (AASLD 2023 — potwierdzone w badaniu PIVENS)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '2 g/d', reason: 'Działanie przeciwzapalne i redukcja stłuszczenia' },
    ],
  },
  // 27.4.3 Marskość wątroby (stage: kompensowana vs dekompensowana)
  {
    id: 'liver-cirrhosis',
    name: 'Marskość wątroby',
    description: 'Marskość wątroby — białko 1.2-1.5g/kg, małe częste posiłki, sód <2g przy wodobrzuszu',
    priority: 82,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'cirrhosis', 'marskość wątroby', 'marskosc watroby', 'marskość', 'liver cirrhosis'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MULTIPLY', value: 1.3 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2000 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 20, max: 30 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSodium', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'piwo', 'wino', 'wódka', 'alcohol', 'beer', 'wine', 'vodka', 'surowe mięso', 'tatar', 'sushi', 'raw meat', 'raw fish', 'solony', 'marynowany', 'salted', 'pickled'] },
      { type: 'CLINICAL_NOTE', note: 'Marskość wątroby: białko 1.2-1.5g/kg/d (zapobieganie sarkopenii), 4-6 małych posiłków/d (w tym przekąska nocna!), sód <2g/d przy wodobrzuszu/obrzękach, bezwzględna eliminacja alkoholu. Źródło: EASL 2019 CPG Nutrition in CLD, ESPEN 2020', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Kompensowana: normalna dieta z wyższym białkiem. Dekompensowana (wodobrzusze, obrzęki): ścisła restrykcja sodu <2g, rozważyć restrykcję płynów. Przekąska nocna (50g węglowodanów) zapobiega katabolizmowi nocnemu.', category: 'INFO' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA: Pacjent z marskością wymaga regularnej opieki hepatologicznej. Nie ograniczać białka (dawne zalecenia) — sarkopennia pogarsza rokowanie.', category: 'WARNING' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'BCAA (aminokwasy rozgałęzione)', dose: '0.25 g/kg/d', reason: 'Poprawa syntezy białek, zapobieganie sarkopenii i encefalopatii (ESPEN 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d', reason: 'Częsty głęboki niedobór w marskości' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Cynk', dose: '50 mg/d', reason: 'Częsty niedobór, wspiera metabolizm amoniaku' },
    ],
  },
  // 27.4.4 Encefalopatia wątrobowa (RED FLAG CRITICAL)
  {
    id: 'hepatic-encephalopathy',
    name: 'Encefalopatia wątrobowa',
    description: 'Encefalopatia wątrobowa — RED FLAG CRITICAL, białko roślinne > zwierzęce, BCAA, laktuloza',
    priority: 92,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'hepatic encephalopathy', 'encefalopatia wątrobowa', 'encefalopatia watrobowa', 'encefalopatia', 'encephalopathy'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MULTIPLY', value: 1.2 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2000 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 35 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSodium', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'piwo', 'wino', 'wódka', 'alcohol', 'beer', 'wine', 'vodka', 'surowe mięso', 'tatar', 'raw meat', 'czerwone mięso', 'wołowina', 'wieprzowina', 'beef', 'pork', 'red meat'] },
      { type: 'CLINICAL_NOTE', note: 'Encefalopatia wątrobowa: NIE ograniczać białka (1.2-1.5g/kg/d), preferować białko roślinne (strączkowe, tofu) i nabiał nad mięso czerwone, 4-6 małych posiłków + przekąska nocna, błonnik 25-35g/d (wspiera eliminację amoniaku). Źródło: EASL 2022 HE Guidelines, ISHEN Consensus, ESPEN 2020', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA KRYTYCZNA: Encefalopatia wątrobowa jest stanem zagrożenia życia. Plan dietetyczny MUSI być weryfikowany przez hepatologa. Nie generować automatycznie.', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Hierarchia źródeł białka: 1) roślinne (soja, strączkowe) — generują mniej amoniaku, 2) nabiał, 3) ryby, 4) drób biały. Unikać: czerwone mięso, podroby.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'BCAA (aminokwasy rozgałęzione)', dose: '0.25 g/kg/d', reason: 'Poprawa stanu odżywienia i redukcja epizodów encefalopatii (EASL 2022, ESPEN 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Cynk', dose: '50 mg/d', reason: 'Kofaktor cyklu mocznikowego — wspiera eliminację amoniaku' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d', reason: 'Głęboki niedobór typowy w zaawansowanej chorobie wątroby' },
    ],
  },
];

// ─── Digestive / GI Rules (27.5) ──────────────────────────────────────────────

const DIGESTIVE_RULES: PolicyRule[] = [
  // 27.5.1 GERD (ULEPSZENIE — unikanie jedzenia 3h przed snem, mniejsze porcje, pozycja)
  {
    id: 'gerd',
    name: 'GERD (Refluks)',
    description: 'Refluks żołądkowo-przełykowy — unikanie triggerów, mniejsze porcje, przerwa 3h przed snem',
    priority: 65,
    version: '2.0',
    condition: (ctx) => hasCondition(ctx, 'gerd', 'refluks', 'reflux', 'choroba refluksowa', 'reflux disease'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['pomidor', 'cytrus', 'cytryna', 'pomarańcza', 'mięta', 'czekolada', 'kawa', 'alkohol', 'piwo', 'wino', 'tomato', 'citrus', 'lemon', 'orange', 'mint', 'chocolate', 'coffee', 'alcohol', 'beer', 'wine'] },
      { type: 'MEAL_DISTRIBUTION', nutrient: 'fat', maxPerMealPct: 25 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 22 },
      { type: 'CLINICAL_NOTE', note: 'GERD: unikanie pomidorów, cytrusów, kawy, czekolady, mięty, alkoholu, tłustych potraw; mniejsze posiłki 5-6x/d, ostatni posiłek min. 3h przed snem, unikanie leżenia po jedzeniu. Źródło: ACG 2022 Guidelines', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: podwyższona pozycja głowy podczas snu (15-20cm), unikanie obcisłej odzieży po posiłku, chodzenie po jedzeniu zamiast siedzenia', category: 'RECOMMENDATION' },
    ],
  },
  // 27.5.2 Choroba wrzodowa żołądka (NOWA)
  {
    id: 'gastric-ulcer',
    name: 'Choroba wrzodowa żołądka',
    description: 'Choroba wrzodowa żołądka — lekkostrawna, małe częste posiłki, probiotyki',
    priority: 68,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'gastric ulcer', 'wrzód żołądka', 'wrzod zoladka', 'choroba wrzodowa żołądka', 'choroba wrzodowa zoladka', 'peptic ulcer'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'piwo', 'wino', 'wódka', 'alcohol', 'beer', 'wine', 'vodka', 'kawa', 'coffee', 'ostre przyprawy', 'chili', 'pieprz cayenne', 'hot pepper', 'ocet', 'vinegar'] },
      { type: 'MEAL_DISTRIBUTION', nutrient: 'fat', maxPerMealPct: 20 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowFodmap', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Choroba wrzodowa żołądka: dieta lekkostrawna, 5-6 małych posiłków/d, unikanie alkoholu, kawy na pusty żołądek, ostrych przypraw i NLPZ. Probiotyki (Lactobacillus, Saccharomyces boulardii) mogą wspierać leczenie. Źródło: ACG 2017', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: gotowanie na parze, duszenie; unikanie smażenia; jedzenie w spokoju, dokładne gryzienie', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Probiotyk (Lactobacillus + S. boulardii)', dose: '1-2 kapsułki/d', reason: 'Wsparcie bariery śluzówkowej żołądka (ACG 2017)' },
    ],
  },
  // 27.5.3 Choroba wrzodowa dwunastnicy (NOWA)
  {
    id: 'duodenal-ulcer',
    name: 'Choroba wrzodowa dwunastnicy',
    description: 'Choroba wrzodowa dwunastnicy — jak żołądka + unikanie długich przerw między posiłkami',
    priority: 67,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'duodenal ulcer', 'wrzód dwunastnicy', 'wrzod dwunastnicy', 'choroba wrzodowa dwunastnicy'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'piwo', 'wino', 'wódka', 'alcohol', 'beer', 'wine', 'vodka', 'kawa', 'coffee', 'ostre przyprawy', 'chili', 'pieprz cayenne', 'hot pepper', 'ocet', 'vinegar'] },
      { type: 'MEAL_DISTRIBUTION', nutrient: 'fat', maxPerMealPct: 20 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowFodmap', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Choroba wrzodowa dwunastnicy: dieta lekkostrawna, 5-6 małych posiłków/d, unikanie długich przerw między posiłkami (>4h), alkoholu, kawy na pusty żołądek, ostrych przypraw. Źródło: ACG 2017', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Kluczowe: regularne posiłki co 3-4h zapobiegają podrażnieniu przez kwas żołądkowy na pusty dwunastnicę', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Probiotyk (Lactobacillus + S. boulardii)', dose: '1-2 kapsułki/d', reason: 'Wsparcie eradykacji H. pylori i regeneracji śluzówki' },
    ],
  },
  // 27.5.4 IBS-C — zaparciowy (zastępuje ogólny IBS)
  {
    id: 'ibs-c',
    name: 'IBS-C (zaparciowy)',
    description: 'IBS z dominującymi zaparciami — błonnik rozpuszczalny 20-25g/d, nawodnienie, low-FODMAP opcjonalnie',
    priority: 70,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'ibs-c', 'ibs zaparciowy', 'ibs constipation', 'jelito drażliwe zaparciowe', 'ibs z zaparciami'),
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'ibsFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 20, max: 25 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cebula', 'czosnek', 'por', 'grzyb', 'onion', 'garlic', 'leek', 'mushroom'] },
      { type: 'CLINICAL_NOTE', note: 'IBS-C: błonnik ROZPUSZCZALNY 20-25g/d (psyllium, owies, siemię lniane), nawodnienie 2-2.5L/d, regularne posiłki. Low-FODMAP jeśli brak odpowiedzi na błonnik. Źródło: ACG 2021 IBS Guidelines, Monash University', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: psyllium (łuski babki jajowatej) 5-10g/d — najlepiej udokumentowany błonnik w IBS-C. Unikać błonnika nierozpuszczalnego (otręby pszenne) — może nasilać objawy.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Psyllium (babka jajowata)', dose: '5-10 g/d', reason: 'Błonnik rozpuszczalny o najlepszych dowodach w IBS-C (ACG 2021)' },
    ],
  },
  // 27.5.5 IBS-D — biegunkowy
  {
    id: 'ibs-d',
    name: 'IBS-D (biegunkowy)',
    description: 'IBS z dominującymi biegunkami — low-FODMAP, ograniczenie błonnika nierozpuszczalnego',
    priority: 71,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'ibs-d', 'ibs biegunkowy', 'ibs diarrhea', 'jelito drażliwe biegunkowe', 'ibs z biegunkami'),
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'ibsFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowFodmap', flagValue: true },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 15, max: 22 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cebula', 'czosnek', 'por', 'grzyb', 'jabłko', 'gruszka', 'kofeina', 'kawa', 'alkohol', 'onion', 'garlic', 'leek', 'mushroom', 'apple', 'pear', 'caffeine', 'coffee', 'alcohol', 'sorbitol', 'ksylitol', 'xylitol'] },
      { type: 'CLINICAL_NOTE', note: 'IBS-D: dieta low-FODMAP (ścisła eliminacja 4-6 tygodni, potem reintrodukcja), ograniczenie błonnika NIEROZPUSZCZALNEGO, unikanie kofeiny, alkoholu, laktozy, sorbitolu. Źródło: ACG 2021, Monash University', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Fazy diety low-FODMAP: 1) Eliminacja (4-6 tyg), 2) Reintrodukcja (6-8 tyg, po jednym FODMAP), 3) Personalizacja. Nie stosować long-term bez reintrodukcji.', category: 'RECOMMENDATION' },
    ],
  },
  // 27.5.6 IBS-M — mieszany
  {
    id: 'ibs-m',
    name: 'IBS-M (mieszany)',
    description: 'IBS mieszany — low-FODMAP jako baza, błonnik rozpuszczalny umiarkowanie',
    priority: 70,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'ibs-m', 'ibs mieszany', 'ibs mixed', 'jelito drażliwe mieszane', 'ibs z zaparciami i biegunkami'),
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'ibsFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowFodmap', flagValue: true },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 18, max: 25 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cebula', 'czosnek', 'por', 'grzyb', 'onion', 'garlic', 'leek', 'mushroom'] },
      { type: 'CLINICAL_NOTE', note: 'IBS-M: dieta low-FODMAP jako baza, błonnik rozpuszczalny umiarkowanie (18-25g/d), indywidualizacja na podstawie dominujących objawów. Źródło: ACG 2021', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Objawy mieszane wymagają elastycznego podejścia — monitorować, które posiłki nasilają zaparcia vs biegunki i dostosowywać indywidualnie', category: 'RECOMMENDATION' },
    ],
  },
  // Zachowany ogólny IBS dla pacjentów bez podtypu
  {
    id: 'ibs',
    name: 'IBS (Zespół jelita drażliwego)',
    description: 'IBS bez określonego podtypu — preferencja produktów low-FODMAP',
    priority: 69,
    version: '2.0',
    condition: (ctx) => {
      if (!hasCondition(ctx, 'ibs', 'jelito drażliwe', 'jelita drażliwego', 'irritable bowel')) return false;
      // Skip if specific subtype already matched
      if (hasCondition(ctx, 'ibs-c', 'ibs zaparciowy', 'ibs-d', 'ibs biegunkowy', 'ibs-m', 'ibs mieszany')) return false;
      return true;
    },
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'ibsFriendly', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowFodmap', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cebula', 'czosnek', 'por', 'grzyb', 'onion', 'garlic', 'leek', 'mushroom'] },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 20, max: 30 },
      { type: 'CLINICAL_NOTE', note: 'IBS (nieokreślony podtyp): preferowane produkty low-FODMAP, unikanie cebuli/czosnku/grzybów, umiarkowany błonnik (20-30g). Zalecane określenie podtypu (IBS-C/D/M) dla lepszej personalizacji.', category: 'RESTRICTION' },
    ],
  },
  // 27.5.7 Choroba Leśniowskiego-Crohna (NOWA)
  {
    id: 'crohns-disease',
    name: 'Choroba Leśniowskiego-Crohna',
    description: 'Choroba Crohna — stage: remisja vs zaostrzenie, suplementacja B12/Fe/D3/Ca/Zn',
    priority: 78,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'crohn', 'leśniowski', 'lesniowski', 'choroba crohna', 'crohn disease', 'crohns'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MULTIPLY', value: 1.2 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 15, max: 25 },
      { type: 'PREFER_PRODUCTS', flagKey: 'ibsFriendly', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'piwo', 'wino', 'alcohol', 'beer', 'wine', 'fast food', 'chipsy', 'chips', 'ultra-przetworzone', 'ultra-processed'] },
      { type: 'CLINICAL_NOTE', note: 'Choroba Crohna — remisja: dieta śródziemnomorska, unikanie ultra-przetworzonej żywności, białko 1.2-1.5g/kg. Zaostrzenie: dieta lekkostrawna, niskobłonnikowa, płynna/papkowata. RED FLAG: HIGH w zaostrzeniu. Źródło: ECCO/ESPEN 2020', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'W remisji: pełnoziarniste, warzywa gotowane, owoce bez skórki, ryby. W zaostrzeniu: unikać surowych warzyw, orzechów, nasion, produktów z dużą ilością błonnika nierozpuszczalnego.', category: 'INFO' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA: Choroba Crohna wymaga regularnej opieki gastroenterologicznej. Zaostrzenie = RED FLAG HIGH.', category: 'WARNING' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12', dose: '1000 µg/tyg (sublingual)', reason: 'Częsty niedobór przy zajęciu jelita krętego (ECCO/ESPEN 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo', dose: 'wg poziomu ferrytyny', reason: 'Anemia częsta w IBD — preferować iv jeśli nietolerancja doustnego' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d', reason: 'Częsty niedobór, działanie immunomodulujące' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Cynk', dose: '25-50 mg/d', reason: 'Wsparcie gojenia śluzówki i odporności' },
    ],
  },
  // 27.5.8 Wrzodziejące zapalenie jelita grubego (colitis ulcerosa) (NOWA)
  {
    id: 'ulcerative-colitis',
    name: 'Wrzodziejące zapalenie jelita grubego',
    description: 'Colitis ulcerosa — stage: remisja vs zaostrzenie, suplementacja Fe/D3/kwas foliowy',
    priority: 77,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'ulcerative colitis', 'colitis ulcerosa', 'wrzodziejące zapalenie', 'wrzodziejace zapalenie', 'wzjg', 'uc'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MULTIPLY', value: 1.2 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 15, max: 25 },
      { type: 'PREFER_PRODUCTS', flagKey: 'ibsFriendly', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'piwo', 'wino', 'alcohol', 'beer', 'wine', 'fast food', 'chipsy', 'chips', 'ultra-przetworzone', 'ultra-processed'] },
      { type: 'CLINICAL_NOTE', note: 'Colitis ulcerosa — remisja: normalna dieta z unikaniem indywidualnych trigger foods, błonnik umiarkowany. Zaostrzenie: dieta niskobłonnikowa, niskoresidual, RED FLAG: HIGH. Źródło: ECCO 2022', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Remisja: preferować gotowane warzywa, owoce bez skórki, białko chude. Zaostrzenie: unikać surowych warzyw, orzechów, nasion, ostrych przypraw, laktozy.', category: 'INFO' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA: Zaostrzenie colitis ulcerosa = RED FLAG HIGH — wymaga opieki gastroenterologicznej.', category: 'WARNING' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo', dose: 'wg poziomu ferrytyny', reason: 'Anemia z utraty krwi typowa w WZJG (ECCO 2022)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000 IU/d', reason: 'Częsty niedobór, działanie immunomodulujące w IBD' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Kwas foliowy', dose: '400-800 µg/d', reason: 'Niedobór przy terapii sulfasalazyną, profilaktyka raka jelita grubego' },
    ],
  },
  // 27.5.9 SIBO (NOWA)
  {
    id: 'sibo',
    name: 'SIBO',
    description: 'Przerost bakteryjny jelita cienkiego — low-FODMAP eliminacja, małe częste posiłki, przerwy 4h',
    priority: 72,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'sibo', 'przerost bakteryjny', 'small intestinal bacterial overgrowth', 'bakteryjny przerost'),
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'lowFodmap', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'ibsFriendly', flagValue: true },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 12, max: 20 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cebula', 'czosnek', 'por', 'grzyb', 'kapusta', 'brokuły', 'kalafior', 'jabłko', 'gruszka', 'onion', 'garlic', 'leek', 'mushroom', 'cabbage', 'broccoli', 'cauliflower', 'apple', 'pear', 'prebiotyk', 'prebiotic', 'inulina', 'inulin'] },
      { type: 'CLINICAL_NOTE', note: 'SIBO: dieta low-FODMAP faza eliminacji (4-6 tyg), unikanie prebiotyków i nadmiaru błonnika fermentowalnego, małe porcje, przerwy min. 4h między głównymi posiłkami (MMC — migrujący kompleks motoryczny). Źródło: ACG 2020 SIBO Guidelines', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: 3 główne posiłki z 4h przerwami (aktywacja MMC), unikanie ciągłego podjadania. Po leczeniu antybiotykowym: stopniowa reintrodukcja FODMAP.', category: 'RECOMMENDATION' },
    ],
  },
  // 27.5.10 Zaparcia przewlekłe (bez IBS) (NOWA)
  {
    id: 'chronic-constipation',
    name: 'Zaparcia przewlekłe',
    description: 'Zaparcia przewlekłe bez IBS — błonnik 25-35g/d stopniowo, nawodnienie 2-2.5L/d',
    priority: 60,
    version: '1.0',
    condition: (ctx) => {
      if (!hasCondition(ctx, 'constipation', 'zaparcia', 'zaparcie', 'zaparcia przewlekłe', 'chronic constipation')) return false;
      // Skip if IBS already diagnosed
      if (hasCondition(ctx, 'ibs', 'jelito drażliwe')) return false;
      return true;
    },
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 25, max: 35 },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Zaparcia przewlekłe: błonnik 25-35g/d (zwiększać stopniowo o 5g/tyg!), nawodnienie 2-2.5L/d, produkty pełnoziarniste, warzywa, owoce, nasiona. Źródło: WGO 2010, ACG 2021', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: siemię lniane 2 łyżki/d, suszone śliwki 5-6 szt/d, kefir/jogurt naturalny, regularna aktywność fizyczna (30 min/d)', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Probiotyk (Bifidobacterium lactis)', dose: '10^9-10^10 CFU/d', reason: 'Poprawa częstości wypróżnień (WGO 2010)' },
    ],
  },
  // 27.5.11 Biegunki przewlekłe (bez IBS) (NOWA)
  {
    id: 'chronic-diarrhea',
    name: 'Biegunki przewlekłe',
    description: 'Biegunki przewlekłe bez IBS — dieta BRAT, elektrolity, unikanie laktozy/kofeiny/sorbitolu',
    priority: 62,
    version: '1.0',
    condition: (ctx) => {
      if (!hasCondition(ctx, 'diarrhea', 'biegunka', 'biegunki', 'biegunki przewlekłe', 'chronic diarrhea')) return false;
      // Skip if IBS already diagnosed
      if (hasCondition(ctx, 'ibs', 'jelito drażliwe')) return false;
      return true;
    },
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 10, max: 20 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['kofeina', 'kawa', 'caffeine', 'coffee', 'alkohol', 'alcohol', 'sorbitol', 'ksylitol', 'xylitol', 'sok owocowy', 'fruit juice'] },
      { type: 'PREFER_PRODUCTS', flagKey: 'ibsFriendly', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Biegunki przewlekłe: dieta BRAT jako baza (banany, ryż, jabłko gotowane, tosty), uzupełnienie elektrolitów, unikanie laktozy, kofeiny, sorbitolu, nadmiaru błonnika. Źródło: ACG, WGO', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: gotowany ryż biały, marchew gotowana, banany, ziemniaki, chude mięso (kurczak, indyk), probiotyki. Nawodnienie z elektrolitami kluczowe.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Probiotyk (Saccharomyces boulardii)', dose: '250-500 mg 2x/d', reason: 'Najlepiej udokumentowany probiotyk w biegunkach (WGO, Cochrane)' },
    ],
  },
  // 27.6.1 Nieceliakalna nadwrażliwość na gluten (NCGS) (NOWA)
  {
    id: 'ncgs',
    name: 'Nieceliakalna nadwrażliwość na gluten (NCGS)',
    description: 'NCGS — eliminacja glutenu (mniej restrykcyjna niż celiakia), rozważenie low-FODMAP',
    priority: 90,
    version: '1.0',
    condition: (ctx) => {
      // Skip if celiac already diagnosed (celiac rule handles it)
      if (hasCondition(ctx, 'celiac', 'celiakia')) return false;
      return hasCondition(ctx, 'ncgs', 'nadwrażliwość na gluten', 'nieceliakalna', 'non-celiac gluten', 'gluten sensitivity');
    },
    effects: [
      { type: 'EXCLUDE_PRODUCTS', flagKey: 'glutenFree', flagValue: false },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['pszenica', 'żyto', 'jęczmień', 'makaron', 'chleb pszenny', 'bułka pszenna', 'wheat', 'rye', 'barley', 'pasta', 'white bread'] },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowFodmap', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'NCGS: eliminacja glutenu — pszenica, żyto, jęczmień. Mniej restrykcyjna niż celiakia: śladowe ilości glutenu zwykle tolerowane. Owies certyfikowany bezglutenowy dopuszczalny. Rozważyć nakładanie się z wrażliwością na FODMAP (fruktany w pszenicy). Źródło: Salerno Experts\' Criteria 2015', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: prowadzenie dziennika objawów, próba reintrodukcji po 6-8 tygodniach eliminacji w celu potwierdzenia diagnozy. Produkty bezglutenowe: ryż, kukurydza, gryka, quinoa, amarant, proso.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA: Diagnoza NCGS wymaga uprzedniego wykluczenia celiakii (tTG-IgA, biopsja) i alergii na pszenicę (IgE). Jeśli nie wykonano badań — zalecić diagnostykę.', category: 'WARNING' },
    ],
  },
  // 27.6.2 Nietolerancja histaminy (NOWA)
  {
    id: 'histamine-intolerance',
    name: 'Nietolerancja histaminy',
    description: 'Nietolerancja histaminy — eliminacja produktów bogatych w histaminę, suplementacja DAO',
    priority: 85,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'histamine', 'histamina', 'nietolerancja histaminy', 'histamine intolerance'),
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: [
        // Dojrzewające sery
        'parmezan', 'gouda', 'cheddar', 'camembert', 'brie', 'roquefort', 'ser dojrzewający', 'ser pleśniowy',
        'parmesan', 'aged cheese', 'blue cheese',
        // Wędliny / fermentowane mięso
        'salami', 'kabanos', 'kiełbasa dojrzewająca', 'szynka dojrzewająca', 'chorizo', 'pepperoni',
        'cured meat', 'dry sausage',
        // Kiszonki / fermentowane
        'kiszonka', 'kapusta kiszona', 'kimchi', 'sauerkraut', 'sos sojowy', 'soy sauce', 'ocet', 'vinegar',
        // Ryby konserwowane / dojrzewające
        'konserwa rybna', 'sardynka w puszce', 'tuńczyk w puszce', 'śledź marynowany', 'anchois',
        'canned fish', 'canned tuna', 'pickled herring', 'anchovy',
        // Alkohol
        'wino', 'piwo', 'wino czerwone', 'wine', 'beer', 'red wine',
        // Inne
        'czekolada', 'kakao', 'chocolate', 'cocoa',
      ]},
      { type: 'CLINICAL_NOTE', note: 'Nietolerancja histaminy: eliminacja produktów bogatych w histaminę i wyzwalaczy uwalniania histaminy. Unikać: dojrzewające sery, wędliny, kiszonki, konserwy rybne, wino/piwo, czekolada, pomidory, szpinak, bakłażan, awokado. Preferencja: świeże produkty, mrożone zaraz po zakupie. Źródło: DGAKI Guidelines 2017', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane: świeże mięso i ryby (spożyte tego samego dnia lub mrożone), świeże warzywa (oprócz pomidorów, szpinaku, bakłażana), owoce (oprócz cytrusów, truskawek, bananów), zboża, ziemniaki, ryż.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Dieta eliminacyjna histaminowa przez 2-4 tygodnie, następnie stopniowa reintrodukcja z prowadzeniem dziennika objawów. Gotowanie i mrożenie obniżają poziom histaminy.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'DAO (diaminooksydaza)', dose: '1-2 kapsułki przed posiłkiem', reason: 'Enzym rozkładający histaminę — wspomaganie trawienia histaminy z pożywienia (DGAKI 2017)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina C', dose: '500-1000 mg/d', reason: 'Wspiera degradację histaminy, działanie antyhistaminowe (Jarisch 2015)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B6', dose: '50-100 mg/d', reason: 'Kofaktor DAO — wspiera aktywność enzymu rozkładającego histaminę' },
    ],
  },
  // Zachowane oryginalne reguły
  {
    id: 'celiac',
    name: 'Celiakia',
    description: 'Pacjent zgłosił celiakię — bezwzględna eliminacja glutenu',
    priority: 100,
    condition: (ctx) => hasCondition(ctx, 'celiac', 'celiakia'),
    effects: [
      { type: 'EXCLUDE_PRODUCTS', flagKey: 'glutenFree', flagValue: false },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['pszenica', 'żyto', 'jęczmień', 'owies', 'kasza manna', 'kuskus', 'wheat', 'rye', 'barley', 'oats', 'semolina', 'couscous'] },
      { type: 'CLINICAL_NOTE', note: 'Celiakia: bezwzględna eliminacja glutenu — wszystkie źródła pszenicy, żyta, jęczmienia i potencjalnie owsa', category: 'RESTRICTION' },
    ],
  },
  {
    id: 'lactose-intolerance',
    name: 'Nietolerancja laktozy (z wywiadu)',
    description: 'Pacjent zgłosił nietolerancję laktozy w problemach trawiennych',
    priority: 95,
    condition: (ctx) => hasCondition(ctx, 'lactose_intolerance', 'nietolerancja laktozy'),
    effects: [
      { type: 'EXCLUDE_PRODUCTS', flagKey: 'lactoseFree', flagValue: false },
      { type: 'CLINICAL_NOTE', note: 'Nietolerancja laktozy: wykluczono produkty mleczne zawierające laktozę', category: 'RESTRICTION' },
    ],
  },
];

// ─── Thyroid / Hormonal / Endocrine Rules (27.8) ─────────────────────────────

const HORMONAL_RULES: PolicyRule[] = [
  // 27.8.1 Hashimoto (separate from hypothyroidism — autoimmune focus)
  {
    id: 'hashimoto',
    name: 'Hashimoto',
    description: 'Choroba Hashimoto — autoimmunologiczne zapalenie tarczycy: selen, cynk, D3, rozważenie eliminacji glutenu',
    priority: 72,
    version: '1.0',
    conflictsWith: [],
    condition: (ctx) => hasCondition(ctx, 'hashimoto', 'choroba hashimoto', 'hashimoto thyroiditis', 'autoimmunologiczne zapalenie tarczycy'),
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'DAILY_TOTAL', max: 25 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['żywność wysoko przetworzona', 'fast food', 'cukier rafinowany', 'highly processed', 'refined sugar'] },
      { type: 'CLINICAL_NOTE', note: 'Hashimoto: autoimmunologiczne zapalenie tarczycy. Selen 100-200µg/d (orzechy brazylijskie 1-2 szt./d = ~70-140µg Se). Cynk 15-30mg/d (wsparcie konwersji T4→T3). Wit. D3 2000-4000 IU/d (immunomodulacja). Jod: UMIARKOWANY — nie eliminować całkowicie, ale nie suplementować ponad 150µg/d (nadmiar może nasilić autoimmunizację). Źródło: ETA 2023, ATA Guidelines', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Hashimoto — rozważenie eliminacji glutenu: dowody umiarkowane, ale część pacjentów zgłasza poprawę (szczególnie z podwyższonymi anty-tTG). Decyzja indywidualna z dietetykiem. Źródło: Krysiak et al. 2019, Vojdani 2015', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Hashimoto — wsparcie: omega-3 (2g/d, działanie przeciwzapalne), kurkumina, antyoksydanty (witamina C, E). Unikać: soi w nadmiarze (izoflawonoidy mogą zaburzać wchłanianie lewotyroksyny), żywności wysoko przetworzonej.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Selen (selenometionina)', dose: '100-200 µg/d', reason: 'Redukcja anty-TPO o 20-40% po 3-6 mies. suplementacji (meta-analiza Wichman et al. 2016, ETA 2023)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d', reason: 'Immunomodulacja, niedobór u >70% pacjentów z Hashimoto (Mazokopakis et al. 2015)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Cynk', dose: '15-30 mg/d', reason: 'Wsparcie konwersji T4→T3 i funkcji immunologicznej (Ertek et al. 2010)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '2 g/d', reason: 'Działanie przeciwzapalne, redukcja cytokin prozapalnych w autoimmunizacji' },
    ],
  },
  // 27.8.3 Niedoczynność tarczycy (ULEPSZENIE — selen, jod, lewotyroksyna, D3)
  {
    id: 'hypothyroidism',
    name: 'Niedoczynność tarczycy',
    description: 'Niedoczynność tarczycy — selen, jod, D3, interakcja z lewotyroksyną, warzywa krzyżowe gotowane',
    priority: 60,
    version: '2.0',
    condition: (ctx) => hasCondition(ctx, 'hypothyroidism', 'niedoczynność tarczycy', 'niedoczynnosc tarczycy'),
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['soja', 'soy', 'tofu', 'tempeh', 'edamame', 'mleko sojowe', 'soy milk'] },
      { type: 'CLINICAL_NOTE', note: 'Niedoczynność tarczycy v2.0: produkty bogate w selen (ryby, orzechy brazylijskie, jaja) i jod (ryby morskie, sól jodowana, nabiał). Warzywa krzyżowe (brokuły, kalafior, kapusta) TYLKO gotowane — gotryna dezaktywowana przez obróbkę termiczną. Źródło: ETA 2023, ATA Guidelines', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Lewotyroksyna (jeśli stosowana): przyjmować 30-60 min przed śniadaniem na pusty żołądek. Unikać jednoczesnego spożycia: wapń, żelazo, soja, kawa, błonnik w suplementach (w ciągu 4h od leku). Źródło: ATA 2014, ETA', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Unikać soi w dużych ilościach (izoflawonoidy mogą zaburzać wchłanianie lewotyroksyny i syntezę hormonów tarczycy). Ograniczyć: tofu, tempeh, mleko sojowe, edamame.', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Selen (selenometionina)', dose: '55-100 µg/d', reason: 'Wsparcie konwersji T4→T3, selen jest kofaktorem dejodynaz (ETA 2023)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '1000-2000 IU/d', reason: 'Częsty niedobór u pacjentów z niedoczynnością tarczycy, wsparcie immunologiczne' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Jod', dose: '150 µg/d (RDA)', reason: 'Substrat do syntezy T3/T4 — nie przekraczać 200µg/d bez kontroli lekarza (ETA 2023)' },
    ],
  },
  // 27.8.2 Cukrzyca ciążowa (GDM)
  {
    id: 'gestational-diabetes',
    name: 'Cukrzyca ciążowa (GDM)',
    description: 'Cukrzyca ciążowa — węglowodany 40-45%, niski IG, 6 posiłków/d, BEZ redukcji kalorycznej',
    priority: 88,
    version: '1.0',
    conflictsWith: ['Otyłość'],
    condition: (ctx) => {
      if (ctx.pregnancyStatus !== 'pregnant') return false;
      return hasCondition(ctx, 'cukrzyca ciążowa', 'gdm', 'gestational diabetes', 'diabetes ciążowa', 'cukrzyca w ciąży');
    },
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetCarbsG', operation: 'MULTIPLY', value: 0.85 },
      { type: 'MEAL_DISTRIBUTION', nutrient: 'carbs', maxPerMealPct: 20 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'DAILY_TOTAL', max: 20 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'diabeticFriendly', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cukier', 'dżem', 'syrop', 'miód', 'słodzik', 'cukierki', 'czekolada', 'sok owocowy', 'napój słodzony', 'sugar', 'jam', 'syrup', 'honey', 'candy', 'chocolate', 'fruit juice', 'sweetened beverage', 'białe pieczywo', 'white bread', 'biały ryż', 'white rice'] },
      { type: 'CLINICAL_NOTE', note: 'Cukrzyca ciążowa (GDM): węglowodany 40-45% energii, niski IG, 6 posiłków/d (3 główne + 3 przekąski). NIE stosować redukcji kalorycznej — ciąża wymaga +300kcal od II trymestru! Sok owocowy max 150ml/d. Ograniczenie cukrów prostych. Źródło: PTD/PTG 2024, FIGO 2015', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'GDM — kontrola glikemii: na czczo <95 mg/dL, 1h po posiłku <140 mg/dL, 2h po posiłku <120 mg/dL. Monitorowanie glukometrem — zapisywanie wyników. Aktywność fizyczna 30 min/d (spacer po posiłku obniża glikemię poposiłkową). Źródło: PTD 2024', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'GDM — UWAGA: NIE łączyć z dietą redukcyjną! Deficyt kaloryczny w ciąży jest przeciwwskazany nawet przy GDM. Jeśli pacjentka ma nadwagę/otyłość — kontrola przyrostu masy, nie redukcja.', category: 'WARNING' },
    ],
  },
  // 27.8.4 PCOS (ULEPSZENIE — inozytol, D3, chrom, redukcja masy, anti-inflammatory)
  {
    id: 'pcos',
    name: 'PCOS',
    description: 'PCOS v2.0 — kontrola insuliny, niski IG, inozytol, D3, chrom, omega-3, redukcja 5-10% przy nadwadze',
    priority: 70,
    version: '2.0',
    condition: (ctx) => {
      if (ctx.hormonalIssues?.some(h => h.toLowerCase().includes('pcos'))) return true;
      return hasCondition(ctx, 'pcos', 'zespół policystycznych jajników', 'zespol policystycznych jajnikow', 'polycystic ovary syndrome');
    },
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetCarbsG', operation: 'MULTIPLY', value: 0.9 },
      { type: 'MEAL_DISTRIBUTION', nutrient: 'carbs', maxPerMealPct: 28 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'DAILY_TOTAL', max: 25 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 20 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'diabeticFriendly', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cukier', 'dżem', 'syrop', 'słodzik', 'cukierki', 'napój słodzony', 'sugar', 'jam', 'syrup', 'candy', 'sweetened', 'białe pieczywo', 'white bread', 'biały ryż', 'white rice'] },
      { type: 'CLINICAL_NOTE', note: 'PCOS v2.0: węglowodany 40-45% energii (niski IG), białko 1.2g/kg, tłuszcze nienasycone (omega-3, oliwa, orzechy). Redukcja masy 5-10% przy nadwadze — poprawia owulację, obniża androgeny, poprawia insulinowrażliwość. Regularne posiłki co 3-4h. Źródło: International PCOS Network 2023, Endocrine Society 2023', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'PCOS — dieta przeciwzapalna: omega-3 (ryby tłuste 2-3x/tyg), antyoksydanty (jagody, warzywa kolorowe), kurkumina, unikanie żywności wysoko przetworzonej i trans-tłuszczów. Źródło: Teede et al. 2023', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Mio-inozytol', dose: '2-4 g/d', reason: 'Poprawa wrażliwości na insulinę, regulacja cyklu, redukcja androgenów (Unfer et al. 2017, PCOS Network 2023). Stosunek mio:D-chiro = 40:1' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d', reason: 'Niedobór u >60% pacjentek z PCOS, poprawa insulinowrażliwości i owulacji (He et al. 2015)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Chrom', dose: '200-1000 µg/d', reason: 'Poprawa wrażliwości na insulinę, redukcja glikemii na czczo (Fazelian et al. 2017)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '1-2 g/d', reason: 'Redukcja stanów zapalnych i trójglicerydów, poprawa profilu lipidowego w PCOS' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Kwas foliowy', dose: '400-800 µg/d', reason: 'Szczególnie ważny przy planowaniu ciąży (częste u pacjentek z PCOS szukających pomocy)' },
    ],
  },
];

// ─── Pregnancy / Breastfeeding ────────────────────────────────────────────────

const PREGNANCY_RULES: PolicyRule[] = [
  {
    id: 'pregnancy',
    name: 'Ciąża',
    description: 'Pacjentka jest w ciąży — zwiększone zapotrzebowanie, wykluczenia bezpieczeństwa',
    priority: 95,
    condition: (ctx) => ctx.pregnancyStatus === 'pregnant',
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetKcal', operation: 'ADD', value: 300 },
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'ADD', value: 25 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['sushi', 'surowe mięso', 'tatar', 'surowe ryby', 'raw fish', 'raw meat', 'steak tartare'] },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'wino', 'piwo', 'alcohol', 'wine', 'beer'] },
      { type: 'CLINICAL_NOTE', note: 'Ciąża: +300 kcal/dzień, +25g białka, wykluczono surowe mięso/ryby i alkohol', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Ciąża: zalecana suplementacja kwasu foliowego, żelaza i DHA — skonsultuj z lekarzem', category: 'RECOMMENDATION' },
    ],
  },
  {
    id: 'breastfeeding',
    name: 'Karmienie piersią',
    description: 'Pacjentka karmi piersią — zwiększone zapotrzebowanie kaloryczne',
    priority: 90,
    condition: (ctx) => ctx.pregnancyStatus === 'breastfeeding',
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetKcal', operation: 'ADD', value: 500 },
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'ADD', value: 20 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'alcohol', 'wino', 'wine', 'piwo', 'beer'] },
      { type: 'CLINICAL_NOTE', note: 'Karmienie piersią: +500 kcal/dzień, +20g białka, wykluczono alkohol', category: 'RESTRICTION' },
    ],
  },
];

// ─── Kidney Rules (27.7) ─────────────────────────────────────────────────────

const KIDNEY_RULES: PolicyRule[] = [
  // 27.7.1 CKD — Przewlekła choroba nerek (stage-dependent)
  {
    id: 'ckd',
    name: 'Przewlekła choroba nerek (CKD)',
    description: 'CKD — białko stage-dependent (0.6-0.8g/kg st.3-5 bez dializy), ograniczenie potasu, fosforu, sodu',
    priority: 85,
    version: '1.0',
    conflictsWith: ['Zespół nerczycowy'],
    condition: (ctx) => hasCondition(ctx, 'ckd', 'przewlekła choroba nerek', 'przewlekla choroba nerek', 'chronic kidney disease', 'niewydolność nerek', 'niewydolnosc nerek', 'kidney disease', 'renal failure', 'choroba nerek'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'SET', value: 0.8 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2000 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'potassium', scope: 'DAILY_TOTAL', max: 2500 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'phosphorus', scope: 'DAILY_TOTAL', max: 800 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 20, max: 30 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSodium', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['podroby', 'wątróbka', 'nerki', 'offal', 'liver', 'kidney', 'parówka', 'kiełbasa', 'kabanos', 'sausage', 'hot dog', 'solone', 'marynowane', 'konserwy', 'canned', 'salted', 'pickled', 'cola', 'kakao', 'czekolada', 'cocoa', 'chocolate', 'banan', 'banana', 'suszone owoce', 'dried fruit'] },
      { type: 'CLINICAL_NOTE', note: 'CKD st.3-5 (bez dializy): białko 0.6-0.8g/kg/d (KDOQI 2020), potas <2500mg/d, fosfor <800mg/d, sód <2000mg/d. Unikać produktów wysoko przetworzonych (fosforany jako dodatki E338-E341, E450-E452). Źródło: KDOQI 2020, KDIGO 2024, ESPEN 2021 CKD', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'CKD na dializie: białko wyższe 1.0-1.2g/kg/d (katabolizm dializy). Potasu i fosforu nadal ograniczać. Energia 25-35 kcal/kg/d. Nocna przekąska przeciw katabolizmowi.', category: 'INFO' },
      { type: 'CLINICAL_NOTE', note: 'Źródła fosforu do ograniczenia: cola, kakao, czekolada, sery topione, wędliny, konserwy (fosforany dodane mają wchłanialność ~100% vs ~40-60% z naturalnych źródeł).', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '1000-2000 IU/d', reason: 'Zaburzenia metabolizmu wit. D w CKD, niedobór u >80% pacjentów (KDIGO 2017)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo (przy anemii)', dose: 'wg zaleceń lekarza', reason: 'Anemia nerkopochodna częsta w CKD st.3-5 (KDIGO Anemia 2012)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Kwas foliowy', dose: '400-800 µg/d', reason: 'Częsty niedobór w CKD, zwłaszcza na dializie' },
    ],
  },
  // 27.7.2 Kamica nerkowa (typ: szczawianowa/moczanowa/wapniowa)
  {
    id: 'kidney-stones',
    name: 'Kamica nerkowa',
    description: 'Kamica nerkowa — nawodnienie 2.5-3L/d, ograniczenie sodu i oksalatów, cytrynian',
    priority: 68,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'kamica nerkowa', 'kamienie nerkowe', 'kidney stones', 'nephrolithiasis', 'urolithiasis', 'kamica', 'renal stones', 'kamica szczawianowa', 'kamica moczanowa', 'kamica wapniowa'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2300 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 8 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['szpinak', 'rabarbar', 'szczaw', 'burak', 'spinach', 'rhubarb', 'sorrel', 'beet', 'solone', 'salted', 'cola', 'napój gazowany', 'soda'] },
      { type: 'CLINICAL_NOTE', note: 'Kamica nerkowa: nawodnienie ≥2.5-3L/d (diureza >2L/d — najważniejsza interwencja!), sód <2300mg/d (natriureza zwiększa kalciurię), białko umiarkowane (0.8-1.0g/kg). Źródło: AUA/EAU 2022 Urolithiasis Guidelines', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Kamica szczawianowa (najczęstsza ~75%): ograniczenie oksalatów (szpinak, rabarbar, szczaw, burak, kakao, orzechy, herbata czarna). Wapń z dietą NIE ograniczać (1000-1200mg/d — wiąże oksalaty w jelicie). Źródło: EAU 2022', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Kamica moczanowa: alkalizacja moczu (owoce cytrusowe, warzywa), ograniczenie puryn (jak dna), nawodnienie. Kamica wapniowa: ograniczyć sód i białko zwierzęce, utrzymać wapń z dietą.', category: 'INFO' },
      { type: 'CLINICAL_NOTE', note: 'Owoce cytrusowe (cytryny, limonki, pomarańcze) — cytrynian hamuje krystalizację! Zalecać sok z 2 cytryn/dzień rozcieńczony w wodzie.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Cytrynian potasu', dose: '30-60 mEq/d (wg pH moczu)', reason: 'Alkalizacja moczu i hamowanie krystalizacji szczawianu wapnia (AUA 2022)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez', dose: '300-400 mg/d', reason: 'Inhibitor krystalizacji oksalatów, częsty niedobór' },
    ],
  },
  // 27.7.3 Zespół nerczycowy
  {
    id: 'nephrotic-syndrome',
    name: 'Zespół nerczycowy',
    description: 'Zespół nerczycowy — sód <2g, białko 0.8-1.0g/kg, RED FLAG HIGH',
    priority: 80,
    version: '1.0',
    conflictsWith: ['Przewlekła choroba nerek (CKD)'],
    condition: (ctx) => hasCondition(ctx, 'zespół nerczycowy', 'zespol nerczycowy', 'nephrotic syndrome', 'nephrotic', 'nerczycowy'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'SET', value: 0.8 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2000 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'saturatedFat', scope: 'DAILY_TOTAL', max: 20 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'cholesterol', scope: 'DAILY_TOTAL', max: 200 },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSodium', flagValue: true },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['solone', 'marynowane', 'konserwy', 'wędliny', 'parówka', 'kiełbasa', 'salted', 'pickled', 'canned', 'sausage', 'hot dog', 'fast food', 'chipsy', 'chips', 'pretzels', 'precle'] },
      { type: 'CLINICAL_NOTE', note: 'Zespół nerczycowy: białko 0.8-1.0g/kg/d (nie więcej — nasila białkomocz!), sód <2g/d (obrzęki), ograniczenie tłuszczów nasyconych i cholesterolu (częsta dyslipidemia wtórna). Energia adekwatna (35 kcal/kg/d). Źródło: KDIGO 2021 GN, ESPEN CKD 2021', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA: Proteinuria powoduje utratę albumin → obrzęki, utratę immunoglobulin → infekcje, utratę białek wiążących → niedobory (D3, żelazo, cynk). Monitorować poziom albumin i suplementować wg deficytów.', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Preferować białko roślinne (soja, rośliny strączkowe) — mniejszy wpływ na filtrację kłębuszkową niż białko zwierzęce. Źródło: KDIGO 2021', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d', reason: 'Utrata białka wiążącego wit. D z moczem → niedobór (KDIGO 2021)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '1-2 g/d', reason: 'Działanie nefroprotekcyjne i redukcja dyslipidemii' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo + kwas foliowy', dose: 'wg badań (ferrytyna, TIBC)', reason: 'Utrata transferyny z moczem → anemia niedoborowa' },
    ],
  },
];

// ─── Bone Disease Rules (27.9) ────────────────────────────────────────────────

const BONE_RULES: PolicyRule[] = [
  // 27.9.1 Osteoporoza
  {
    id: 'osteoporosis',
    name: 'Osteoporoza',
    description: 'Osteoporoza — Ca 1000-1200mg/d, D3 800-2000 IU/d, K2, białko 1.0-1.2g/kg',
    priority: 78,
    version: '1.0',
    conflictsWith: ['Przewlekła choroba nerek (CKD)'],
    condition: (ctx) => hasCondition(ctx, 'osteoporoza', 'osteoporosis', 'osteoporozy'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MAX', value: 1.0 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 1000, max: 1500 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2300 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'phosphorus', scope: 'DAILY_TOTAL', min: 700 },
      { type: 'PREFER_PRODUCTS', flagKey: 'highCalcium', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cola', 'pepsi', 'napój gazowany', 'soda', 'energy drink', 'napój energetyczny'] },
      { type: 'CLINICAL_NOTE', note: 'Osteoporoza: wapń 1000-1200mg/d (z diety — nabiał, sardynki z ościami, tofu z Ca, wody mineralne >150mg Ca/L). Białko 1.0-1.2g/kg/d (kluczowe dla masy kostnej!). Ograniczenie sodu <2300mg/d (natriureza zwiększa kalciurię). Ograniczenie kofeiny <400mg/d. Unikanie napojów gazowanych cola (fosforany). Źródło: IOF/ESCEO 2020, NOF Guidelines', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Białko jest NIEZBĘDNE dla zdrowia kości — nie ograniczać! Dieta bogata w owoce i warzywa (alkalizacja — zmniejsza utratę Ca z moczem). Witamina K1 (zielone warzywa liściaste) wspiera karboksylację osteokalcyny.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Alkohol >2 porcje/d zwiększa ryzyko złamań — zalecać umiarkowanie lub eliminację. Aktywność fizyczna z obciążeniem kluczowa (notatka dla dietetyka, nie dieta).', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '800-2000 IU/d', reason: 'Niezbędna dla wchłaniania wapnia i metabolizmu kostnego (IOF/ESCEO 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina K2 (MK-7)', dose: '100-200 µg/d', reason: 'Kieruje wapń do kości (karboksylacja osteokalcyny), synergia z D3' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez', dose: '300-400 mg/d', reason: 'Kofaktor metabolizmu D3 i mineralizacji kości, częsty niedobór' },
      {
        type: 'AGE_CONDITIONAL',
        ageRanges: [
          {
            minAge: 70,
            effects: [
              { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 1200, max: 1500 },
              { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d', reason: 'Osoby 70+ wymagają wyższych dawek D3 (IOF, Endocrine Society 2024)' },
              { type: 'CLINICAL_NOTE', note: 'Pacjent 70+ z osteoporozą: Ca 1200mg/d, D3 2000-4000 IU/d. Uwaga na ryzyko upadków — dieta bogata w białko i D3 zmniejsza ryzyko sarkopenii.', category: 'WARNING' },
            ],
          },
        ],
      },
    ],
  },
  // 27.9.2 Osteopenia
  {
    id: 'osteopenia',
    name: 'Osteopenia',
    description: 'Osteopenia — Ca 1000mg/d, D3 800-1000 IU/d, profilaktyka osteoporozy',
    priority: 65,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'osteopenia', 'osteopenii'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 1000, max: 1500 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2300 },
      { type: 'PREFER_PRODUCTS', flagKey: 'highCalcium', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Osteopenia (T-score -1.0 do -2.5): wapń 1000mg/d z diety, D3 800-1000 IU/d, białko adekwatne (1.0g/kg). Dieta bogata w nabiał, ryby z ościami, rośliny strączkowe, orzechy. Ograniczenie sodu <2300mg i kofeiny <400mg/d. Źródło: IOF/ESCEO 2020', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Osteopenia to stadium przedosteoporotyczne — interwencja dietetyczna może zahamować progresję. Regularna ocena gęstości kości (DEXA) co 1-2 lata.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '800-1000 IU/d', reason: 'Profilaktyka osteoporozy, wsparcie wchłaniania wapnia (IOF/ESCEO 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina K2 (MK-7)', dose: '100 µg/d', reason: 'Wsparcie mineralizacji kości, synergia z D3' },
    ],
  },
  // 27.9.3 Krzywica
  {
    id: 'rickets',
    name: 'Krzywica',
    description: 'Krzywica — D3 400-1000 IU/d (zależnie od wieku), Ca dostosowany do wieku',
    priority: 75,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'krzywica', 'rickets', 'rachitis', 'rachityzm'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 500 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'phosphorus', scope: 'DAILY_TOTAL', min: 500 },
      { type: 'PREFER_PRODUCTS', flagKey: 'highCalcium', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Krzywica: kluczowa suplementacja witaminy D3 i wapnia. Dieta bogata w nabiał, jaja, ryby tłuste (łosoś, makrela, sardynki). Ekspozycja słoneczna 15-20 min/d (kwiecień-wrzesień w PL, bez filtru UV na ramiona/nogi). Źródło: ESPGHAN 2022, Global Consensus on Rickets 2016', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Fosfor z diety (nabiał, mięso, ryby, jaja) — ważny dla mineralizacji kości. Unikać nadmiaru fitynianów (zboża nienamoczone) — mogą wiązać Ca i P w jelicie.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Krzywica wymaga diagnostyki przyczynowej: niedobór D3 (najczęstsza), hipofosfatemia, oporność na D3. Plan dietetyczny jest wsparciem — leczenie przyczynowe u pediatry.', category: 'WARNING' },
      {
        type: 'AGE_CONDITIONAL',
        ageRanges: [
          {
            maxAge: 1,
            effects: [
              { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '400 IU/d', reason: 'Niemowlęta <1 r.ż.: 400 IU/d od urodzenia (ESPGHAN 2022, Global Consensus 2016)' },
            ],
          },
          {
            minAge: 1,
            maxAge: 10,
            effects: [
              { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '600-1000 IU/d', reason: 'Dzieci 1-10 lat z krzywicą: 600-1000 IU/d (ESPGHAN 2022)' },
              { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 700, max: 1300 },
            ],
          },
          {
            minAge: 10,
            maxAge: 18,
            effects: [
              { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '800-2000 IU/d', reason: 'Młodzież 10-18 lat z krzywicą: 800-2000 IU/d, okres intensywnego wzrostu (ESPGHAN 2022)' },
              { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 1000, max: 1500 },
            ],
          },
        ],
      },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Wapń', dose: 'wg wieku (500-1300 mg/d)', reason: 'Wsparcie mineralizacji kości, dawkowanie zależne od wieku (Global Consensus 2016)' },
    ],
  },
];

// ─── Oncology Rules (27.10) ──────────────────────────────────────────────────

const ONCOLOGY_RULES: PolicyRule[] = [
  // 27.10.1 Nowotwór jelita grubego
  {
    id: 'colorectal-cancer',
    name: 'Nowotwór jelita grubego',
    description: 'Nowotwór jelita grubego — białko 1.2-1.5g/kg, lekkostrawna, antyoksydanty, RED FLAG HIGH',
    priority: 85,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'nowotwór jelita grubego', 'rak jelita grubego', 'rak okrężnicy', 'rak odbytnicy', 'colorectal cancer', 'colon cancer', 'rectal cancer', 'rak jelita', 'nowotwór okrężnicy', 'nowotwór odbytnicy', 'CRC'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MAX', value: 1.2 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 10, max: 20 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['czerwone mięso', 'wołowina', 'wieprzowina', 'baranina', 'kiełbasa', 'parówka', 'boczek', 'salami', 'kabanos', 'szynka', 'wędlina', 'hot dog', 'red meat', 'beef', 'pork', 'lamb', 'sausage', 'bacon', 'ham', 'processed meat', 'alkohol', 'piwo', 'wino', 'wódka', 'alcohol', 'beer', 'wine'] },
      { type: 'PREFER_PRODUCTS', flagKey: 'highProtein', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Nowotwór jelita grubego: białko 1.2-1.5g/kg/d (zapobieganie kacheksji nowotworowej!). Energia 25-30 kcal/kg/d. Dieta lekkostrawna, błonnik rozpuszczalny 10-20g/d (nie drażniący — owsianka, pektyny, guar). Małe częste porcje (5-6/d). Źródło: ESPEN Oncology 2021', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'ELIMINACJA: czerwone mięso i przetworzone mięso (klasa 1 kancerogenów wg IARC), alkohol (klasa 1), smażone/grillowane w wysokiej temp. (HCA, PAH). WCRF/AICR: <500g czerwonego mięsa/tyg, 0g przetworzonego.', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'ZALECANE: warzywa krzyżowe (brokuły, kalafior, kapusta — sulforafan), owoce jagodowe (antyoksydanty), ryby (omega-3 — działanie przeciwzapalne), oliwa z oliwek, orzechy. Dieta śródziemnomorska jako model. Źródło: WCRF/AICR 2018', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA: Suplementy antyoksydacyjne NIE zalecane w trakcie chemio-/radioterapii (mogą osłabić skuteczność leczenia!). Antyoksydanty wyłącznie z diety. Decyzja o suplementacji tylko z onkologiem. Źródło: ESPEN 2021', category: 'WARNING' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '1-2 g/d', reason: 'Działanie przeciwzapalne, wsparcie masy mięśniowej, zmniejszenie ryzyka kacheksji (ESPEN Oncology 2021)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '1000-2000 IU/d', reason: 'Częsty niedobór u pacjentów onkologicznych, sugerowane działanie ochronne (WCRF)' },
    ],
  },
  // 27.10.2 Nowotwór żołądka
  {
    id: 'gastric-cancer',
    name: 'Nowotwór żołądka',
    description: 'Nowotwór żołądka — małe częste posiłki 6-8/d, lekkostrawna, B12/Fe po resekcji',
    priority: 85,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'nowotwór żołądka', 'rak żołądka', 'gastric cancer', 'stomach cancer', 'gastrektomia', 'gastrectomy'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MAX', value: 1.2 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['ostre przyprawy', 'chili', 'pieprz cayenne', 'tabasco', 'wasabi', 'smażone', 'fried', 'deep fried', 'napoje gazowane', 'soda', 'cola', 'alkohol', 'piwo', 'wino', 'wódka', 'alcohol'] },
      { type: 'PREFER_PRODUCTS', flagKey: 'highProtein', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Nowotwór żołądka: małe bardzo częste posiłki (6-8/d, porcje 150-250ml). Energia 30-35 kcal/kg/d, białko 1.2-1.5g/kg/d. Dieta lekkostrawna, unikanie potraw ostrych, smażonych, gazowanych. Jedzenie wolno, dokładne żucie. Źródło: ESPEN Oncology 2021', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'PO RESEKCJI ŻOŁĄDKA — dumping syndrome: unikać prostych cukrów i słodkich napojów, NIE pić podczas posiłku (30 min przed lub po), położyć się na 15-30 min po jedzeniu. Wczesny dumping (15-30 min po jedzeniu): nudności, biegunka, skurcze. Późny dumping (1-3h): hipoglikemia reaktywna.', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Po gastrektomii totalnej: OBOWIĄZKOWA suplementacja B12 (im. co 3 mies. lub 1000µg/d sublingual), żelazo (upośledzone wchłanianie — forma chelatowa), Ca+D3 (zmniejszone wchłanianie). Monitoring co 3-6 mies. Źródło: ESPEN 2021', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12', dose: '1000 µg/d sublingual lub im. co 3 mies.', reason: 'Brak czynnika wewnętrznego po gastrektomii → bezwzględna konieczność suplementacji (ESPEN 2021)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo (chelatowe)', dose: '30-60 mg/d (wg ferrytyny)', reason: 'Upośledzone wchłanianie żelaza po resekcji żołądka (brak kw. solnego)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Wapń + Witamina D3', dose: 'Ca 1000-1200 mg/d + D3 2000 IU/d', reason: 'Zmniejszone wchłanianie wapnia po gastrektomii, profilaktyka osteoporozy metabolicznej' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Enzymy trawienne', dose: 'wg potrzeb (przy biegunkach tłuszczowych)', reason: 'Upośledzone trawienie po resekcji żołądka — rozważyć przy steatorei' },
    ],
  },
  // 27.10.3 Nowotwór trzustki
  {
    id: 'pancreatic-cancer',
    name: 'Nowotwór trzustki',
    description: 'Nowotwór trzustki — PERT, tłuszcze MCT, wysoka energia, ADEK, RED FLAG HIGH',
    priority: 88,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'nowotwór trzustki', 'rak trzustki', 'pancreatic cancer', 'guz trzustki', 'pancreatectomy', 'pankreatektomia'),
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MAX', value: 1.2 },
      { type: 'MODIFY_TARGETS', field: 'targetKcal', operation: 'MULTIPLY', value: 1.1 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fat', scope: 'PER_100G', max: 15 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['smażone', 'panierowane', 'fried', 'deep fried', 'fast food', 'tłuste mięso', 'boczek', 'smalec', 'masło klarowane', 'alkohol', 'piwo', 'wino', 'wódka'] },
      { type: 'PREFER_PRODUCTS', flagKey: 'highProtein', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Nowotwór trzustki: wysoka energia 30-35 kcal/kg/d (kacheksja bardzo częsta!), białko 1.2-1.5g/kg/d. Małe częste posiłki (6-8/d). Tłuszcze MCT preferowane (olej kokosowy, MCT oil) — wchłanianie bez lipazy trzustkowej. Ograniczenie dużych porcji tłuszczu konwencjonalnego (<15g na posiłek). Źródło: ESPEN Oncology 2021, NICE Pancreatic Cancer 2024', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'PERT (Pancreatic Enzyme Replacement Therapy) — enzymy trzustkowe OBOWIĄZKOWE przy niewydolności egzokrynnej (steatorea, biegunki tłuszczowe, wzdęcia). Dawkowanie: 25000-75000j lipazy na posiłek, 10000-25000j na przekąskę. Przyjmować Z jedzeniem (nie przed, nie po). Notatka kliniczna dla dietetyka — skierować do gastroenterologa.', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Witaminy rozpuszczalne w tłuszczach (ADEK) — częste niedobory przy niewydolności trzustki. Monitorować poziomy 25(OH)D, retinol, tokoferol, INR. Rozważyć formę wodną witamin. Źródło: NICE Pancreatic Cancer 2024', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Ryzyko cukrzycy trzustkowej (typ 3c) — monitorować glikemię. Dieta niskoglikemiczna, unikać prostych cukrów. Insulinoterapia może być konieczna — koordynacja z diabetologiem.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d', reason: 'Upośledzone wchłanianie tłuszczów → niedobór wit. rozpuszczalnych w tłuszczach (NICE 2024)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina A (retinol)', dose: '2500-5000 IU/d (wg poziomu retinolu)', reason: 'Niedobór przy niewydolności egzokrynnej trzustki' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina E (tokoferol)', dose: '200-400 IU/d', reason: 'Niedobór przy malabsorpcji tłuszczów' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina K', dose: '100-200 µg/d (monitorować INR)', reason: 'Niedobór przy niewydolności egzokrynnej — ryzyko zaburzeń krzepnięcia' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12', dose: '1000 µg/d', reason: 'Upośledzone wchłanianie (szczególnie po pankreatektomii)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo', dose: '30-60 mg/d (wg ferrytyny)', reason: 'Częsty niedobór przy nowotworach trzustki (anemia wieloczynnikowa)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '2 g/d EPA', reason: 'Hamowanie kacheksji nowotworowej, działanie przeciwzapalne (ESPEN Oncology 2021)' },
    ],
  },
];

// ─── Nutritional Deficiency Rules (27.11) ────────────────────────────────────

const DEFICIENCY_RULES: PolicyRule[] = [
  // 27.11.1 Niedokrwistość z niedoboru żelaza
  {
    id: 'iron-deficiency-anemia',
    name: 'Niedokrwistość z niedoboru żelaza',
    description: 'Niedokrwistość sideropeniczna — żelazo hemowe, wit. C, unikanie tanin',
    priority: 72,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'niedokrwistość', 'anemia', 'niedobór żelaza', 'iron deficiency', 'sideropeniczna', 'niedobor zelaza', 'niedokrwistosc'),
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'highIron', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['herbata czarna', 'kawa', 'black tea', 'coffee'] },
      { type: 'CLINICAL_NOTE', note: 'Niedokrwistość z niedoboru żelaza: preferencja żelaza hemowego (czerwone mięso 2-3x/tyg, wątróbka 1x/tyg, małże, ostrygi). Żelazo niehemowe (szpinak, soczewica, tofu) łączyć z witaminą C (papryka, cytrusy, kiwi) — zwiększa wchłanianie 2-6x. Źródło: BSG Iron Deficiency 2021', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'UNIKAĆ 1h przed i po posiłku bogatym w żelazo: taniny (herbata, kawa), fityniany (otręby), wapń (nabiał), szczawiany (rabarbar). Gotowanie w żeliwnym garnku zwiększa zawartość Fe w potrawach. Źródło: WHO Iron Deficiency', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'ZALECANE produkty bogate w żelazo: wątróbka drobiowa (9mg/100g), kaszanka, czerwone mięso, małże, soczewica, ciecierzyca, szpinak gotowany, burak, pestki dyni, amarant. Cel: Fe z diety 15-20mg/d (kobiety miesiączkujące: 18mg/d).', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo (dwuwartościowe — fumaran/glukonian)', dose: '30-60 mg/d elementarnego Fe (na czczo z wit. C)', reason: 'Leczenie niedoboru żelaza — forma dwuwartościowa najlepiej wchłaniana. Monitoring ferrytyny co 3 mies. (BSG 2021)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina C', dose: '200-500 mg/d (przy posiłkach z Fe)', reason: 'Zwiększa wchłanianie żelaza niehemowego 2-6x (redukcja Fe³⁺ → Fe²⁺)' },
    ],
  },
  // 27.11.2 Niedokrwistość z niedoboru B12
  {
    id: 'b12-deficiency',
    name: 'Niedokrwistość z niedoboru B12',
    description: 'Niedobór witaminy B12 — produkty odzwierzęce, suplementacja, uwaga weganie',
    priority: 72,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'niedobór b12', 'niedobor b12', 'niedobór witaminy b12', 'b12 deficiency', 'niedokrwistość megaloblastyczna', 'niedokrwistość złośliwa', 'niedokrwistosc megaloblastyczna', 'pernicious anemia'),
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Niedobór witaminy B12: preferencja produktów odzwierzęcych — wątróbka wołowa (60µg/100g!), wątróbka drobiowa (16µg/100g), małże (84µg/100g), sardynki, łosoś, wołowina, jaja, nabiał. Dzienne zapotrzebowanie: 2.4µg/d (4µg w ciąży). Źródło: BSG B12 Guidelines 2014', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Dieta wegańska/wegetariańska → OBLIGATORYJNA suplementacja B12 (brak źródeł roślinnych!). Spirulina i algi NIE są wiarygodnym źródłem B12 (analogi, nie aktywna forma). Produkty fortyfikowane (mleko roślinne, płatki) mogą uzupełniać, ale nie zastąpią suplementacji. Źródło: NICE 2024', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Przyczyny złego wchłaniania B12: gastritis atroficzny, metformina, IPP (omeprazol), celiakia, choroba Crohna, resekcja żołądka/jelita krętego. Przy złym wchłanianiu → forma sublingual 1000µg/d lub iniekcje im. co 3 mies.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12 (metylokobalamina)', dose: '1000 µg/d sublingual lub 2x/tyg', reason: 'Leczenie niedoboru B12. Forma sublingual omija barierę wchłaniania żołądkowego. Monitoring co 3-6 mies. (BSG 2014, NICE 2024)' },
    ],
  },
  // 27.11.3 Niedobór kwasu foliowego
  {
    id: 'folate-deficiency',
    name: 'Niedobór kwasu foliowego',
    description: 'Niedobór folianów — zielone warzywa, strączkowe, suplementacja, uwaga na maskowanie B12',
    priority: 68,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'niedobór kwasu foliowego', 'niedobor kwasu foliowego', 'niedobór folianów', 'folate deficiency', 'folic acid deficiency', 'niedobor folianow'),
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Niedobór kwasu foliowego: preferencja zielonych warzyw liściastych (szpinak 194µg/100g, jarmuż, sałata rzymska, brokuły), rośliny strączkowe (soczewica 181µg/100g, ciecierzyca, fasola), pełnoziarniste, wątróbka drobiowa (560µg/100g!), jaja, orzechy. Dzienne zapotrzebowanie: 400µg/d (800µg w ciąży). Źródło: WHO, EFSA', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA — kwas foliowy może MASKOWAĆ niedobór B12 (koryguje anemię megaloblastyczną, ale nie zapobiega neuropatii!). ZAWSZE sprawdzić poziom B12 przed/równolegle z suplementacją folianów. Źródło: NICE, WHO', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Kwas foliowy jest termolabilny — krótkie gotowanie, gotowanie na parze, surowe warzywa zachowują więcej folianów. Unikać długiego gotowania/podgrzewania. Fortyfikowane produkty (płatki śniadaniowe, mąka) mogą uzupełniać dietę.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Kwas foliowy (5-MTHF lub kwas foliowy)', dose: '400 µg/d (800 µg w ciąży, 5 mg/d przy ciężkim niedoborze)', reason: 'Uzupełnienie niedoboru folianów. Forma 5-MTHF preferowana u osób z polimorfizmem MTHFR. (WHO, NICE)' },
    ],
  },
  // 27.11.4 Niedobór jodu
  {
    id: 'iodine-deficiency',
    name: 'Niedobór jodu',
    description: 'Niedobór jodu — ryby morskie, sól jodowana, nabiał, uwaga przy Hashimoto',
    priority: 65,
    version: '1.0',
    conflictsWith: ['hashimoto'],
    condition: (ctx) => hasCondition(ctx, 'niedobór jodu', 'niedobor jodu', 'iodine deficiency', 'niedobor jodu'),
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Niedobór jodu: ryby morskie 2-3x/tyg (dorsz 110µg/100g, mintaj, łosoś), sól jodowana (zamiast zwykłej — 1g = ~25µg jodu), nabiał (mleko 20-40µg/100ml), jaja (52µg/jajko), wodorosty morskie (ostrożnie — bardzo zmienna zawartość!). Dzienne zapotrzebowanie: 150µg/d (250µg w ciąży). Źródło: WHO/UNICEF/ICCIDD, ETA', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA przy Hashimoto: nadmiar jodu może nasilić autoagresję tarczycową! Umiarkowana podaż (nie >300µg/d). NIE stosować suplementów z kelpu/fucusu (ekstremalnie wysoki jod). Konsultacja z endokrynologiem. Źródło: ETA 2023', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Polska jest krajem z historycznie endemicznym niedoborem jodu. Od 1997 r. obowiązkowe jodowanie soli kuchennej (30mg KI/kg). Mimo to, kobiety w ciąży i karmiące często wymagają dodatkowej suplementacji.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Jod (jodek potasu)', dose: '150 µg/d (250 µg/d w ciąży i laktacji)', reason: 'Uzupełnienie niedoboru jodu. WHO/UNICEF zaleca suplementację w populacjach z niedoborem. Monitoring TSH co 6-12 mies.' },
    ],
  },
  // 27.11.5 Niedobór wapnia
  {
    id: 'calcium-deficiency',
    name: 'Niedobór wapnia',
    description: 'Niedobór wapnia — nabiał, sardynki, tofu, wody mineralne, D3 konieczna',
    priority: 68,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'niedobór wapnia', 'niedobor wapnia', 'calcium deficiency', 'hipokalcemia', 'hypocalcemia'),
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 1000 },
      { type: 'CLINICAL_NOTE', note: 'Niedobór wapnia: najlepsze źródła z diety — nabiał (mleko 120mg/100ml, jogurt, kefir, ser żółty 700-900mg/100g, twaróg), sardynki z ościami (380mg/100g), tofu z Ca (350mg/100g), migdały (264mg/100g), sezam (975mg/100g!), brokuły, jarmuż. Wody mineralne bogate w Ca (>150mg/L). Źródło: IOF, EFSA 2015', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'D3 KONIECZNA dla wchłaniania wapnia! Bez D3 wchłania się tylko 10-15% Ca z diety (z D3 → 30-40%). Nie łączyć Ca z żelazem (konkurencja o wchłanianie). Fityniany i szczawiany zmniejszają biodostępność Ca.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Wapń (cytrynian wapnia)', dose: '500-1000 mg/d (w 2 dawkach podzielonych, max 500mg jednorazowo)', reason: 'Uzupełnienie niedoboru wapnia. Cytrynian preferowany (lepsze wchłanianie niezależnie od kwasowości żołądka). IOF, EFSA 2015' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '1000-2000 IU/d', reason: 'Niezbędna dla wchłaniania wapnia z przewodu pokarmowego. Monitoring 25(OH)D.' },
      {
        type: 'AGE_CONDITIONAL',
        ageRanges: [
          {
            maxAge: 18,
            effects: [
              { type: 'CLINICAL_NOTE', note: 'Dzieci/młodzież: zapotrzebowanie na Ca 800-1300mg/d (zależnie od wieku). Nabiał jako podstawa. Źródło: EFSA 2015', category: 'INFO' },
            ],
          },
          {
            minAge: 50,
            effects: [
              { type: 'CLINICAL_NOTE', note: 'Osoby >50 lat: zapotrzebowanie na Ca wzrasta do 1200mg/d. Rozważyć dodanie K2 (MK-7) dla lepszego wbudowania Ca w kości. Źródło: IOF/ESCEO 2020', category: 'RECOMMENDATION' },
              { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina K2 (MK-7)', dose: '100-200 µg/d', reason: 'Kieruje wapń do kości zamiast do naczyń. Synergistycznie z D3 i Ca. (IOF/ESCEO 2020)' },
            ],
          },
        ],
      },
    ],
  },
  // 27.11.6 Niedobór witaminy D
  {
    id: 'vitamin-d-deficiency',
    name: 'Niedobór witaminy D',
    description: 'Niedobór witaminy D — ryby tłuste, suplementacja, ekspozycja słoneczna',
    priority: 70,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'niedobór witaminy d', 'niedobor witaminy d', 'vitamin d deficiency', 'niedobór d3', 'niedobor d3', 'hipowitaminoza d'),
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Niedobór witaminy D: preferencja ryb tłustych (łosoś dziki 600-1000 IU/100g, makrela 350 IU/100g, śledź 290 IU/100g, sardynki), żółtka jaj (40 IU/żółtko), grzyby traktowane UV (maitake, shiitake), produkty fortyfikowane (mleko, margaryna, płatki). Źródło: Endocrine Society 2024', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Ekspozycja słoneczna: 15-20 min/d z odsłoniętymi przedramionami (kwiecień-wrzesień w Polsce, godz. 10-15). W okresie X-III w Polsce synteza skórna D3 jest NIEMOŻLIWA (kąt padania UV-B zbyt niski). Suplementacja zimowa obowiązkowa dla WSZYSTKICH. Źródło: Polskie rekomendacje wit. D 2023', category: 'INFO' },
      { type: 'CLINICAL_NOTE', note: 'Dawkowanie zależne od poziomu 25(OH)D: <10ng/ml (ciężki niedobór): 4000-10000 IU/d przez 8 tyg. → następnie podtrzymująco; 10-20ng/ml: 2000-4000 IU/d; 20-30ng/ml: 1000-2000 IU/d. Cel: 30-50ng/ml (75-125 nmol/L). Monitoring co 3-6 mies. Źródło: Endocrine Society 2024', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3 (cholekalcyferol)', dose: '2000-4000 IU/d (dawka zależna od poziomu 25(OH)D)', reason: 'Leczenie i profilaktyka niedoboru witaminy D. Forma D3 2-3x skuteczniejsza od D2. Przyjmować z posiłkiem tłuszczowym. (Endocrine Society 2024, Polskie rekomendacje 2023)' },
      {
        type: 'AGE_CONDITIONAL',
        ageRanges: [
          {
            minAge: 70,
            effects: [
              { type: 'CLINICAL_NOTE', note: 'Osoby >70 lat: synteza skórna D3 zmniejszona o 75%! Suplementacja 2000-4000 IU/d OBOWIĄZKOWA przez cały rok. Cel 25(OH)D: 30-50ng/ml. Źródło: Endocrine Society 2024', category: 'WARNING' },
              { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d (całorocznie!)', reason: 'Osoby >70 lat: zmniejszona synteza skórna, wyższe ryzyko osteoporozy i upadków' },
            ],
          },
        ],
      },
    ],
  },
];

// ─── Eating Disorders & Bariatric Rules (26.12) ──────────────────────────────

const EATING_DISORDER_RULES: PolicyRule[] = [
  // 26.12.1 Anorexia nervosa — CRITICAL
  {
    id: 'anorexia-nervosa',
    name: 'Anoreksja nervosa',
    description: 'Jadłowstręt psychiczny — CRITICAL, blokada auto-generowania, wymaga zespołu terapeutycznego (NICE 2020, APA 2023)',
    priority: 95,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'anoreksj', 'anorexia', 'jadłowstręt'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'ANOREKSJA NERVOSA — KRYTYCZNE: Plan żywieniowy MUSI być tworzony wyłącznie pod nadzorem zespołu terapeutycznego (psychiatra + psycholog + dietetyk kliniczny). Auto-generowanie WSTRZYMANE. Źródło: NICE NG69 (2020), APA Practice Guidelines (2023)',
        category: 'WARNING',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Refeeding syndrome: przy wznowieniu żywienia stopniowe zwiększanie energii (10-20 kcal/kg/d na start, max +200 kcal co 2-3 dni). Monitorowanie elektrolitów (fosfor!, magnez, potas) co 24-48h w pierwszym tygodniu. Tiamina (B1) 200-300mg/d profilaktycznie PRZED rozpoczęciem żywienia. Źródło: NICE CG32, MARSIPAN Guidelines 2014',
        category: 'RESTRICTION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Cel energetyczny: indywidualny, ustalany przez zespół. Typowo start 1200-1500 kcal/d ze stopniowym wzrostem do pełnego zapotrzebowania. NIE stosować diety redukcyjnej. NIE liczyć kalorii przy pacjencie. Regularność posiłków (3+2-3) ważniejsza niż skład.',
        category: 'RECOMMENDATION',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Tiamina (witamina B1)',
        dose: '200-300 mg/d (profilaktyka refeeding syndrome)',
        reason: 'Zapobiega encefalopatii Wernickego przy wznawianiu żywienia. Podawać PRZED rozpoczęciem realimentacji. (NICE CG32)',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Multiwitamina + składniki mineralne',
        dose: 'Wg zaleceń lekarza',
        reason: 'Niedobory wieloelementowe typowe w anoreksji: Fe, Zn, D3, Ca, B12, kwas foliowy. Suplementacja pod kontrolą badań laboratoryjnych.',
      },
    ],
  },

  // 26.12.2 Bulimia nervosa — CRITICAL
  {
    id: 'bulimia-nervosa',
    name: 'Bulimia nervosa',
    description: 'Żarłoczność psychiczna — CRITICAL, blokada auto-generowania, normalizacja wzorca jedzenia (NICE 2020, APA 2023)',
    priority: 95,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'bulimi', 'bulimia', 'żarłoczność psychiczna'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'BULIMIA NERVOSA — KRYTYCZNE: Plan żywieniowy MUSI być tworzony wyłącznie pod nadzorem zespołu terapeutycznego (psychiatra/psycholog + dietetyk kliniczny). Auto-generowanie WSTRZYMANE. Źródło: NICE NG69 (2020), APA Practice Guidelines (2023)',
        category: 'WARNING',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Cel: normalizacja wzorca jedzenia — regularne posiłki 3 główne + 2-3 planowane przekąski, co 3-4h. Eliminacja cyklów restrykcja→objadanie się→przeczyszczanie. NIE stosować diet restrykcyjnych (wyzwalają epizody). NIE kategoryzować jedzenia na "dobre/złe".',
        category: 'RECOMMENDATION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Powikłania somatyczne do monitorowania: hipokaliemia (wymioty/diuretyki!), erozja szkliwa, powiększenie ślinianek, zaburzenia elektrolitowe, zapalenie przełyku (zespół Mallory-Weissa). Badania: elektrolity, amylaza, EKG.',
        category: 'INFO',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Dieta adekwatna energetycznie (NIE redukcyjna!), zbilansowana, bez wykluczeń pokarmowych (chyba że medycznie uzasadnione). Posiłki zróżnicowane, włączanie "lękowych" pokarmów stopniowo pod opieką terapeuty.',
        category: 'RESTRICTION',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Potas (KCl)',
        dose: 'Wg badań laboratoryjnych',
        reason: 'Hipokaliemia częsta przy wymiotach/nadużywaniu środków przeczyszczających. Monitorować K+ regularnie. Suplementacja TYLKO pod kontrolą lekarza.',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Multiwitamina + składniki mineralne',
        dose: 'Wg zaleceń lekarza',
        reason: 'Niedobory wtórne do zaburzeń wchłaniania i przeczyszczania: Mg, Zn, Fe, D3, B-complex. Kontrola laboratoryjna.',
      },
    ],
  },

  // 26.12.3 BED (Binge Eating Disorder) — HIGH
  {
    id: 'binge-eating-disorder',
    name: 'Kompulsywne objadanie się (BED)',
    description: 'Zespół kompulsywnego objadania się — wymaga przeglądu dietetyka, mindful eating, regularne posiłki (NICE 2020, APA 2023)',
    priority: 75,
    version: '1.0',
    condition: (ctx) => hasCondition(ctx, 'kompulsywne objadanie', 'binge eating', 'bed ', 'zaburzenia odżywiania typu bed', 'objadanie się kompulsywne'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'BED (kompulsywne objadanie się): Plan wymaga weryfikacji przez dietetyka klinicznego. Współpraca z psychologiem/psychoterapeutą jest kluczowa (CBT-E jako I linia leczenia). Źródło: NICE NG69 (2020), APA Practice Guidelines (2023)',
        category: 'WARNING',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Regularne posiłki: 3 główne + 2-3 zaplanowane przekąski, co 3-4h. NIE pomijać posiłków (głód wyzwala epizody). NIE stosować restrykcyjnych diet (dieta <1200 kcal pogarsza BED). Adekwatna podaż energii wg zapotrzebowania.',
        category: 'RECOMMENDATION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Mindful eating: jedzenie powoli, bez ekranów, skupienie na sygnałach głodu/sytości. Unikanie kategoryzowania jedzenia na "dobre/złe" lub "dozwolone/zakazane". Akceptacja wszystkich grup pokarmowych w planie.',
        category: 'RECOMMENDATION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Jeśli współwystępuje otyłość: redukcja masy DOPIERO po stabilizacji wzorca jedzenia (brak epizodów objadania przez min. 3-6 mies.). Łagodny deficyt max 500 kcal/d. Cel: zdrowe nawyki, nie szybka utrata wagi.',
        category: 'RESTRICTION',
      },
      {
        type: 'PREFER_PRODUCTS',
        flagKey: 'highFiber',
        flagValue: true,
      },
    ],
  },

  // 26.12.4 Post-bariatric surgery — HIGH
  {
    id: 'post-bariatric-surgery',
    name: 'Pacjent po operacji bariatrycznej',
    description: 'Stan po bariatrii — zmienione wchłanianie, obowiązkowa suplementacja, fazy żywienia (ASMBS 2020, IFSO 2022)',
    priority: 80,
    version: '1.0',
    condition: (ctx) =>
      hasSurgery(ctx, 'bariatr', 'sleeve', 'bypass', 'roux-en-y', 'mini gastric', 'plication', 'band') ||
      hasCondition(ctx, 'po bariatrii', 'po operacji bariatrycznej', 'bariatric', 'po sleeve', 'po bypass'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'PACJENT PO BARIATRII: Plan wymaga weryfikacji przez dietetyka klinicznego. Zmienione wchłanianie składników odżywczych. Suplementacja OBOWIĄZKOWA dożywotnio. Źródło: ASMBS Clinical Practice Guidelines (2020), IFSO Guidelines (2022)',
        category: 'WARNING',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Wielkość porcji: 150-250 ml na posiłek (żołądek zmniejszony). Jedzenie WOLNE (20-30 min na posiłek), małe kęsy, dokładne żucie. Picie między posiłkami (NIE podczas! min. 30 min odstępu). Min. 1.5L płynów/d małymi łykami.',
        category: 'RESTRICTION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Białko priorytet: minimum 60-80g/d (optymalnie 1.0-1.5g/kg idealnej masy ciała). Białko na początku każdego posiłku. Źródła: chude mięso, ryby, jaja, nabiał, strączkowe (jeśli tolerowane). Rozważyć izolat białka serwatkowego jako uzupełnienie.',
        category: 'RECOMMENDATION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Fazy żywienia pooperacyjnego: <2 tyg. → płyny klarowne; 2-4 tyg. → płyny pełne (zupy krem, koktajle białkowe); 4-8 tyg. → papkowata/miękka; 8-12 tyg. → miękka stała; >12 tyg. → dieta stała z ograniczeniami. Postęp INDYWIDUALNY wg tolerancji.',
        category: 'INFO',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Unikać: cukry proste (dumping syndrome!), napoje gazowane (rozciągają żołądek), alkohol (szybsze wchłanianie, ryzyko uzależnienia), tłuste/smażone potrawy. Dumping syndrome: nudności, biegunka, zawroty głowy 15-30 min po posiłku bogatym w cukry.',
        category: 'RESTRICTION',
      },
      {
        type: 'NUTRIENT_LIMIT',
        nutrient: 'protein',
        scope: 'DAILY_TOTAL',
        min: 60,
      },
      {
        type: 'NUTRIENT_LIMIT',
        nutrient: 'sugar',
        scope: 'DAILY_TOTAL',
        max: 25,
      },
      {
        type: 'EXCLUDE_KEYWORDS',
        keywords: ['napój gazowany', 'cola', 'sprite', 'fanta', 'pepsi', 'energia drink', 'energy drink'],
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Witamina B12',
        dose: '1000 µg/d sublingual lub 1000 µg/mies. i.m.',
        reason: 'Obowiązkowa po bypass/sleeve — upośledzone wchłanianie (brak czynnika wewnętrznego). Niedobór u 30-70% pacjentów. (ASMBS 2020)',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Żelazo (dwuwartościowe) + witamina C',
        dose: '45-60 mg Fe/d elementarnego + 200 mg wit. C',
        reason: 'Niedobór Fe u 20-55% po bariatrii (bypass > sleeve). Przyjmować oddzielnie od Ca (min. 2h). Monitoring ferrytyny co 3-6 mies. (ASMBS 2020)',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Wapń (cytrynian wapnia)',
        dose: '1200-1500 mg/d w dawkach podzielonych (max 500mg jednorazowo)',
        reason: 'Cytrynian wapnia (NIE węglan — wymaga kwasu żołądkowego do wchłaniania). Razem z D3. Zapobiega osteoporozie pobariatrycznej. (ASMBS 2020, IFSO 2022)',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Witamina D3',
        dose: '3000-6000 IU/d (wg poziomu 25(OH)D)',
        reason: 'Niedobór u 50-80% pacjentów pobariatrycznych. Cel: 25(OH)D >30 ng/ml. Wyższe dawki niż populacja ogólna z powodu malabsorpcji. (ASMBS 2020)',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Kwas foliowy',
        dose: '400-800 µg/d',
        reason: 'Profilaktyka niedoboru, szczególnie u kobiet w wieku rozrodczym. (ASMBS 2020)',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Cynk',
        dose: '8-22 mg/d',
        reason: 'Niedobór u 30-50% po bariatrii. Objawia się: wypadanie włosów, problemy skórne, osłabiona odporność. (IFSO 2022)',
      },
    ],
  },
];

// ─── Drug Interaction Rules (26.13) ──────────────────────────────────────────

function hasMedication(ctx: PatientContext, ...terms: string[]): boolean {
  if (!ctx.medicationsList || ctx.medicationsList.length === 0) return false;
  const meds = ctx.medicationsList.map(m => m.toLowerCase());
  return terms.some(t => meds.some(m => m.includes(t)));
}

const DRUG_INTERACTION_RULES: PolicyRule[] = [
  // 26.13.1 Metformina — deplecja B12
  {
    id: 'drug-metformin',
    name: 'Interakcja: Metformina',
    description: 'Metformina — deplecja witaminy B12, monitoring co 6-12 mies. (ADA 2024, Cochrane Review)',
    priority: 70,
    version: '1.0',
    condition: (ctx) => hasMedication(ctx, 'metformin', 'metformina', 'glucophage', 'siofor', 'formetic', 'avamina'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'METFORMINA — interakcja: deplecja wit. B12 u 10-30% pacjentów (zaburzenie wchłaniania w jelicie krętym zależnego od Ca²⁺). Ryzyko rośnie z dawką i czasem (>4 lata). Monitoring B12 co 6-12 mies. OBOWIĄZKOWY. Źródło: ADA Standards of Care 2024, Cochrane Review',
        category: 'WARNING',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Dieta bogata w B12: wątróbka (60µg/100g), małże (84µg), sardynki, łosoś, wołowina, jaja, nabiał. Wegetarianie/weganie na metforminie → suplementacja B12 OBLIGATORYJNA.',
        category: 'RECOMMENDATION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Metformina a posiłki: przyjmować PODCZAS lub PO posiłku (↓ objawy GI). Dieta wysokobłonnikowa może spowolnić wchłanianie — przyjmować oddzielnie od dużych dawek błonnika.',
        category: 'INFO',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Witamina B12 (metylokobalamina)',
        dose: '1000 µg/d sublingual lub 2x/tydzień',
        reason: 'Profilaktyka deplecji B12 przez metforminę. Forma sublingual omija barierę jelitową. Monitoring B12 + MMA co 6-12 mies. (ADA 2024)',
      },
    ],
  },

  // 26.13.2 Statyny — CoQ10, grapefruit
  {
    id: 'drug-statins',
    name: 'Interakcja: Statyny',
    description: 'Statyny — rozważenie CoQ10, unikanie grapefruita przy atorwa-/simwastatynie (ESC, Mayo Clinic)',
    priority: 68,
    version: '1.0',
    condition: (ctx) => hasMedication(ctx, 'statyn', 'statin', 'atorwastatyn', 'atorvastatin', 'simwastatyn', 'simvastatin',
      'rosuwastatyn', 'rosuvastatin', 'prawastatyn', 'lowastatyn', 'fluwastatyn',
      'lipitor', 'sortis', 'crestor', 'roswera', 'zocor', 'vasilip'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'STATYNY — UNIKAĆ grapefruita i pomarańczy sewilskiej przy atorwastatynie/simwastatynie/lowastatynie (inhibitory CYP3A4, ↑ stężenie leku 2-15x, ryzyko miopatii/rabdomiolizy). Rosuwastatyna i prawastatyna — brak interakcji z grapefruitem. Źródło: ESC/EAS Guidelines, FDA Drug Safety',
        category: 'RESTRICTION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Statyny mogą ↓ endogenny CoQ10 (ubichinon) — szczególnie przy mialgiach (bóle mięśniowe u 5-29% pacjentów). Rozważyć suplementację CoQ10 jeśli objawy mięśniowe. Źródło: Mayo Clinic CoQ10 Systematic Review',
        category: 'INFO',
      },
      {
        type: 'EXCLUDE_KEYWORDS',
        keywords: ['grapefruit', 'grejpfrut', 'pomelo', 'pomarańcza sewilska'],
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Koenzym Q10 (ubichinon/ubichinol)',
        dose: '100-200 mg/d',
        reason: 'Rozważyć przy mialgiach statynowych. Statyny hamują szlak mewalonianowy → ↓ CoQ10. Ubichinol — lepsza biodostępność. (Mayo Clinic Review, ESC)',
      },
    ],
  },

  // 26.13.3 IPP (inhibitory pompy protonowej)
  {
    id: 'drug-ppi',
    name: 'Interakcja: IPP (omeprazol i inne)',
    description: 'IPP — deplecja Mg, B12, Ca przy długotrwałym stosowaniu >1 roku (ACG 2017, FDA)',
    priority: 65,
    version: '1.0',
    condition: (ctx) => hasMedication(ctx, 'omeprazol', 'omeprazole', 'pantoprazol', 'pantoprazole',
      'esomeprazol', 'esomeprazole', 'lansoprazol', 'lansoprazole', 'rabeprazol', 'rabeprazole', 'dexlansoprazol',
      'controloc', 'nolpaza', 'helicid', 'losec', 'nexium', 'emanera', 'polprazol'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'IPP (>1 roku stosowania): deplecja Mg (hipoMg u 1-2%), B12 (kwas żołądkowy potrzebny do uwolnienia B12 z białek), Ca (↑ ryzyko złamań biodra o 25-35%). Żelazo: ↓ wchłanianie niehemowego Fe. Źródło: ACG 2017, FDA Safety Communication',
        category: 'WARNING',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Wapń: preferować CYTRYNIAN wapnia (NIE węglan — wymaga kwasu do wchłaniania). Żelazo hemowe lepiej (mięso, wątróbka). Dieta bogata w Mg: orzechy, nasiona dyni (535mg/100g!), ciemna czekolada, szpinak, strączkowe.',
        category: 'RECOMMENDATION',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Magnez (cytrynian lub glicynian)',
        dose: '200-400 mg/d',
        reason: 'Profilaktyka hipoMg przy długotrwałym IPP. Glicynian — lepsza tolerancja GI. Monitoring Mg co 6-12 mies. (ACG 2017, FDA)',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Witamina B12',
        dose: '1000 µg/d sublingual',
        reason: 'IPP ↓ uwalnianie B12 z białek. Forma sublingual omija barierę żołądkową. Monitoring co 12 mies. (ACG 2017)',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Wapń (cytrynian wapnia)',
        dose: '500-1000 mg/d',
        reason: 'Cytrynian (NIE węglan!) — nie wymaga kwasu żołądkowego. Zapobiega osteoporozie przy długotrwałym IPP. (FDA)',
      },
    ],
  },

  // 26.13.4 Warfaryna / acenokumarol (VKA)
  {
    id: 'drug-vka-anticoagulants',
    name: 'Interakcja: Warfaryna / Acenokumarol (VKA)',
    description: 'Antykoagulanty VKA — STABILNA podaż witaminy K, nie eliminować zielonych warzyw (ACC/AHA 2022)',
    priority: 85,
    version: '1.0',
    condition: (ctx) => hasMedication(ctx, 'warfaryn', 'warfarin', 'coumadin', 'acenokumarol', 'acenocoumarol',
      'sintrom', 'syncumar', 'vka', 'antykoagulant'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'WARFARYNA/ACENOKUMAROL (VKA) — KLUCZOWE: utrzymywać STABILNĄ podaż wit. K z diety! NIE ELIMINOWAĆ zielonych warzyw (to mit!). Nagłe zmiany destabilizują INR. Codziennie PODOBNA ilość zielonych warzyw. Źródło: ACC/AHA 2022, ESC',
        category: 'RESTRICTION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Produkty bogate w wit. K (STAŁA ilość, nie eliminować!): szpinak (483µg/100g), jarmuż (817µg), brokuły (102µg), brukselka (177µg), sałata rzymska (103µg), natka pietruszki (1640µg!). Olej rzepakowy/sojowy zawiera wit. K.',
        category: 'INFO',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'UNIKAĆ: nagłych zmian dietetycznych (dieta sokowa, post, nowa dieta). Alkohol max 1-2 porcje/d. Żurawina: OGRANICZYĆ (inhibitor CYP2C9, ↑ działanie warfaryny). Suplementy z wit. K: ZAKAZANE bez lekarza. Zioła ryzykowne: czosnek, żeń-szeń, dziurawiec, miłorząb.',
        category: 'WARNING',
      },
      {
        type: 'EXCLUDE_KEYWORDS',
        keywords: ['suplement witaminy k', 'witamina k suplement'],
      },
    ],
  },

  // 26.13.5 Lewotyroksyna
  {
    id: 'drug-levothyroxine',
    name: 'Interakcja: Lewotyroksyna',
    description: 'Lewotyroksyna — 30-60 min przed śniadaniem, unikanie Ca/Fe/soi/kawy w ciągu 4h (ATA 2014, ETA)',
    priority: 72,
    version: '1.0',
    condition: (ctx) => hasMedication(ctx, 'lewotyroksyn', 'levothyroxin', 'l-tyroksyn', 'euthyrox', 'eltroxin',
      'letrox', 'eferox', 'synthroid', 'tirosint'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'LEWOTYROKSYNA — przyjmować 30-60 min PRZED śniadaniem na PUSTY żołądek (szklanka wody). Alternatywa: wieczorem, min. 3h po ostatnim posiłku. Źródło: ATA 2014, ETA',
        category: 'RESTRICTION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'W ciągu 4h od lewotyroksyny UNIKAĆ (↓ wchłanianie 20-70%): wapń (nabiał, suplementy Ca), żelazo (suplementy Fe, wątróbka), soja (mleko sojowe, tofu), kawa (↓ wchłanianie o 36%), duże dawki błonnika, antacida (Al/Mg).',
        category: 'RESTRICTION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Plan posiłków: Lek → 30-60 min → Śniadanie (bez soi, bez Ca) → Normalny dzień → Suplementy Ca/Fe w INNEJ porze (np. obiad/kolacja, min. 4h od leku). Notatka: "Uwzględniono interakcję z lewotyroksyną".',
        category: 'RECOMMENDATION',
      },
    ],
  },

  // 26.13.6 Diuretyki
  {
    id: 'drug-diuretics',
    name: 'Interakcja: Diuretyki',
    description: 'Diuretyki — tiazydowe/pętlowe: deplecja K/Mg; oszczędzające potas: OGRANICZYĆ potas (ESC HF 2023)',
    priority: 68,
    version: '1.0',
    condition: (ctx) => hasMedication(ctx, 'diuretyk', 'diuretic', 'hydrochlorotiazyd', 'hydrochlorothiazide',
      'indapamid', 'indapamide', 'furosemid', 'furosemide', 'torasemid', 'torasemide',
      'spironolakton', 'spironolactone', 'eplerenon', 'eplerenone', 'amiloryd', 'amiloride',
      'hypothiazid', 'diuresin', 'lasix', 'trifas', 'aldactone', 'inspra'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'DIURETYKI — typ determinuje dietę! TIAZYDOWE (hydrochlorotiazyd, indapamid) i PĘTLOWE (furosemid, torasemid): deplecja K i Mg → dieta BOGATA w K/Mg. OSZCZĘDZAJĄCE POTAS (spironolakton, eplerenon, amiloryd): ryzyko hiperkaliemii → OGRANICZYĆ potas! Jeśli typ nieznany → konsultacja z lekarzem. Źródło: ESC HF 2023',
        category: 'WARNING',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Deplecja K (tiazydowe/pętlowe): banany (358mg/100g), awokado (485mg), ziemniaki (379mg), szpinak, fasola, soczewica, suszone morele, woda kokosowa. Cel: 3500-4700 mg K/d.',
        category: 'RECOMMENDATION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Deplecja Mg (tiazydowe/pętlowe): migdały (270mg/100g), nasiona dyni (535mg!), ciemna czekolada, szpinak, strączkowe. HipoMg pogłębia hipoK (Mg potrzebny do retencji K).',
        category: 'RECOMMENDATION',
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'Ograniczenie K (spironolakton/eplerenon): UNIKAĆ dużych ilości bananów, suszonych owoców, soków pomidorowych, zamienników soli (KCl!), awokado. Max 2000-2500 mg K/d. Monitoring K+ co 1-3 mies.',
        category: 'RESTRICTION',
      },
      {
        type: 'SUGGEST_SUPPLEMENT',
        name: 'Magnez (cytrynian lub glicynian)',
        dose: '200-400 mg/d',
        reason: 'Przy diuretykach tiazydowych/pętlowych: deplecja Mg częsta. NIE suplementować przy oszczędzających potas bez kontroli. (ESC HF 2023)',
      },
    ],
  },
  // 83.2.1 ACE inhibitory / ARB — hiperkaliemia
  {
    id: 'drug-ace-arb',
    name: 'Interakcja: ACE-inhibitory / ARB',
    description: 'ACE/ARB — ryzyko hiperkaliemii, ograniczyć potas (ESC HF 2023, ACC/AHA)',
    priority: 75,
    version: '1.0',
    condition: (ctx) => hasMedication(ctx, 'enalapril', 'enarenal', 'ramipril', 'tritace', 'polpril',
      'lisinopril', 'lisiprol', 'perindopril', 'prestarium', 'noliprel',
      'captopril', 'trandolapril', 'quinapril', 'accupril',
      'losartan', 'lozap', 'lorista', 'valsartan', 'diovan', 'valsacor',
      'telmisartan', 'micardis', 'telpres', 'irbesartan', 'aprovel',
      'candesartan', 'atacand', 'olmesartan', 'olmetec',
      'ace inhibitor', 'inhibitor ace', 'arb', 'sartan'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'ACE-INHIBITOR / ARB — ryzyko hiperkaliemii (szczególnie z diuretykami oszczędzającymi potas lub suplementami K). Monitoring K+ co 1-4 tyg. po rozpoczęciu/zmianie dawki, potem co 3-6 mies. Źródło: ESC HF 2023, ACC/AHA',
        category: 'WARNING',
      },
      {
        type: 'NUTRIENT_LIMIT',
        nutrient: 'potassium',
        scope: 'DAILY_TOTAL',
        max: 3500,
      } as NutrientLimitEffect,
      {
        type: 'CLINICAL_NOTE',
        note: 'Ograniczyć potas do <3500 mg/d: UNIKAĆ zamienników soli (KCl!), ograniczyć suszone owoce, awokado (485mg/100g), banany (358mg), szpinak, fasolę. Gotowanie warzyw w dużej ilości wody ↓ potas o 50-80%. Monitoring K+ OBOWIĄZKOWY.',
        category: 'RESTRICTION',
      },
    ],
  },

  // 83.2.2 MAOI — tyramina
  {
    id: 'drug-maoi',
    name: 'Interakcja: Inhibitory MAO',
    description: 'MAOI — unikanie tyraminy (przełom nadciśnieniowy), ser dojrzewający, wędliny, alkohol (FDA, APA)',
    priority: 80,
    version: '1.0',
    condition: (ctx) => hasMedication(ctx, 'moklobemid', 'moclobemide', 'aurorix',
      'selegilin', 'selegiline', 'rasagilin', 'rasagiline', 'azilect',
      'fenelzyn', 'phenelzine', 'nardil', 'tranylcypromin', 'parnate',
      'isocarboxazid', 'marplan', 'mao inhibitor', 'inhibitor mao', 'maoi'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'INHIBITOR MAO — BEZWZGLĘDNIE unikać produktów bogatych w TYRAMINĘ (ryzyko przełomu nadciśnieniowego — nagły skok ciśnienia, ból głowy, udar). Źródło: FDA Black Box Warning, APA Guidelines',
        category: 'RESTRICTION',
      },
      {
        type: 'EXCLUDE_KEYWORDS',
        keywords: ['ser dojrzewający', 'ser pleśniowy', 'camembert', 'brie', 'roquefort', 'gorgonzola',
          'parmezan', 'cheddar dojrzewający', 'gouda dojrzewająca', 'salami', 'pepperoni',
          'kiełbasa dojrzewająca', 'wino czerwone', 'piwo', 'sos sojowy fermentowany',
          'kimchi', 'miso', 'tempeh fermentowane', 'kawior'],
      },
      {
        type: 'CLINICAL_NOTE',
        note: 'DOPUSZCZALNE sery: twaróg, ricotta, mozzarella (świeże, krótko dojrzewające). DOPUSZCZALNE: kefir, jogurt (krótko fermentowane). UNIKAĆ: alkoholu, suplementów z tyrozyną, kawy >3 filiżanki/d.',
        category: 'RECOMMENDATION',
      },
    ],
  },

  // 83.2.3 Lit — sód (zbyt mało i zbyt dużo szkodzi)
  {
    id: 'drug-lithium',
    name: 'Interakcja: Lit',
    description: 'Lit — stabilny poziom sodu, unikać nagłych zmian nawodnienia (NICE, APA)',
    priority: 78,
    version: '1.0',
    condition: (ctx) => hasMedication(ctx, 'lit ', 'lithium', 'lithobid', 'eskalith', 'quilonum'),
    effects: [
      {
        type: 'CLINICAL_NOTE',
        note: 'LIT — STABILNY poziom sodu i nawodnienia KRYTYCZNY! Zbyt mało Na → ↑ reabsorpcja litu → toksyczność. Zbyt dużo Na → ↓ stężenie litu → utrata efektu. NIE stosować diet niskosodowych ani sodowych ładowań. Cel: 2000-3000 mg Na/d (stabilnie). Źródło: NICE, APA',
        category: 'RESTRICTION',
      },
      {
        type: 'NUTRIENT_LIMIT',
        nutrient: 'sodium',
        scope: 'DAILY_TOTAL',
        min: 2000,
        max: 3000,
      } as NutrientLimitEffect,
      {
        type: 'CLINICAL_NOTE',
        note: 'Lit + odwodnienie/biegunka/wymioty → NATYCHMIASTOWE ryzyko toksyczności (↑ stężenie). Pacjent musi pić min. 2-3L płynów/d. Unikać alkoholu i kofeiny w nadmiarze. Monitoring stężenia litu co 3-6 mies.',
        category: 'WARNING',
      },
    ],
  },
];

// ─── All Clinical Rules (exported) ────────────────────────────────────────────

export const CLINICAL_RULES: PolicyRule[] = [
  ...ALLERGEN_RULES,
  ...METABOLIC_RULES,
  ...CARDIO_RULES,
  ...LIVER_RULES,
  ...DIGESTIVE_RULES,
  ...HORMONAL_RULES,
  ...PREGNANCY_RULES,
  ...KIDNEY_RULES,
  ...BONE_RULES,
  ...ONCOLOGY_RULES,
  ...DEFICIENCY_RULES,
  ...EATING_DISORDER_RULES,
  ...DRUG_INTERACTION_RULES,
];
