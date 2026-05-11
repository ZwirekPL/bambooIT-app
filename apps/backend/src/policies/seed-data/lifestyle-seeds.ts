import type { RuleSeed } from './types';

export const LIFESTYLE_SEEDS: RuleSeed[] = [
  // ── 31.2.4 Lifestyle Rules ────────────────────────────────────────────────

  // Codzienny alkohol
  {
    name: 'Codzienny alkohol',
    description: 'Codzienny alkohol — ograniczenie cukru, wykluczenie alkoholu z przepisów, nota kliniczna',
    type: 'POLICY', severity: 'MODERATE', priority: 65,
    version: '1.0', category: 'lifestyle',
    sources: [
      { ref: 'WHO Global Status Report on Alcohol and Health', year: 2024 },
      { ref: 'EASL Clinical Practice Guidelines: Alcohol-Related Liver Disease', year: 2018 },
    ],
    conditions: { type: 'FIELD_EQUALS', field: 'alcoholFrequency', value: 'daily' },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Codzienny alkohol: dodatkowe puste kalorie (7 kcal/g), obciążenie wątroby, zaburzenie wchłaniania witamin (B1, B6, B12, kwas foliowy, magnez). Rozważyć redukcję spożycia. Źródło: WHO 2024', category: 'WARNING' },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['alkohol', 'piwo', 'wino', 'wódka', 'drink', 'koktajl', 'beer', 'wine'] },
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'DAILY_TOTAL', max: 20 },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Witaminy z grupy B (kompleks)', dose: 'B1: 50-100 mg/d, B6: 25-50 mg/d', reason: 'Alkohol upośledza wchłanianie witamin B. Przed użyciem suplementu skonsultuj z lekarzem' },
    ],
  },

  // Codzienny alkohol + leki (statyny/metformina)
  {
    name: 'Codzienny alkohol + hepatotoksyczne leki',
    description: 'Codzienny alkohol + statyny/metformina — podwyższone ryzyko hepatotoksyczności',
    type: 'POLICY', severity: 'HIGH', priority: 70,
    version: '1.0', category: 'lifestyle',
    sources: [
      { ref: 'EASL Clinical Practice Guidelines: Drug-Induced Liver Injury', year: 2019 },
      { ref: 'ADA Standards of Medical Care in Diabetes — Pharmacologic Approaches', year: 2024 },
    ],
    conditions: {
      type: 'AND',
      conditions: [
        { type: 'FIELD_EQUALS', field: 'alcoholFrequency', value: 'daily' },
        {
          type: 'OR',
          conditions: [
            { type: 'HAS_MEDICATION', terms: ['statyn', 'atorwastatyn', 'rosuwastatyn', 'simwastatyn', 'statin', 'atorvastatin', 'rosuvastatin', 'simvastatin'] },
            { type: 'HAS_MEDICATION', terms: ['metformin', 'metformina', 'glucophage', 'siofor'] },
          ],
        },
      ],
    },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'UWAGA: Codzienny alkohol + statyny/metformina → podwyższone ryzyko hepatotoksyczności i kwasicy mleczanowej (metformina). Konieczna konsultacja z lekarzem prowadzącym. Źródło: EASL 2019, ADA 2024', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Dieta powinna wspierać funkcję wątroby: ostropest plamisty, kurkuma, warzywa krzyżowe (brokuły, kalafior), unikanie przetworzonej żywności i tłuszczów trans.', category: 'RECOMMENDATION' },
    ],
  },

  // Niedobór snu
  {
    name: 'Niedobór snu',
    description: 'Mniej niż 6h snu — wpływ na insulinooporność, suplementacja, nota kliniczna',
    type: 'POLICY', severity: 'LOW', priority: 55,
    version: '1.0', category: 'lifestyle',
    sources: [
      { ref: 'Sleep Foundation: Sleep and Diet', year: 2024 },
      { ref: 'Spiegel K et al. Impact of sleep debt on metabolic and endocrine function. Lancet', year: 1999 },
      { ref: 'EFSA Scientific Opinion on Magnesium', year: 2015 },
    ],
    conditions: { type: 'FIELD_EQUALS', field: 'sleepHours', value: 'under_6' },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Niedobór snu (<6h): zwiększone ryzyko insulinooporności, podwyższony kortyzol, zwiększony apetyt (wzrost greliny, spadek leptyny). Wieczorne posiłki o niskim IG, unikanie kofeiny po 14:00. Źródło: Spiegel et al. 1999, Sleep Foundation', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Zalecane produkty wieczorem: orzechy (tryptofan), banany, wiśnie (melatonina naturalna), nabiał, ryby tłuste (omega-3). Unikać ciężkich posiłków 2-3h przed snem.', category: 'RECOMMENDATION' },
      { type: 'PREFER_PRODUCTS', flagKey: 'lowSugar', flagValue: true },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez (cytrynian lub bisgicynian)', dose: '300-400 mg/d wieczorem', reason: 'Wspiera jakość snu i relaksację mięśni. Przed użyciem suplementu skonsultuj z lekarzem' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Melatonina', dose: '1-3 mg 30 min przed snem', reason: 'Regulacja rytmu dobowego przy chronicznym niedoborze snu. Przed użyciem suplementu skonsultuj z lekarzem' },
    ],
  },

  // Wysoki stres
  {
    name: 'Wysoki stres',
    description: 'Wysoki/bardzo wysoki stres — wpływ kortyzolu, suplementacja, nota kliniczna',
    type: 'POLICY', severity: 'LOW', priority: 55,
    version: '1.0', category: 'lifestyle',
    sources: [
      { ref: 'Epel E et al. Stress and body shape: cortisol-induced fat storage. Psychoneuroendocrinology', year: 2000 },
      { ref: 'Chandrasekhar K et al. Efficacy of ashwagandha root extract. Indian J Psychol Med', year: 2012 },
      { ref: 'EFSA Scientific Opinion on Magnesium', year: 2015 },
    ],
    conditions: {
      type: 'OR',
      conditions: [
        { type: 'FIELD_EQUALS', field: 'stressLevel', value: 'very_high' },
        { type: 'FIELD_EQUALS', field: 'stressLevel', value: 'high' },
      ],
    },
    effects: [
      { type: 'CLINICAL_NOTE', note: 'Wysoki stres: podwyższony kortyzol sprzyja gromadzeniu tkanki tłuszczowej (brzusznej), jedzeniu kompulsywnemu i insulinooporności. Regularne posiłki co 3-4h, unikanie restrykcyjnych diet. Źródło: Epel et al. 2000', category: 'WARNING' },
      { type: 'CLINICAL_NOTE', note: 'Produkty antystresowe: ryby tłuste (omega-3), orzechy, nasiona, ciemna czekolada (70%+), zielone warzywa liściaste (magnez), fermentowane (probiotyki — oś jelito-mózg).', category: 'RECOMMENDATION' },
      { type: 'PREFER_PRODUCTS', flagKey: 'highFiber', flagValue: true },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Magnez (cytrynian lub bisgicynian)', dose: '300-400 mg/d', reason: 'Regulacja osi HPA, redukcja napięcia. Przed użyciem suplementu skonsultuj z lekarzem' },
      { type: 'SUGGEST_SUPPLEMENT', name: 'Ashwagandha (KSM-66)', dose: '300-600 mg/d', reason: 'Adaptogen — obniża kortyzol o ~30% (Chandrasekhar 2012). Przed użyciem suplementu skonsultuj z lekarzem' },
    ],
  },
];
