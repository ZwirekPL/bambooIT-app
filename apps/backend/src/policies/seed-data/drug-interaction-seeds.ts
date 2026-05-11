import type { RuleSeed } from './types';

export const DRUG_INTERACTION_SEEDS: RuleSeed[] = [
  // ─── 26.13 Drug Interactions ──────────────────────────────────────────────────
  // 26.13.1 Metformina
  {
    name: 'Interakcja: Metformina',
    description: 'Metformina — deplecja witaminy B12, monitoring co 6-12 mies.',
    type: 'POLICY', severity: 'MODERATE', priority: 70,
    version: '1.0', category: 'drug-interaction',
    sources: [
      { ref: 'ADA Standards of Medical Care in Diabetes', year: 2024 },
      { ref: 'Cochrane Systematic Review: Metformin and B12 Deficiency', year: 2022 },
    ],
    conditions: { type: 'HAS_MEDICATION', terms: ['metformin', 'metformina', 'glucophage', 'siofor', 'formetic', 'avamina'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'METFORMINA: deplecja B12 u 10-30% (zaburzenie wchłaniania zależnego od Ca²⁺). Ryzyko rośnie z dawką i czasem (>4 lata). Monitoring B12 co 6-12 mies. OBOWIĄZKOWY. (ADA 2024)', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Dieta bogata w B12: wątróbka, małże, sardynki, łosoś, wołowina, jaja, nabiał. Wegetarianie/weganie → suplementacja OBLIGATORYJNA.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Przyjmować PODCZAS lub PO posiłku (↓ objawy GI). Oddzielnie od dużych dawek błonnika.', category: 'INFO' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12 (metylokobalamina)', dose: '1000 µg/d sublingual', reason: 'Profilaktyka deplecji. Monitoring B12 + MMA co 6-12 mies. (ADA 2024)' },
    ],
  },
  // 26.13.2 Statyny
  {
    name: 'Interakcja: Statyny',
    description: 'Statyny — CoQ10, unikanie grapefruita przy atorwa-/simwastatynie',
    type: 'POLICY', severity: 'MODERATE', priority: 68,
    version: '1.0', category: 'drug-interaction',
    sources: [
      { ref: 'ESC/EAS Guidelines for the Management of Dyslipidaemias', year: 2019 },
      { ref: 'Mayo Clinic: CoQ10 and Statin Myalgia Systematic Review', year: 2023 },
    ],
    conditions: { type: 'HAS_MEDICATION', terms: ['statyn', 'statin', 'atorwastatyn', 'atorvastatin', 'simwastatyn', 'simvastatin', 'rosuwastatyn', 'rosuvastatin', 'lipitor', 'sortis', 'crestor', 'roswera', 'zocor', 'vasilip'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'STATYNY: UNIKAĆ grapefruita przy atorwa-/simwa-/lowastatynie (inhibitor CYP3A4, ↑ stężenie 2-15x). Rosuwa-/prawastatyna — brak interakcji. (ESC/EAS, FDA)', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Statyny mogą ↓ endogenny CoQ10 — rozważyć suplementację przy mialgiach (bóle mięśniowe u 5-29%). (Mayo Clinic Review)', category: 'INFO' },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['grapefruit', 'grejpfrut', 'pomelo', 'pomarańcza sewilska'] },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Koenzym Q10 (ubichinon/ubichinol)', dose: '100-200 mg/d', reason: 'Rozważyć przy mialgiach. Ubichinol — lepsza biodostępność. (Mayo Clinic, ESC)' },
    ],
  },
  // 26.13.3 IPP (inhibitory pompy protonowej)
  {
    name: 'Interakcja: IPP (omeprazol i inne)',
    description: 'IPP — deplecja Mg, B12, Ca przy długotrwałym stosowaniu >1 roku',
    type: 'POLICY', severity: 'MODERATE', priority: 65,
    version: '1.0', category: 'drug-interaction',
    sources: [
      { ref: 'ACG Clinical Guideline: PPI Use', year: 2017 },
      { ref: 'FDA Drug Safety Communication: PPI and Hypomagnesemia', year: 2011 },
    ],
    conditions: { type: 'HAS_MEDICATION', terms: ['omeprazol', 'omeprazole', 'pantoprazol', 'pantoprazole', 'esomeprazol', 'esomeprazole', 'lansoprazol', 'rabeprazol', 'controloc', 'nolpaza', 'helicid', 'losec', 'nexium', 'emanera', 'polprazol'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'IPP (>1 roku): deplecja Mg, B12, Ca. ↑ ryzyko złamań biodra o 25-35%. ↓ wchłanianie niehemowego Fe. (ACG 2017, FDA)', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Wapń: CYTRYNIAN (nie węglan). Dieta bogata w Mg: orzechy, nasiona dyni, ciemna czekolada, szpinak, strączkowe.', category: 'RECOMMENDATION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez (cytrynian/glicynian)', dose: '200-400 mg/d', reason: 'Profilaktyka hipoMg. Monitoring co 6-12 mies. (ACG 2017, FDA)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witamina B12', dose: '1000 µg/d sublingual', reason: 'IPP ↓ uwalnianie B12 z białek. Monitoring co 12 mies. (ACG 2017)' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Wapń (cytrynian wapnia)', dose: '500-1000 mg/d', reason: 'Cytrynian (nie węglan!) — nie wymaga kwasu żołądkowego. (FDA)' },
    ],
  },
  // 26.13.4 Warfaryna / Acenokumarol (VKA)
  {
    name: 'Interakcja: Warfaryna / Acenokumarol (VKA)',
    description: 'Antykoagulanty VKA — STABILNA podaż witaminy K, nie eliminować zielonych warzyw',
    type: 'POLICY', severity: 'HIGH', priority: 85,
    version: '1.0', category: 'drug-interaction',
    sources: [
      { ref: 'ACC/AHA Guideline on Oral Anticoagulation Management', year: 2022 },
      { ref: 'ESC Anticoagulation in Cardiovascular Disease', year: 2022 },
    ],
    conditions: { type: 'HAS_MEDICATION', terms: ['warfaryn', 'warfarin', 'coumadin', 'acenokumarol', 'acenocoumarol', 'sintrom', 'syncumar'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'VKA — KLUCZOWE: STABILNA podaż wit. K! NIE eliminować zielonych warzyw. Nagłe zmiany destabilizują INR. Codziennie PODOBNA ilość. (ACC/AHA 2022)', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Bogate w wit. K (STAŁA ilość): szpinak (483µg/100g), jarmuż (817µg), brokuły, brukselka, natka pietruszki (1640µg!).', category: 'INFO' },
      { type: 'CLINICAL_NOTE', note: 'UNIKAĆ: nagłych zmian diet, alkohol max 1-2/d, żurawina (inhibitor CYP2C9). Suplementy wit. K ZAKAZANE. Zioła: czosnek, żeń-szeń, dziurawiec, miłorząb — ryzykowne.', category: 'WARNING' },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['suplement witaminy k', 'witamina k suplement'] },
    ],
  },
  // 26.13.5 Lewotyroksyna
  {
    name: 'Interakcja: Lewotyroksyna',
    description: 'Lewotyroksyna — 30-60 min przed śniadaniem, unikanie Ca/Fe/soi/kawy w ciągu 4h',
    type: 'POLICY', severity: 'MODERATE', priority: 72,
    version: '1.0', category: 'drug-interaction',
    sources: [
      { ref: 'ATA Guidelines for Hypothyroidism', year: 2014 },
      { ref: 'ETA Guidelines: Levothyroxine Treatment', year: 2023 },
    ],
    conditions: { type: 'HAS_MEDICATION', terms: ['lewotyroksyn', 'levothyroxin', 'l-tyroksyn', 'euthyrox', 'eltroxin', 'letrox', 'eferox', 'synthroid'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'LEWOTYROKSYNA: 30-60 min PRZED śniadaniem, pusty żołądek, szklanka wody. Alt: wieczorem, 3h po posiłku. (ATA 2014, ETA)', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'W ciągu 4h UNIKAĆ (↓ wchłanianie 20-70%): wapń (nabiał, suplementy), żelazo, soja, kawa (↓ 36%), duże dawki błonnika, antacida (Al/Mg).', category: 'RESTRICTION' },
      { type: 'CLINICAL_NOTE', note: 'Plan: Lek → 30-60 min → Śniadanie → Suplementy Ca/Fe w INNEJ porze (min. 4h od leku).', category: 'RECOMMENDATION' },
    ],
  },
  // 26.13.6 Diuretyki
  {
    name: 'Interakcja: Diuretyki',
    description: 'Diuretyki — tiazydowe/pętlowe: deplecja K/Mg; oszczędzające potas: OGRANICZYĆ potas',
    type: 'POLICY', severity: 'MODERATE', priority: 68,
    version: '1.0', category: 'drug-interaction',
    sources: [
      { ref: 'ESC Guidelines for Heart Failure', year: 2023 },
    ],
    conditions: { type: 'HAS_MEDICATION', terms: ['diuretyk', 'diuretic', 'hydrochlorotiazyd', 'furosemid', 'torasemid', 'indapamid', 'spironolakton', 'eplerenon', 'amiloryd', 'lasix', 'trifas', 'aldactone', 'inspra'] },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'DIURETYKI: Tiazydowe/pętlowe → deplecja K/Mg → dieta BOGATA w K/Mg. Oszczędzające potas (spironolakton, eplerenon) → OGRANICZYĆ potas! Typ nieznany → konsultacja z lekarzem. (ESC HF 2023)', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Źródła K: banany (358mg/100g), awokado (485mg), ziemniaki, szpinak, fasola, soczewica, suszone morele. Cel: 3500-4700 mg K/d.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Źródła Mg: migdały (270mg/100g), nasiona dyni (535mg!), ciemna czekolada, szpinak, strączkowe. HipoMg pogłębia hipoK.', category: 'RECOMMENDATION' },
      { type: 'CLINICAL_NOTE', note: 'Ograniczenie K (spironolakton/eplerenon): unikać dużych ilości bananów, suszonych owoców, soków pomidorowych, zamienników soli (KCl!). Max 2000-2500 mg K/d.', category: 'RESTRICTION' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez (cytrynian/glicynian)', dose: '200-400 mg/d', reason: 'Przy tiazydowych/pętlowych. NIE suplementować przy oszczędzających potas bez kontroli. (ESC HF 2023)' },
    ],
  },
];
