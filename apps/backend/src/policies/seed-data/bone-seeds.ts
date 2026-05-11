import type { RuleSeed } from './types';

export const BONE_SEEDS: RuleSeed[] = [
  // ── 27.9 Bone Disease Rules ──────────────────────────────────────────────────
  // 27.9.1 Osteoporoza
  {
    name: 'Osteoporoza',
    description: 'Osteoporoza — Ca 1000-1200mg/d, D3 800-2000 IU/d, K2, białko 1.0-1.2g/kg',
    type: 'POLICY', severity: 'MODERATE', priority: 78,
    version: '1.0', category: 'bone',
    sources: [
      { ref: 'IOF/ESCEO Guidelines', year: 2020 },
      { ref: 'NOF Clinician\'s Guide', year: 2022 },
      { ref: 'Endocrine Society', year: 2024 },
    ],
    conflictsWith: ['Przewlekła choroba nerek (CKD)'],
    conditions: { type: 'HAS_CONDITION', terms: ['osteoporoza', 'osteoporosis', 'osteoporozy'] },
    effects: [
      { type: 'MODIFY_TARGETS', field: 'targetProteinG', operation: 'MAX', value: 1.0 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 1000, max: 1500 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2300 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'phosphorus', scope: 'DAILY_TOTAL', min: 700 },
      { type: 'PREFER_PRODUCTS', flagKey: 'highCalcium', flagValue: true },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['cola', 'pepsi', 'napój gazowany', 'soda', 'energy drink', 'napój energetyczny'] },
      { type: 'CLINICAL_NOTE', note: 'Osteoporoza: wapń 1000-1200mg/d (z diety — nabiał, sardynki z ościami, tofu z Ca, wody mineralne >150mg Ca/L). Białko 1.0-1.2g/kg/d (kluczowe dla masy kostnej!). Sód <2300mg/d. Kofeina <400mg/d. Unikanie napojów cola (fosforany). Źródło: IOF/ESCEO 2020, NOF', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Dieta bogata w owoce i warzywa (alkalizacja — zmniejsza utratę Ca z moczem). Witamina K1 (zielone warzywa liściaste) wspiera karboksylację osteokalcyny.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '800-2000 IU/d', reason: 'Niezbędna dla wchłaniania wapnia i metabolizmu kostnego (IOF/ESCEO 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina K2 (MK-7)', dose: '100-200 µg/d', reason: 'Kieruje wapń do kości, synergia z D3' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez', dose: '300-400 mg/d', reason: 'Kofaktor metabolizmu D3 i mineralizacji kości' },
    ],
  },
  // 27.9.2 Osteopenia
  {
    name: 'Osteopenia',
    description: 'Osteopenia — Ca 1000mg/d, D3 800-1000 IU/d, profilaktyka osteoporozy',
    type: 'POLICY', severity: 'LOW', priority: 65,
    version: '1.0', category: 'bone',
    sources: [
      { ref: 'IOF/ESCEO Guidelines', year: 2020 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['osteopenia', 'osteopenii'] },
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 1000, max: 1500 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sodium', scope: 'DAILY_TOTAL', max: 2300 },
      { type: 'PREFER_PRODUCTS', flagKey: 'highCalcium', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Osteopenia (T-score -1.0 do -2.5): wapń 1000mg/d z diety, D3 800-1000 IU/d, białko 1.0g/kg. Nabiał, ryby z ościami, rośliny strączkowe, orzechy. Sód <2300mg, kofeina <400mg/d. Źródło: IOF/ESCEO 2020', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Osteopenia to stadium przedosteoporotyczne — interwencja dietetyczna może zahamować progresję. DEXA co 1-2 lata.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '800-1000 IU/d', reason: 'Profilaktyka osteoporozy (IOF/ESCEO 2020)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina K2 (MK-7)', dose: '100 µg/d', reason: 'Wsparcie mineralizacji kości' },
    ],
  },
  // 27.9.3 Krzywica
  {
    name: 'Krzywica',
    description: 'Krzywica — D3 400-1000 IU/d (zależnie od wieku), Ca dostosowany do wieku',
    type: 'POLICY', severity: 'MODERATE', priority: 75,
    version: '1.0', category: 'bone',
    sources: [
      { ref: 'ESPGHAN Position Paper', year: 2022 },
      { ref: 'Global Consensus on Rickets', year: 2016 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['krzywica', 'rickets', 'rachitis', 'rachityzm'] },
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'calcium', scope: 'DAILY_TOTAL', min: 500 },
      { type: 'NUTRIENT_LIMIT', nutrient: 'phosphorus', scope: 'DAILY_TOTAL', min: 500 },
      { type: 'PREFER_PRODUCTS', flagKey: 'highCalcium', flagValue: true },
      { type: 'CLINICAL_NOTE', note: 'Krzywica: suplementacja D3 i Ca kluczowa. Dieta: nabiał, jaja, ryby tłuste (łosoś, makrela, sardynki). Ekspozycja słoneczna 15-20 min/d (IV-IX w PL). Źródło: ESPGHAN 2022, Global Consensus 2016', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Fosfor z diety (nabiał, mięso, ryby, jaja). Unikać nadmiaru fitynianów (zboża nienamoczone) — wiążą Ca i P w jelicie.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Krzywica wymaga diagnostyki przyczynowej: niedobór D3, hipofosfatemia, oporność na D3. Plan dietetyczny jest wsparciem — leczenie u pediatry.', category: 'WARNING' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina D3', dose: '400-2000 IU/d (wg wieku)', reason: 'Dawka zależna od wieku: <1r 400IU, 1-10lat 600-1000IU, 10-18lat 800-2000IU (ESPGHAN 2022)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Wapń', dose: 'wg wieku (500-1300 mg/d)', reason: 'Mineralizacja kości (Global Consensus 2016)' },
    ],
  },
];
