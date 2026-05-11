import type { RuleSeed } from './types';

export const INTOLERANCE_SEEDS: RuleSeed[] = [
  // ─── Dodatkowe nietolerancje ────────────────────────────────────────────────
  {
    name: 'Nietolerancja fruktozy',
    description: 'Nietolerancja fruktozy — ograniczenie fruktozy i polioli',
    type: 'POLICY', severity: 'LOW', priority: 90,
    version: '1.0', category: 'intolerance',
    sources: [{ ref: 'DGVS Guideline: Fructose Malabsorption', year: 2014 }],
    conditions: { type: 'HAS_ALLERGY', terms: ['fructose', 'fruktoza'] },
    effects: [
      { type: 'NUTRIENT_LIMIT', nutrient: 'sugar', scope: 'PER_100G', max: 5 },
      { type: 'EXCLUDE_KEYWORDS', keywords: ['miód', 'agawa', 'syrop', 'syrop glukozowo-fruktozowy', 'sok jabłkowy', 'honey', 'agave', 'syrup', 'high fructose corn syrup', 'apple juice'] },
      { type: 'CLINICAL_NOTE', note: 'Nietolerancja fruktozy: ograniczenie fruktozy (<25g/posiłek), unikanie HFCS, miodu, agawy, soku jabłkowego. Owoce o niskiej zawartości fruktozy (banany, jagody, cytrusy) zwykle tolerowane. Źródło: DGVS 2014', category: 'RESTRICTION' },
    ],
  },
  // 27.6.1 Nieceliakalna nadwrażliwość na gluten (NCGS) (NOWA)
  {
    name: 'Nieceliakalna nadwrażliwość na gluten (NCGS)',
    description: 'NCGS — eliminacja glutenu (mniej restrykcyjna niż celiakia), rozważenie low-FODMAP',
    type: 'POLICY', severity: 'LOW', priority: 90,
    version: '1.0', category: 'intolerance',
    sources: [{ ref: 'Salerno Experts\' Criteria for NCGS Diagnosis', year: 2015 }],
    conditions: { type: 'HAS_CONDITION', terms: ['ncgs', 'nadwrażliwość na gluten', 'nieceliakalna', 'non-celiac gluten', 'gluten sensitivity'] },
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
    name: 'Nietolerancja histaminy',
    description: 'Nietolerancja histaminy — eliminacja produktów bogatych w histaminę, suplementacja DAO',
    type: 'POLICY', severity: 'LOW', priority: 85,
    version: '1.0', category: 'intolerance',
    sources: [
      { ref: 'DGAKI Guideline: Management of Histamine Intolerance', year: 2017 },
      { ref: 'Jarisch R. Histamine Intolerance', year: 2015 },
    ],
    conditions: { type: 'HAS_CONDITION', terms: ['histamine', 'histamina', 'nietolerancja histaminy', 'histamine intolerance'] },
    effects: [
      { type: 'EXCLUDE_KEYWORDS', keywords: [
        'parmezan', 'gouda', 'cheddar', 'camembert', 'brie', 'roquefort', 'ser dojrzewający', 'ser pleśniowy',
        'parmesan', 'aged cheese', 'blue cheese',
        'salami', 'kabanos', 'kiełbasa dojrzewająca', 'szynka dojrzewająca', 'chorizo', 'pepperoni',
        'cured meat', 'dry sausage',
        'kiszonka', 'kapusta kiszona', 'kimchi', 'sauerkraut', 'sos sojowy', 'soy sauce', 'ocet', 'vinegar',
        'konserwa rybna', 'sardynka w puszce', 'tuńczyk w puszce', 'śledź marynowany', 'anchois',
        'canned fish', 'canned tuna', 'pickled herring', 'anchovy',
        'wino', 'piwo', 'wino czerwone', 'wine', 'beer', 'red wine',
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
];
