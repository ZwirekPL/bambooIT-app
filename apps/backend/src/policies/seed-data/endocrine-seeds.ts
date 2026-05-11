import type { RuleSeed } from './types';

export const ENDOCRINE_SEEDS: RuleSeed[] = [
  // ─── Endocrine / Hormonal rules (27.8) ──────────────────────────────────────
  // 27.8.1 Hashimoto (NEW — autoimmune, separate from hypothyroidism)
  {
    name: 'Hashimoto',
    description: 'Choroba Hashimoto — autoimmunologiczne zapalenie tarczycy: selen, cynk, D3, rozważenie eliminacji glutenu',
    type: 'POLICY', severity: 'MODERATE', priority: 72,
    version: '1.0', category: 'endocrine',
    sources: [
      { ref: 'ETA Guidelines on Thyroid Dysfunction', year: 2023 },
      { ref: 'ATA Guidelines for Hypothyroidism', year: 2014 },
      { ref: 'Wichman et al. Selenium Supplementation meta-analysis', year: 2016 },
      { ref: 'Krysiak et al. Gluten-free diet in Hashimoto', year: 2019 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['hashimoto', 'choroba hashimoto', 'hashimoto thyroiditis', 'autoimmunologiczne zapalenie tarczycy'] },
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
  // 27.8.3 Niedoczynność tarczycy (ULEPSZENIE v2.0)
  {
    name: 'Niedoczynność tarczycy',
    description: 'Niedoczynność tarczycy — selen, jod, D3, interakcja z lewotyroksyną, warzywa krzyżowe gotowane',
    type: 'POLICY', severity: 'LOW', priority: 60,
    version: '2.0', category: 'endocrine',
    sources: [
      { ref: 'ETA Guidelines on Thyroid Dysfunction', year: 2023 },
      { ref: 'ATA Guidelines for Hypothyroidism', year: 2014 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['hypothyroidism', 'niedoczynność tarczycy', 'niedoczynnosc tarczycy'] },
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
  // 27.8.2 Cukrzyca ciążowa (GDM) — NEW
  {
    name: 'Cukrzyca ciążowa (GDM)',
    description: 'Cukrzyca ciążowa — węglowodany 40-45%, niski IG, 6 posiłków/d, BEZ redukcji kalorycznej',
    type: 'POLICY', severity: 'HIGH', priority: 88,
    version: '1.0', category: 'endocrine',
    sources: [
      { ref: 'PTD/PTG Rekomendacje dotyczące cukrzycy ciążowej', year: 2024 },
      { ref: 'FIGO Initiative on GDM', year: 2015 },
    ],
    conflictsWith: ['Otyłość'],
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'FIELD_EQUALS', field: 'pregnancyStatus', value: 'pregnant' },
        { type: 'HAS_CONDITION', terms: ['cukrzyca ciążowa', 'gdm', 'gestational diabetes', 'diabetes ciążowa', 'cukrzyca w ciąży'] },
      ],
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
  // 27.8.4 PCOS (ULEPSZENIE v2.0)
  {
    name: 'PCOS',
    description: 'PCOS v2.0 — kontrola insuliny, niski IG, inozytol, D3, chrom, omega-3, redukcja 5-10% przy nadwadze',
    type: 'POLICY', severity: 'MODERATE', priority: 70,
    version: '2.0', category: 'endocrine',
    sources: [
      { ref: 'International Evidence-based Guideline for PCOS', year: 2023 },
      { ref: 'Endocrine Society Clinical Practice Guideline: PCOS', year: 2023 },
      { ref: 'Unfer et al. Myo-inositol in PCOS', year: 2017 },
    ],
    conditions: {
      type: 'OR',
      conditions: [
        { type: 'HAS_HORMONAL_ISSUE', terms: ['pcos'] },
        { type: 'HAS_CONDITION', terms: ['pcos', 'zespół policystycznych jajników', 'zespol policystycznych jajnikow', 'polycystic ovary syndrome'] },
      ],
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
