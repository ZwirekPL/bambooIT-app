import type { RuleSeed } from './types';

export const DEFICIENCY_SEEDS: RuleSeed[] = [
  // ── 27.11 Nutritional Deficiency Rules ──────────────────────────────────────
  // 27.11.1 Niedokrwistość z niedoboru żelaza
  {
    name: 'Niedokrwistość z niedoboru żelaza',
    description: 'Niedokrwistość sideropeniczna — żelazo hemowe, wit. C, unikanie tanin',
    type: 'POLICY', severity: 'MODERATE', priority: 72,
    version: '1.0', category: 'deficiency',
    sources: [
      { ref: 'BSG Guidelines for Management of Iron Deficiency Anaemia', year: 2021 },
      { ref: 'WHO Guideline: Iron Deficiency Anaemia Assessment, Prevention and Control', year: 2001 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['niedokrwistość', 'anemia', 'niedobór żelaza', 'iron deficiency', 'sideropeniczna'] },
    effects: [
      { type: 'PREFER_PRODUCTS', flagKey: 'highIron', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['herbata czarna', 'kawa', 'black tea', 'coffee'] },
      { type: 'CLINICAL_NOTE', note: 'Niedokrwistość z niedoboru żelaza: preferencja żelaza hemowego (czerwone mięso 2-3x/tyg, wątróbka 1x/tyg, małże, ostrygi). Żelazo niehemowe łączyć z wit. C. Źródło: BSG 2021', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'UNIKAĆ 1h przed i po posiłku z Fe: taniny (herbata, kawa), fityniany (otręby), wapń (nabiał). Gotowanie w żeliwnym garnku zwiększa Fe. Źródło: WHO', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'ZALECANE: wątróbka drobiowa (9mg/100g), kaszanka, mięso czerwone, małże, soczewica, ciecierzyca, szpinak gotowany, pestki dyni, amarant. Cel: Fe 15-20mg/d.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo (dwuwartościowe)', dose: '30-60 mg/d na czczo z wit. C', reason: 'Leczenie niedoboru żelaza (BSG 2021). Monitoring ferrytyny co 3 mies.' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina C', dose: '200-500 mg/d przy posiłkach z Fe', reason: 'Zwiększa wchłanianie żelaza niehemowego 2-6x' },
    ],
  },
  // 27.11.2 Niedokrwistość z niedoboru B12
  {
    name: 'Niedokrwistość z niedoboru B12',
    description: 'Niedobór B12 — produkty odzwierzęce, suplementacja, uwaga weganie',
    type: 'POLICY', severity: 'MODERATE', priority: 72,
    version: '1.0', category: 'deficiency',
    sources: [
      { ref: 'BSG Guidelines: Diagnosis and Management of B12 and Folate Disorders', year: 2014 },
      { ref: 'NICE Clinical Knowledge Summary: Anaemia — B12 and Folate Deficiency', year: 2024 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['niedobór b12', 'niedobór witaminy b12', 'b12 deficiency', 'niedokrwistość megaloblastyczna', 'niedokrwistość złośliwa', 'pernicious anemia'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Niedobór B12: preferencja produktów odzwierzęcych — wątróbka wołowa (60µg/100g!), małże (84µg/100g), sardynki, łosoś, wołowina, jaja, nabiał. Zapotrzebowanie: 2.4µg/d. Źródło: BSG 2014', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Dieta wegańska/wegetariańska → OBLIGATORYJNA suplementacja B12! Spirulina/algi to analogi (nieaktywne). Źródło: NICE 2024', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Przyczyny złego wchłaniania: gastritis atroficzny, metformina, IPP, celiakia, Crohn, resekcja żołądka. Przy złym wchłanianiu → sublingual lub im.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12 (metylokobalamina)', dose: '1000 µg/d sublingual lub 2x/tyg', reason: 'Leczenie niedoboru B12. Monitoring co 3-6 mies. (BSG 2014, NICE 2024)' },
    ],
  },
  // 27.11.3 Niedobór kwasu foliowego
  {
    name: 'Niedobór kwasu foliowego',
    description: 'Niedobór folianów — zielone warzywa, strączkowe, uwaga na maskowanie B12',
    type: 'POLICY', severity: 'MODERATE', priority: 68,
    version: '1.0', category: 'deficiency',
    sources: [
      { ref: 'WHO Guideline: Optimal Serum and Red Blood Cell Folate Concentrations', year: 2015 },
      { ref: 'NICE Clinical Knowledge Summary: Anaemia — B12 and Folate Deficiency', year: 2024 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['niedobór kwasu foliowego', 'niedobór folianów', 'folate deficiency', 'folic acid deficiency'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Niedobór folianów: zielone warzywa liściaste (szpinak 194µg/100g, jarmuż, brokuły), strączkowe (soczewica 181µg/100g, ciecierzyca), wątróbka (560µg/100g!), jaja, orzechy. Zapotrzebowanie: 400µg/d (800µg w ciąży). Źródło: WHO, EFSA', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA — kwas foliowy może MASKOWAĆ niedobór B12! ZAWSZE sprawdzić B12 przed suplementacją folianów. Źródło: NICE, WHO', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Foliany są termolabilne — krótkie gotowanie, na parze, surowe warzywa. Unikać długiego gotowania.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Kwas foliowy (5-MTHF)', dose: '400 µg/d (800 µg w ciąży)', reason: 'Uzupełnienie niedoboru. Forma 5-MTHF preferowana przy MTHFR. (WHO, NICE)' },
    ],
  },
  // 27.11.4 Niedobór jodu
  {
    name: 'Niedobór jodu',
    description: 'Niedobór jodu — ryby morskie, sól jodowana, nabiał, uwaga Hashimoto',
    type: 'POLICY', severity: 'MODERATE', priority: 65,
    version: '1.0', category: 'deficiency',
    sources: [
      { ref: 'WHO/UNICEF/ICCIDD: Assessment of Iodine Deficiency Disorders', year: 2007 },
      { ref: 'ETA Guidelines: Use of Thyroid Hormones', year: 2023 },
    ],
    conflictsWith: ['Hashimoto'],
    conditions: { type: 'HAS_CONDITION', terms: ['niedobór jodu', 'iodine deficiency'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Niedobór jodu: ryby morskie 2-3x/tyg (dorsz 110µg/100g), sól jodowana, nabiał, jaja. Zapotrzebowanie: 150µg/d (250µg w ciąży). Źródło: WHO/UNICEF/ICCIDD, ETA', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA przy Hashimoto: nadmiar jodu może nasilić autoagresję! Nie >300µg/d. NIE suplementy z kelpu/fucusu. Źródło: ETA 2023', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Polska — kraj z historycznie endemicznym niedoborem jodu. Od 1997 obowiązkowe jodowanie soli. Kobiety w ciąży/karmiące często wymagają dodatkowej suplementacji.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Jod (jodek potasu)', dose: '150 µg/d (250 µg w ciąży)', reason: 'Uzupełnienie niedoboru jodu. WHO/UNICEF. Monitoring TSH co 6-12 mies.' },
    ],
  },
  // 27.11.5 Niedobór wapnia
  {
    name: 'Niedobór wapnia',
    description: 'Niedobór wapnia — nabiał, sardynki, tofu, wody mineralne, D3 konieczna',
    type: 'POLICY', severity: 'MODERATE', priority: 68,
    version: '1.0', category: 'deficiency',
    sources: [
      { ref: 'IOF: Calcium — Roles, Requirements and Recommendations', year: 2020 },
      { ref: 'EFSA Scientific Opinion on Dietary Reference Values for Calcium', year: 2015 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['niedobór wapnia', 'calcium deficiency', 'hipokalcemia', 'hypocalcemia'] },
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 1000 },
      { type: 'CLINICAL_NOTE', note: 'Niedobór wapnia: nabiał (ser żółty 700-900mg/100g, jogurt, mleko 120mg/100ml), sardynki z ościami (380mg/100g), tofu (350mg/100g), migdały, sezam (975mg/100g!), brokuły, jarmuż. Wody mineralne >150mg Ca/L. Źródło: IOF, EFSA 2015', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'D3 KONIECZNA dla wchłaniania Ca! Bez D3 wchłania się 10-15% (z D3 → 30-40%). Nie łączyć Ca z Fe. Fityniany/szczawiany ↓ biodostępność.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Wapń (cytrynian wapnia)', dose: '500-1000 mg/d w 2 dawkach (max 500mg jednorazowo)', reason: 'Uzupełnienie niedoboru. Cytrynian — lepsze wchłanianie. IOF, EFSA 2015' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '1000-2000 IU/d', reason: 'Niezbędna dla wchłaniania Ca. Monitoring 25(OH)D.' },
    ],
  },
  // 27.11.6 Niedobór witaminy D
  {
    name: 'Niedobór witaminy D',
    description: 'Niedobór witaminy D — ryby tłuste, suplementacja, ekspozycja słoneczna',
    type: 'POLICY', severity: 'MODERATE', priority: 70,
    version: '1.0', category: 'deficiency',
    sources: [
      { ref: 'Endocrine Society Clinical Practice Guideline: Vitamin D', year: 2024 },
      { ref: 'Polskie rekomendacje suplementacji witaminy D', year: 2023 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['niedobór witaminy d', 'vitamin d deficiency', 'niedobór d3', 'hipowitaminoza d'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Niedobór wit. D: ryby tłuste (łosoś dziki 600-1000 IU/100g, makrela, śledź, sardynki), żółtka jaj, grzyby UV, produkty fortyfikowane. Źródło: Endocrine Society 2024', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Ekspozycja słoneczna: 15-20 min/d (IV-IX w PL, godz. 10-15). X-III synteza skórna NIEMOŻLIWA w Polsce. Suplementacja zimowa obowiązkowa. Źródło: Polskie rek. wit. D 2023', category: 'INFO' },
      { type: 'CLINICAL_NOTE', note: 'Dawkowanie wg 25(OH)D: <10ng/ml → 4000-10000 IU/d 8 tyg.; 10-20ng/ml → 2000-4000 IU/d; 20-30ng/ml → 1000-2000 IU/d. Cel: 30-50ng/ml. Monitoring co 3-6 mies.', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3 (cholekalcyferol)', dose: '2000-4000 IU/d (wg poziomu 25(OH)D)', reason: 'D3 2-3x skuteczniejsza od D2. Przyjmować z tłuszczem. (Endocrine Society 2024, Polskie rek. 2023)' },
    ],
  },
];
