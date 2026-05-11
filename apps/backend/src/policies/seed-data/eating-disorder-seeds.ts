import type { RuleSeed } from './types';

export const EATING_DISORDER_SEEDS: RuleSeed[] = [
  // ─── 26.12 Eating Disorders & Bariatric ──────────────────────────────────────
  // 26.12.1 Anoreksja nervosa — CRITICAL
  {
    name: 'Anoreksja nervosa',
    description: 'Jadłowstręt psychiczny — CRITICAL, blokada auto-generowania, wymaga zespołu terapeutycznego',
    type: 'POLICY', severity: 'CRITICAL', priority: 95,
    version: '1.0', category: 'eating-disorder',
    sources: [
      { ref: 'NICE Guideline NG69: Eating Disorders', year: 2020 },
      { ref: 'APA Practice Guidelines for Eating Disorders', year: 2023 },
      { ref: 'MARSIPAN: Management of Really Sick Patients with Anorexia Nervosa', year: 2014 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['anoreksj', 'anorexia', 'jadłowstręt'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'ANOREKSJA NERVOSA — KRYTYCZNE: Plan żywieniowy MUSI być tworzony wyłącznie pod nadzorem zespołu terapeutycznego (psychiatra + psycholog + dietetyk kliniczny). Auto-generowanie WSTRZYMANE. Źródło: NICE NG69 (2020), APA (2023)', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Refeeding syndrome: stopniowe zwiększanie energii (10-20 kcal/kg/d na start, max +200 kcal co 2-3 dni). Monitoring elektrolitów (fosfor!, Mg, K) co 24-48h. Tiamina (B1) 200-300mg/d profilaktycznie PRZED żywieniem. Źródło: NICE CG32, MARSIPAN 2014', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Cel energetyczny indywidualny (start 1200-1500 kcal/d, stopniowy wzrost). NIE stosować diety redukcyjnej. NIE liczyć kalorii przy pacjencie. Regularność posiłków (3+2-3) ważniejsza niż skład.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Tiamina (witamina B1)', dose: '200-300 mg/d', reason: 'Profilaktyka refeeding syndrome / encefalopatii Wernickego (NICE CG32)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Multiwitamina + składniki mineralne', dose: 'Wg zaleceń lekarza', reason: 'Niedobory wieloelementowe typowe: Fe, Zn, D3, Ca, B12, kwas foliowy.' },
    ],
  },
  // 26.12.2 Bulimia nervosa — CRITICAL
  {
    name: 'Bulimia nervosa',
    description: 'Żarłoczność psychiczna — CRITICAL, blokada auto-generowania, normalizacja wzorca jedzenia',
    type: 'POLICY', severity: 'CRITICAL', priority: 95,
    version: '1.0', category: 'eating-disorder',
    sources: [
      { ref: 'NICE Guideline NG69: Eating Disorders', year: 2020 },
      { ref: 'APA Practice Guidelines for Eating Disorders', year: 2023 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['bulimi', 'bulimia', 'żarłoczność psychiczna'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'BULIMIA NERVOSA — KRYTYCZNE: Plan żywieniowy wyłącznie pod nadzorem zespołu terapeutycznego. Auto-generowanie WSTRZYMANE. Źródło: NICE NG69 (2020), APA (2023)', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Normalizacja: regularne posiłki 3+2-3 przekąski co 3-4h. NIE restrykcyjne diety (wyzwalają epizody). NIE kategoryzować jedzenia na "dobre/złe". Dieta adekwatna energetycznie.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Powikłania somatyczne: hipokaliemia (wymioty/diuretyki!), erozja szkliwa, powiększenie ślinianek, zaburzenia elektrolitowe, zapalenie przełyku. Badania: elektrolity, amylaza, EKG.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Potas (KCl)', dose: 'Wg badań laboratoryjnych', reason: 'Hipokaliemia częsta przy wymiotach/przeczyszczaniu. TYLKO pod kontrolą lekarza.' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Multiwitamina + składniki mineralne', dose: 'Wg zaleceń lekarza', reason: 'Niedobory wtórne: Mg, Zn, Fe, D3, B-complex.' },
    ],
  },
  // 26.12.3 BED (kompulsywne objadanie się) — HIGH
  {
    name: 'Kompulsywne objadanie się (BED)',
    description: 'Zespół kompulsywnego objadania się — mindful eating, regularne posiłki, bez restrykcji',
    type: 'POLICY', severity: 'HIGH', priority: 75,
    version: '1.0', category: 'eating-disorder',
    sources: [
      { ref: 'NICE Guideline NG69: Eating Disorders', year: 2020 },
      { ref: 'APA Practice Guidelines for Eating Disorders', year: 2023 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['kompulsywne objadanie', 'binge eating', 'objadanie się kompulsywne'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'BED: Plan wymaga weryfikacji przez dietetyka klinicznego. Współpraca z psychologiem (CBT-E jako I linia). Źródło: NICE NG69 (2020), APA (2023)', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Regularne posiłki 3+2-3 co 3-4h. NIE pomijać posiłków. NIE restrykcyjne diety (<1200 kcal pogarsza BED). Mindful eating: wolne jedzenie, bez ekranów, sygnały głodu/sytości.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Redukcja masy (jeśli otyłość) DOPIERO po stabilizacji (brak epizodów min. 3-6 mies.). Łagodny deficyt max 500 kcal/d. Cel: zdrowe nawyki, nie szybka utrata wagi.', category: 'RESTRICTION' },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
    ],
  },
  // 26.12.4 Pacjent po operacji bariatrycznej — HIGH
  {
    name: 'Pacjent po operacji bariatrycznej',
    description: 'Stan po bariatrii — zmienione wchłanianie, obowiązkowa suplementacja, fazy żywienia',
    type: 'POLICY', severity: 'HIGH', priority: 80,
    version: '1.0', category: 'eating-disorder',
    sources: [
      { ref: 'ASMBS Clinical Practice Guidelines: Nutrition', year: 2020 },
      { ref: 'IFSO Guidelines for Perioperative Nutrition', year: 2022 },
    ],
    conditions: {
      type: 'OR',
      conditions: [
        { type: 'HAS_CONDITION', terms: ['po bariatrii', 'po operacji bariatrycznej', 'bariatric', 'po sleeve', 'po bypass'] },
        { type: 'HAS_SURGERY', terms: ['bariatr', 'sleeve', 'bypass', 'roux-en-y'] },
      ],
    },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'PACJENT PO BARIATRII: Plan wymaga weryfikacji. Zmienione wchłanianie. Suplementacja OBOWIĄZKOWA dożywotnio. Źródło: ASMBS 2020, IFSO 2022', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Porcje 150-250ml. Wolne jedzenie (20-30min). Picie MIĘDZY posiłkami (min. 30min odstępu). Min. 1.5L/d małymi łykami. Białko priorytet: min 60-80g/d na początku posiłku.', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Fazy: <2 tyg. płyny klarowne; 2-4 tyg. płyny pełne; 4-8 tyg. papkowata/miękka; 8-12 tyg. miękka stała; >12 tyg. dieta stała z ograniczeniami.', category: 'INFO' },
      { type: 'CLINICAL_NOTE', note: 'Unikać: cukry proste (dumping syndrome!), napoje gazowane, alkohol (szybsze wchłanianie), tłuste/smażone.', category: 'RESTRICTION' },
      { type: 'NUTRIENT_LIMIT', nutrient: 'protein', scope: 'DAILY_TOTAL', min: 60 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'DAILY_TOTAL', max: 25 },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12', dose: '1000 µg/d sublingual', reason: 'Obowiązkowa — upośledzone wchłanianie (brak czynnika wewnętrznego). Niedobór u 30-70%. (ASMBS 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo + wit. C', dose: '45-60 mg Fe/d + 200 mg wit. C', reason: 'Niedobór u 20-55% (bypass > sleeve). Oddzielnie od Ca (min. 2h). (ASMBS 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Wapń (cytrynian wapnia)', dose: '1200-1500 mg/d w dawkach podzielonych', reason: 'Cytrynian (NIE węglan). Zapobiega osteoporozie pobariatrycznej. (ASMBS 2020, IFSO 2022)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '3000-6000 IU/d', reason: 'Niedobór u 50-80%. Cel: 25(OH)D >30 ng/ml. Wyższe dawki niż populacja ogólna. (ASMBS 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Kwas foliowy', dose: '400-800 µg/d', reason: 'Profilaktyka, szczególnie kobiety w wieku rozrodczym. (ASMBS 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Cynk', dose: '8-22 mg/d', reason: 'Niedobór u 30-50%. Objawy: wypadanie włosów, problemy skórne. (IFSO 2022)' },
    ],
  },
];
