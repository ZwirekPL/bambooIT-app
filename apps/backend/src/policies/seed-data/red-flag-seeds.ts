import type { RuleSeed } from './types';

export const RED_FLAG_SEEDS: RuleSeed[] = [
  {
    name: 'Skrajnie niska masa ciała',
    description: 'BMI poniżej 16 — wymaga nadzoru medycznego',
    type: 'RED_FLAG', severity: 'CRITICAL', priority: 100,
    conditions: { type: 'FIELD_COMPARE', field: 'bmi', operator: 'LT', value: 16 },
    effects: { message: 'BMI pacjenta < 16 (skrajne niedożywienie). Auto-generowanie wstrzymane — wymagana konsultacja medyczna i indywidualny plan pod nadzorem lekarza.' },
  },
  {
    name: 'Bardzo niskie BMI',
    description: 'BMI poniżej 17 — ryzyko niedożywienia',
    type: 'RED_FLAG', severity: 'HIGH', priority: 95,
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'FIELD_COMPARE', field: 'bmi', operator: 'GTE', value: 16 },
        { type: 'FIELD_COMPARE', field: 'bmi', operator: 'LT', value: 17 },
      ],
    },
    effects: { message: 'BMI pacjenta < 17 (niedowaga z ryzykiem niedożywienia). Zalecana weryfikacja planu przez dietetyka przed wysłaniem.' },
  },
  {
    name: 'Otyłość III stopnia',
    description: 'BMI powyżej 40 — wymaga nadzoru medycznego',
    type: 'RED_FLAG', severity: 'HIGH', priority: 90,
    conditions: { type: 'FIELD_COMPARE', field: 'bmi', operator: 'GTE', value: 40 },
    effects: { message: 'BMI pacjenta >= 40 (otyłość III stopnia). Zalecana konsultacja z lekarzem i indywidualny plan z nadzorem.' },
  },
  {
    name: 'Ciąża + cel redukcja',
    description: 'Pacjentka w ciąży z celem redukcji masy ciała — niebezpieczne',
    type: 'RED_FLAG', severity: 'CRITICAL', priority: 100,
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'FIELD_EQUALS', field: 'pregnancyStatus', value: 'pregnant' },
        { type: 'FIELD_EQUALS', field: 'goal', value: 'lose_weight' },
      ],
    },
    effects: { message: 'Pacjentka w ciąży z celem redukcji masy ciała. Auto-generowanie wstrzymane — redukcja podczas ciąży jest przeciwwskazana.' },
  },
  {
    name: 'Skrajnie niskie zapotrzebowanie',
    description: 'Target kaloryczny poniżej 1000 kcal — ryzyko niedoborów',
    type: 'RED_FLAG', severity: 'CRITICAL', priority: 100,
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'FIELD_COMPARE', field: 'targetKcal', operator: 'GT', value: 0 },
        { type: 'FIELD_COMPARE', field: 'targetKcal', operator: 'LT', value: 1000 },
      ],
    },
    effects: { message: 'Obliczone zapotrzebowanie < 1000 kcal/dzień. Auto-generowanie wstrzymane — tak niski kaloryczny cel jest medycznie niebezpieczny bez nadzoru.' },
  },
  {
    name: 'Niskie zapotrzebowanie',
    description: 'Target kaloryczny poniżej 1200 kcal — wymaga uwagi',
    type: 'RED_FLAG', severity: 'MODERATE', priority: 70,
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'FIELD_COMPARE', field: 'targetKcal', operator: 'GTE', value: 1000 },
        { type: 'FIELD_COMPARE', field: 'targetKcal', operator: 'LT', value: 1200 },
      ],
    },
    effects: { message: 'Obliczone zapotrzebowanie < 1200 kcal/dzień. Dieta bardzo niskokaloryczna — zalecana weryfikacja przez dietetyka.' },
  },
  {
    name: 'Liczne schorzenia',
    description: 'Pacjent ma 3+ chorób przewlekłych — wymaga indywidualnego podejścia',
    type: 'RED_FLAG', severity: 'HIGH', priority: 85,
    conditions: { type: 'FIELD_COMPARE', field: 'chronicDiseasesCount', operator: 'GTE', value: 3 },
    effects: { message: 'Pacjent zgłosił 3 lub więcej chorób przewlekłych. Zalecana weryfikacja planu przez dietetyka — wiele schorzeń może mieć sprzeczne wymagania dietetyczne.' },
  },
  {
    name: 'Cukrzyca + leki',
    description: 'Pacjent z cukrzycą przyjmujący leki — ryzyko hipoglikemii',
    type: 'RED_FLAG', severity: 'HIGH', priority: 85,
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'HAS_CONDITION', terms: ['diabetes', 'cukrzyca'] },
        { type: 'HAS_MEDICATIONS' },
      ],
    },
    effects: { message: 'Pacjent z cukrzycą przyjmuje leki. Zmiana diety może wpłynąć na zapotrzebowanie na insulinę/leki — zalecana konsultacja z lekarzem.' },
  },
  {
    name: 'Osoba starsza z wielochorobowością',
    description: 'Pacjent 70+ lat z chorobami przewlekłymi',
    type: 'RED_FLAG', severity: 'MODERATE', priority: 65,
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'FIELD_COMPARE', field: 'ageYears', operator: 'GTE', value: 70 },
        { type: 'FIELD_COMPARE', field: 'chronicDiseasesCount', operator: 'GTE', value: 1 },
      ],
    },
    effects: { message: 'Pacjent w wieku 70+ lat ze schorzeniami. Zalecana weryfikacja planu — osoby starsze mają specyficzne wymagania żywieniowe (np. wyższe białko, wapń, witamina D).' },
  },
  {
    name: 'Niepełnoletni pacjent',
    description: 'Pacjent poniżej 16 lat — rosnący organizm wymaga szczególnej uwagi',
    type: 'RED_FLAG', severity: 'HIGH', priority: 90,
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'FIELD_COMPARE', field: 'ageYears', operator: 'GT', value: 0 },
        { type: 'FIELD_COMPARE', field: 'ageYears', operator: 'LT', value: 16 },
      ],
    },
    effects: { message: 'Pacjent poniżej 16 lat. Auto-generowanie wymaga weryfikacji — dieta dla rosnącego organizmu musi uwzględniać specyficzne potrzeby rozwojowe.' },
  },

  // ─── Phase 27.14: New Red Flags ─────────────────────────────────────────────

  {
    name: 'Zaburzenia odżywiania',
    description: 'Pacjent z rozpoznaniem zaburzeń odżywiania (anoreksja, bulimia) — wymaga nadzoru specjalisty',
    type: 'RED_FLAG', severity: 'CRITICAL', priority: 100,
    category: 'eating-disorder',
    version: '1.0',
    sources: [
      { ref: 'APA Practice Guidelines for Eating Disorders', year: 2023 },
      { ref: 'NICE NG69 — Eating disorders', year: 2020 },
    ],
    conditions: {
      type: 'OR',
      conditions: [
        { type: 'HAS_CONDITION', terms: ['anoreksja', 'anorexia'] },
        { type: 'HAS_CONDITION', terms: ['bulimia'] },
        { type: 'HAS_HORMONAL_ISSUE', terms: ['anoreksja', 'anorexia', 'bulimia'] },
      ],
    },
    effects: { message: 'Pacjent z rozpoznaniem zaburzeń odżywiania (anoreksja/bulimia). Auto-generowanie wstrzymane — wymagana terapia pod nadzorem zespołu specjalistów (psychiatra, psycholog, dietetyk kliniczny).' },
  },
  {
    name: 'Encefalopatia wątrobowa',
    description: 'Encefalopatia wątrobowa — stan zagrożenia życia wymagający nadzoru medycznego',
    type: 'RED_FLAG', severity: 'CRITICAL', priority: 100,
    category: 'hepatic',
    version: '1.0',
    sources: [
      { ref: 'EASL Clinical Practice Guidelines on hepatic encephalopathy', year: 2022 },
      { ref: 'ESPEN Guideline on Clinical Nutrition in Liver Disease', year: 2019 },
    ],
    conditions: {
      type: 'HAS_CONDITION', terms: ['encefalopatia wątrobowa', 'hepatic encephalopathy', 'encefalopatia'],
    },
    effects: { message: 'Pacjent z encefalopatią wątrobową. Auto-generowanie wstrzymane — stan zagrożenia życia wymagający hospitalizacji i ścisłego nadzoru dietetycznego (ograniczenie białka, BCAA, laktuloza).' },
  },
  {
    name: 'CKD stadium 4-5',
    description: 'Przewlekła choroba nerek w zaawansowanym stadium — wymaga nadzoru nefrologa',
    type: 'RED_FLAG', severity: 'CRITICAL', priority: 100,
    category: 'renal',
    version: '1.0',
    sources: [
      { ref: 'KDIGO 2024 Clinical Practice Guideline for CKD', year: 2024 },
      { ref: 'KDOQI Nutrition in CKD 2020 Update', year: 2020 },
    ],
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'HAS_CONDITION', terms: ['ckd', 'przewlekła choroba nerek', 'chronic kidney disease', 'niewydolność nerek'] },
        { type: 'HAS_STAGE', terms: ['4', '5', 'iv', 'v', 'stadium 4', 'stadium 5', 'stage 4', 'stage 5'] },
      ],
    },
    effects: { message: 'Pacjent z CKD stadium 4-5. Auto-generowanie wstrzymane — zaawansowana niewydolność nerek wymaga ścisłego nadzoru nefrologicznego (białko 0.6-0.8g/kg, kontrola potasu, fosforu, sodu).' },
  },
  {
    name: 'Choroba nowotworowa',
    description: 'Pacjent z aktywną chorobą nowotworową — wymaga indywidualnego planu',
    type: 'RED_FLAG', severity: 'HIGH', priority: 88,
    category: 'oncology',
    version: '1.0',
    sources: [
      { ref: 'ESPEN Practical Guideline: Clinical Nutrition in Cancer', year: 2021 },
      { ref: 'WCRF/AICR Cancer Prevention Recommendations', year: 2018 },
    ],
    conditions: {
      type: 'HAS_CONDITION', terms: ['nowotwór', 'rak', 'cancer', 'onkolog', 'chemioterapi', 'radioterapia', 'guz', 'tumor'],
    },
    effects: { message: 'Pacjent z chorobą nowotworową. Plan wymaga weryfikacji przez dietetyka — onkologia wymaga indywidualnego podejścia (białko 1.2-1.5g/kg, zapobieganie kacheksji, interakcje z leczeniem).' },
  },
  {
    name: 'Ciąża + cukrzyca ciążowa',
    description: 'Pacjentka w ciąży z cukrzycą ciążową — wymaga ścisłego nadzoru',
    type: 'RED_FLAG', severity: 'HIGH', priority: 88,
    category: 'endocrine',
    version: '1.0',
    sources: [
      { ref: 'PTD/PTG — Cukrzyca ciążowa: wytyczne', year: 2024 },
      { ref: 'ADA Standards of Care — GDM Management', year: 2024 },
    ],
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'FIELD_EQUALS', field: 'pregnancyStatus', value: 'pregnant' },
        {
          type: 'OR',
          conditions: [
            { type: 'HAS_CONDITION', terms: ['cukrzyca ciążowa', 'gdm', 'gestational diabetes'] },
            { type: 'HAS_HORMONAL_ISSUE', terms: ['cukrzyca ciążowa', 'gdm', 'gestational diabetes'] },
          ],
        },
      ],
    },
    effects: { message: 'Pacjentka w ciąży z cukrzycą ciążową (GDM). Plan wymaga weryfikacji — dieta musi zapewniać prawidłowy rozwój płodu przy kontroli glikemii (40-45% węglowodanów, niski IG, 6 posiłków/d).' },
  },
  {
    name: 'Pacjent po bariatrii',
    description: 'Pacjent po operacji bariatrycznej — wymaga specjalistycznej diety etapowej',
    type: 'RED_FLAG', severity: 'HIGH', priority: 88,
    category: 'eating-disorder',
    version: '1.0',
    sources: [
      { ref: 'ASMBS/IFSO Guidelines on Metabolic/Bariatric Surgery', year: 2022 },
      { ref: 'ESPEN Guideline: Bariatric surgery', year: 2020 },
    ],
    conditions: {
      type: 'OR',
      conditions: [
        { type: 'HAS_SURGERY', terms: ['bariatr', 'sleeve', 'bypass', 'rękaw', 'ominięcie', 'band'] },
        { type: 'HAS_CONDITION', terms: ['po bariatrii', 'post-bariatric', 'po sleeve', 'po bypass'] },
      ],
    },
    effects: { message: 'Pacjent po operacji bariatrycznej. Plan wymaga weryfikacji — obowiązkowa suplementacja (B12, Fe, Ca, D3, białko), dieta etapowa, małe porcje, priorytet białka.' },
  },
  {
    name: 'Marskość wątroby dekompensowana',
    description: 'Marskość wątroby dekompensowana — stan zaawansowany wymagający nadzoru hepatologa',
    type: 'RED_FLAG', severity: 'HIGH', priority: 88,
    category: 'hepatic',
    version: '1.0',
    sources: [
      { ref: 'EASL Clinical Practice Guidelines: Decompensated cirrhosis', year: 2018 },
      { ref: 'ESPEN Guideline on Clinical Nutrition in Liver Disease', year: 2019 },
    ],
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'HAS_CONDITION', terms: ['marskość', 'cirrhosis', 'cirrhotic'] },
        {
          type: 'OR',
          conditions: [
            { type: 'HAS_STAGE', terms: ['dekompensowana', 'decompensated', 'child-pugh b', 'child-pugh c'] },
            { type: 'HAS_CONDITION', terms: ['wodobrzusze', 'ascites', 'żylaki przełyku', 'varice'] },
          ],
        },
      ],
    },
    effects: { message: 'Pacjent z marskością wątroby dekompensowaną. Plan wymaga weryfikacji — zaawansowana choroba wątroby wymaga nadzoru hepatologa (białko 1.2-1.5g/kg, ograniczenie sodu, małe częste posiłki, BCAA).' },
  },
];
