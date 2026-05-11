import type { RuleSeed } from './types';

export const ONCOLOGY_SEEDS: RuleSeed[] = [
  // ── 27.10 Oncology Rules ───────────────────────────────────────────────────
  // 27.10.1 Nowotwór jelita grubego
  {
    name: 'Nowotwór jelita grubego',
    description: 'Nowotwór jelita grubego — białko 1.2-1.5g/kg, lekkostrawna, antyoksydanty, RED FLAG HIGH',
    type: 'POLICY', severity: 'HIGH', priority: 85,
    version: '1.0', category: 'oncology',
    sources: [
      { ref: 'ESPEN Practical Guideline: Clinical Nutrition in Cancer', year: 2021 },
      { ref: 'WCRF/AICR Recommendations', year: 2018 },
      { ref: 'IARC Monographs Red Meat/Processed Meat', year: 2015 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['nowotwór jelita grubego', 'rak jelita grubego', 'rak okrężnicy', 'rak odbytnicy', 'colorectal cancer', 'colon cancer', 'rectal cancer', 'rak jelita', 'CRC'] },
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MAX', value: 1.2 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fiber', scope: 'DAILY_TOTAL', min: 10, max: 20 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['czerwone mięso', 'wołowina', 'wieprzowina', 'baranina', 'kiełbasa', 'parówka', 'boczek', 'salami', 'kabanos', 'szynka', 'wędlina', 'hot dog', 'red meat', 'processed meat', 'alkohol', 'piwo', 'wino', 'wódka'] },
      { type: 'PREFER_PRODUCTS', flagKey: 'highProtein', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Nowotwór jelita grubego: białko 1.2-1.5g/kg/d (zapobieganie kacheksji). Energia 25-30 kcal/kg/d. Lekkostrawna, błonnik rozpuszczalny 10-20g/d. Małe częste porcje (5-6/d). Źródło: ESPEN Oncology 2021', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'ELIMINACJA: czerwone i przetworzone mięso (IARC klasa 1), alkohol, smażone/grillowane w wysokiej temp. WCRF/AICR: <500g czerwonego mięsa/tyg, 0g przetworzonego.', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'ZALECANE: warzywa krzyżowe (brokuły, kapusta), owoce jagodowe, ryby (omega-3), oliwa, orzechy. Dieta śródziemnomorska jako model. WCRF/AICR 2018', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'UWAGA: Suplementy antyoksydacyjne NIE zalecane w trakcie chemio-/radioterapii! Antyoksydanty wyłącznie z diety. Źródło: ESPEN 2021', category: 'WARNING' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA+DHA)', dose: '1-2 g/d', reason: 'Przeciwzapalnie, wsparcie masy mięśniowej (ESPEN 2021)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '1000-2000 IU/d', reason: 'Częsty niedobór u pacjentów onkologicznych (WCRF)' },
    ],
  },
  // 27.10.2 Nowotwór żołądka
  {
    name: 'Nowotwór żołądka',
    description: 'Nowotwór żołądka — małe częste posiłki 6-8/d, lekkostrawna, B12/Fe po resekcji',
    type: 'POLICY', severity: 'HIGH', priority: 85,
    version: '1.0', category: 'oncology',
    sources: [
      { ref: 'ESPEN Practical Guideline: Clinical Nutrition in Cancer', year: 2021 },
      { ref: 'ESPEN Guideline: Surgery incl. Organ Transplantation', year: 2017 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['nowotwór żołądka', 'rak żołądka', 'gastric cancer', 'stomach cancer', 'gastrektomia', 'gastrectomy'] },
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MAX', value: 1.2 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['ostre przyprawy', 'chili', 'pieprz cayenne', 'tabasco', 'wasabi', 'smażone', 'fried', 'napoje gazowane', 'soda', 'cola', 'alkohol', 'piwo', 'wino', 'wódka'] },
      { type: 'PREFER_PRODUCTS', flagKey: 'highProtein', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Nowotwór żołądka: małe porcje (6-8/d, 150-250ml). Energia 30-35 kcal/kg/d, białko 1.2-1.5g/kg/d. Lekkostrawna, unikanie ostrych, smażonych, gazowanych. Źródło: ESPEN 2021', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'PO RESEKCJI — dumping syndrome: unikać prostych cukrów, NIE pić podczas posiłku (30 min przed/po), pozycja leżąca 15-30 min po jedzeniu.', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Po gastrektomii: OBOWIĄZKOWA suplementacja B12 (im. co 3 mies. lub sublingual), żelazo (chelatowe), Ca+D3. Monitoring co 3-6 mies.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12', dose: '1000 µg/d sublingual lub im. co 3 mies.', reason: 'Brak czynnika wewnętrznego po gastrektomii (ESPEN 2021)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Żelazo (chelatowe)', dose: '30-60 mg/d (wg ferrytyny)', reason: 'Upośledzone wchłanianie po resekcji żołądka' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Wapń + Witamina D3', dose: 'Ca 1000-1200 mg/d + D3 2000 IU/d', reason: 'Profilaktyka osteoporozy metabolicznej po gastrektomii' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Enzymy trawienne', dose: 'wg potrzeb', reason: 'Przy biegunkach tłuszczowych po resekcji' },
    ],
  },
  // 27.10.3 Nowotwór trzustki
  {
    name: 'Nowotwór trzustki',
    description: 'Nowotwór trzustki — PERT, tłuszcze MCT, wysoka energia, ADEK, RED FLAG HIGH',
    type: 'POLICY', severity: 'HIGH', priority: 88,
    version: '1.0', category: 'oncology',
    sources: [
      { ref: 'ESPEN Practical Guideline: Clinical Nutrition in Cancer', year: 2021 },
      { ref: 'NICE Pancreatic Cancer in Adults: Diagnosis and Management', year: 2024 },
      { ref: 'ASCO Pancreatic Cancer Guidelines', year: 2023 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['nowotwór trzustki', 'rak trzustki', 'pancreatic cancer', 'guz trzustki', 'pankreatektomia'] },
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MAX', value: 1.2 },
      { type: 'MODIFY_TARGETS', field: 'targetKcal', operation: 'MULTIPLY', value: 1.1 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'fat', scope: 'PER_100G', max: 15 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['smażone', 'panierowane', 'fried', 'fast food', 'tłuste mięso', 'boczek', 'smalec', 'alkohol', 'piwo', 'wino', 'wódka'] },
      { type: 'PREFER_PRODUCTS', flagKey: 'highProtein', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Nowotwór trzustki: wysoka energia 30-35 kcal/kg/d (kacheksja bardzo częsta!), białko 1.2-1.5g/kg/d. Małe posiłki (6-8/d). Tłuszcze MCT preferowane. Ograniczenie tłuszczu konwencjonalnego <15g/posiłek. Źródło: ESPEN 2021, NICE 2024', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'PERT OBOWIĄZKOWE przy niewydolności egzokrynnej: 25000-75000j lipazy/posiłek, 10000-25000j/przekąskę. Przyjmować Z jedzeniem. Skierować do gastroenterologa.', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Witaminy ADEK — częste niedobory. Monitorować 25(OH)D, retinol, tokoferol, INR. Forma wodna preferowana. NICE 2024', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Ryzyko cukrzycy trzustkowej (typ 3c) — monitorować glikemię. Dieta niskoglikemiczna. Koordynacja z diabetologiem.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '2000-4000 IU/d', reason: 'Malabsorpcja tłuszczów → niedobór (NICE 2024)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina A', dose: '2500-5000 IU/d', reason: 'Niedobór przy niewydolności egzokrynnej' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina E', dose: '200-400 IU/d', reason: 'Malabsorpcja tłuszczów' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina K', dose: '100-200 µg/d', reason: 'Ryzyko zaburzeń krzepnięcia (monitorować INR)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12', dose: '1000 µg/d', reason: 'Upośledzone wchłanianie po pankreatektomii' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Omega-3 (EPA)', dose: '2 g/d EPA', reason: 'Hamowanie kacheksji nowotworowej (ESPEN 2021)' },
    ],
  },
];
