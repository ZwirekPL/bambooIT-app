// ─── Seed 20 base NutritionProtocols into DB (28.2) ─────────────────────────
//
// Run: npx ts-node -r tsconfig-paths/register src/policies/seed-protocols.ts
//
// Idempotent: upserts by name, increments version on update.

import { prisma, Prisma } from '@db';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MacroRatio {
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
}

interface MacroRatios {
  REDUCE: MacroRatio;
  GAIN: MacroRatio;
  MAINTAIN: MacroRatio;
}

interface CaloricAdjustments {
  REDUCE: number;
  GAIN: number;
  MAINTAIN: number;
}

interface MealSlot {
  mealName: string;
  pct: number;
}

interface FoodRestriction {
  category: string;
  keywords: string[];
  level: 'HARD_BLOCK' | 'STRONG' | 'SOFT';
  reason: string;
}

interface ProtocolSeed {
  name: string;
  description: string;
  isDefault?: boolean;
  macroRatios: MacroRatios;
  caloricAdjustments: CaloricAdjustments;
  minProteinPerKg?: number;
  maxProteinPerKg?: number;
  defaultMealCount?: number;
  mealDistribution?: MealSlot[];
  foodRestrictions?: FoodRestriction[];
  systemPromptAdditions?: string;
  preferredCuisines?: string[];
  recipeComplexity?: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  avoidFoodCategories?: { category: string; reason: string }[];
}

// ─── Default meal distribution (5 meals) ─────────────────────────────────────

const DEFAULT_5_MEALS: MealSlot[] = [
  { mealName: 'Śniadanie', pct: 25 },
  { mealName: 'Drugie śniadanie', pct: 10 },
  { mealName: 'Obiad', pct: 35 },
  { mealName: 'Podwieczorek', pct: 10 },
  { mealName: 'Kolacja', pct: 20 },
];

const DEFAULT_4_MEALS: MealSlot[] = [
  { mealName: 'Śniadanie', pct: 25 },
  { mealName: 'Drugie śniadanie', pct: 15 },
  { mealName: 'Obiad', pct: 40 },
  { mealName: 'Kolacja', pct: 20 },
];

const DEFAULT_3_MEALS: MealSlot[] = [
  { mealName: 'Śniadanie', pct: 30 },
  { mealName: 'Obiad', pct: 45 },
  { mealName: 'Kolacja', pct: 25 },
];

// ─── 20 base protocols ───────────────────────────────────────────────────────

const PROTOCOL_SEEDS: ProtocolSeed[] = [
  // 28.2.1 Standard WHO (default)
  {
    name: 'Standard WHO',
    description:
      'Zbilansowana dieta zgodna z wytycznymi WHO. Zalecana jako punkt wyjścia dla zdrowych dorosłych bez specjalnych wskazań.',
    isDefault: true,
    macroRatios: {
      REDUCE: { proteinPct: 25, fatPct: 30, carbsPct: 45 },
      GAIN: { proteinPct: 25, fatPct: 30, carbsPct: 45 },
      MAINTAIN: { proteinPct: 20, fatPct: 30, carbsPct: 50 },
    },
    caloricAdjustments: { REDUCE: -15, GAIN: 10, MAINTAIN: 0 },
    minProteinPerKg: 0.8,
    maxProteinPerKg: 1.6,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [],
    systemPromptAdditions:
      'Stosuj wytyczne WHO: różnorodna dieta, dużo warzyw i owoców, produkty pełnoziarniste, ograniczona ilość cukrów prostych i tłuszczów nasyconych.',
    recipeComplexity: 'MODERATE',
  },

  // 28.2.2 Redukcja masy ciała
  {
    name: 'Redukcja masy ciała',
    description:
      'Dieta redukcyjna z wyższą podażą białka dla ochrony masy mięśniowej. Umiarkowany deficyt kaloryczny -15%.',
    macroRatios: {
      REDUCE: { proteinPct: 30, fatPct: 30, carbsPct: 40 },
      GAIN: { proteinPct: 28, fatPct: 30, carbsPct: 42 },
      MAINTAIN: { proteinPct: 25, fatPct: 30, carbsPct: 45 },
    },
    caloricAdjustments: { REDUCE: -15, GAIN: 5, MAINTAIN: 0 },
    minProteinPerKg: 1.2,
    maxProteinPerKg: 2.0,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Cukry proste i słodycze',
        keywords: ['słodycze', 'cukier', 'miód', 'syrop', 'ciastka', 'ciasto', 'czekolada'],
        level: 'STRONG',
        reason: 'Wysokie spożycie cukrów prostych utrudnia redukcję masy ciała',
      },
    ],
    systemPromptAdditions:
      'Priorytet: sytość przy niskiej kaloryczności. Stosuj produkty wysokobiałkowe, błonnik pokarmowy, unikaj przetworzonej żywności i cukrów prostych. Porcje kontrolowane.',
    recipeComplexity: 'SIMPLE',
  },

  // 28.2.3 Masa mięśniowa / sportowiec
  {
    name: 'Masa mięśniowa / Sportowiec',
    description:
      'Dieta hiperkaloryczna dla osób aktywnych fizycznie budujących masę mięśniową. Wysoka podaż białka.',
    macroRatios: {
      REDUCE: { proteinPct: 30, fatPct: 25, carbsPct: 45 },
      GAIN: { proteinPct: 30, fatPct: 25, carbsPct: 45 },
      MAINTAIN: { proteinPct: 28, fatPct: 27, carbsPct: 45 },
    },
    caloricAdjustments: { REDUCE: 0, GAIN: 12, MAINTAIN: 5 },
    minProteinPerKg: 1.6,
    maxProteinPerKg: 2.5,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [],
    systemPromptAdditions:
      'Dieta dla sportowców: wysoka podaż białka pełnowartościowego (mięso, nabiał, jaja, rośliny strączkowe). Węglowodany złożone jako główne źródło energii. Posiłek potreningowy bogaty w białko i węglowodany.',
    recipeComplexity: 'MODERATE',
  },

  // 28.2.4 Cukrzyca typ 2 / Insulinooporność
  {
    name: 'Cukrzyca typ 2 / Insulinooporność',
    description:
      'Dieta niskoglikemiczna dla pacjentów z cukrzycą typu 2 lub insulinoopornością. Ograniczenie cukrów prostych i wysokoglikemicznych węglowodanów.',
    macroRatios: {
      REDUCE: { proteinPct: 25, fatPct: 35, carbsPct: 40 },
      GAIN: { proteinPct: 25, fatPct: 35, carbsPct: 40 },
      MAINTAIN: { proteinPct: 25, fatPct: 35, carbsPct: 40 },
    },
    caloricAdjustments: { REDUCE: -15, GAIN: 5, MAINTAIN: 0 },
    minProteinPerKg: 1.0,
    maxProteinPerKg: 1.8,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Cukry proste',
        keywords: [
          'cukier',
          'syrop glukozowo-fruktozowy',
          'słodycze',
          'ciastka',
          'dżem',
          'miód',
          'napoje słodzone',
          'sok owocowy',
        ],
        level: 'HARD_BLOCK',
        reason: 'Powodują gwałtowny wzrost glikemii — bezwzględnie przeciwwskazane w cukrzycy t.2',
      },
      {
        category: 'Produkty wysokoglikemiczne',
        keywords: ['biały chleb', 'bułka', 'biały ryż', 'ziemniaki', 'frytki', 'płatki kukurydziane'],
        level: 'STRONG',
        reason: 'Wysoki indeks glikemiczny — należy zastąpić produktami pełnoziarnistymi',
      },
    ],
    systemPromptAdditions:
      'Stosuj produkty o niskim IG (<55): pełnoziarniste, warzywa nieskrobiowe, rośliny strączkowe. Regularność posiłków co 3-4h. Ogranicz owoce do 2 porcji/dobę (wybieraj o niskim IG). Błonnik przy każdym posiłku.',
    recipeComplexity: 'MODERATE',
    avoidFoodCategories: [
      { category: 'Napoje słodzone', reason: 'Gwałtowny wzrost glikemii' },
      { category: 'Wyroby cukiernicze', reason: 'Wysoka zawartość cukrów prostych' },
    ],
  },

  // 28.2.5 Choroby sercowo-naczyniowe (DASH)
  {
    name: 'Choroby sercowo-naczyniowe (DASH)',
    description:
      'Dieta DASH (Dietary Approaches to Stop Hypertension) dla pacjentów z nadciśnieniem i chorobami serca. Ograniczenie sodu, tłuszczów nasyconych i trans.',
    macroRatios: {
      REDUCE: { proteinPct: 20, fatPct: 28, carbsPct: 52 },
      GAIN: { proteinPct: 20, fatPct: 28, carbsPct: 52 },
      MAINTAIN: { proteinPct: 20, fatPct: 28, carbsPct: 52 },
    },
    caloricAdjustments: { REDUCE: -10, GAIN: 5, MAINTAIN: 0 },
    minProteinPerKg: 0.8,
    maxProteinPerKg: 1.5,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Tłuszcze trans',
        keywords: ['margaryna twarda', 'tłuszcze utwardzone', 'częściowo uwodornione', 'fast food'],
        level: 'HARD_BLOCK',
        reason: 'Tłuszcze trans zwiększają ryzyko sercowo-naczyniowe',
      },
      {
        category: 'Produkty wysokosodowe',
        keywords: ['sól', 'słone przekąski', 'wędliny', 'konserwy', 'kostki rosołowe', 'sosy instant'],
        level: 'STRONG',
        reason: 'Wysoka zawartość sodu nasila nadciśnienie',
      },
    ],
    systemPromptAdditions:
      'Dieta DASH: ogranicz sód do 2300mg/dobę (docelowo 1500mg). Bogate w potas (banany, ziemniaki, fasola), magnez i wapń. Preferuj ryby (zwłaszcza tłuste morskie — omega-3), drób, rośliny strączkowe. Dużo warzyw i owoców.',
    preferredCuisines: ['śródziemnomorska', 'polska'],
    recipeComplexity: 'MODERATE',
  },

  // 28.2.6 Dieta śródziemnomorska
  {
    name: 'Dieta śródziemnomorska',
    description:
      'Dieta oparta na wytycznych diety śródziemnomorskiej — bogate w oliwę z oliwek, ryby, warzywa, owoce i produkty pełnoziarniste.',
    macroRatios: {
      REDUCE: { proteinPct: 18, fatPct: 38, carbsPct: 44 },
      GAIN: { proteinPct: 20, fatPct: 38, carbsPct: 42 },
      MAINTAIN: { proteinPct: 18, fatPct: 38, carbsPct: 44 },
    },
    caloricAdjustments: { REDUCE: -12, GAIN: 10, MAINTAIN: 0 },
    minProteinPerKg: 0.8,
    maxProteinPerKg: 1.6,
    defaultMealCount: 4,
    mealDistribution: DEFAULT_4_MEALS,
    foodRestrictions: [
      {
        category: 'Przetworzona żywność',
        keywords: ['fast food', 'dania instant', 'chipsy', 'hot dog'],
        level: 'SOFT',
        reason: 'Niezgodna z zasadami diety śródziemnomorskiej',
      },
    ],
    systemPromptAdditions:
      'Kuchnia śródziemnomorska: oliwa z oliwek jako główny tłuszcz, ryby (łosoś, sardynki, tuńczyk) min. 2x/tydz., dużo warzyw i ziół aromatycznych, produkty pełnoziarniste, rośliny strączkowe, czerwone wino opcjonalnie w umiarkowanych ilościach.',
    preferredCuisines: ['śródziemnomorska', 'grecka', 'włoska', 'hiszpańska'],
    recipeComplexity: 'MODERATE',
  },

  // 28.2.7 Keto terapeutyczne
  {
    name: 'Keto terapeutyczne',
    description:
      'Dieta ketogeniczna z bardzo niską zawartością węglowodanów (5%). Stosowana w epilepsji lekoopornej, niektórych nowotworach, insulinooporności. Wymaga nadzoru lekarskiego.',
    macroRatios: {
      REDUCE: { proteinPct: 20, fatPct: 75, carbsPct: 5 },
      GAIN: { proteinPct: 20, fatPct: 75, carbsPct: 5 },
      MAINTAIN: { proteinPct: 20, fatPct: 75, carbsPct: 5 },
    },
    caloricAdjustments: { REDUCE: -10, GAIN: 10, MAINTAIN: 0 },
    minProteinPerKg: 1.0,
    maxProteinPerKg: 1.8,
    defaultMealCount: 3,
    mealDistribution: DEFAULT_3_MEALS,
    foodRestrictions: [
      {
        category: 'Węglowodany',
        keywords: [
          'chleb',
          'ryż',
          'makaron',
          'ziemniaki',
          'kasza',
          'owoce',
          'cukier',
          'miód',
          'sok',
          'płatki owsiane',
          'kukurydza',
        ],
        level: 'HARD_BLOCK',
        reason: 'Dieta keto wymaga <50g węglowodanów/dobę — produkty węglowodanowe zaburzają ketozę',
      },
    ],
    systemPromptAdditions:
      'DIETA KETOGENICZNA: maks. 50g węglowodanów netto/dobę (docelowo 20-30g). Główne tłuszcze: olej kokosowy, masło klarowane, oliwa, awokado, orzechy. Białko umiarkowane — nadmiar hamuje ketozę. Uzupełniaj elektrolity (sód, potas, magnez).',
    recipeComplexity: 'MODERATE',
    avoidFoodCategories: [
      { category: 'Produkty zbożowe', reason: 'Zbyt wysoka zawartość węglowodanów' },
      { category: 'Większość owoców', reason: 'Zbyt wysoka zawartość fruktozy/cukrów' },
    ],
  },

  // 28.2.8 Bariatria pooperacyjna
  {
    name: 'Bariatria pooperacyjna',
    description:
      'Dieta po operacji bariatrycznej (bypass żołądka, rękawowa resekcja). Zmniejszona pojemność żołądka, ryzyko zespołu dumping. Wysoka podaż białka przy małej objętości.',
    macroRatios: {
      REDUCE: { proteinPct: 40, fatPct: 30, carbsPct: 30 },
      GAIN: { proteinPct: 40, fatPct: 30, carbsPct: 30 },
      MAINTAIN: { proteinPct: 35, fatPct: 30, carbsPct: 35 },
    },
    caloricAdjustments: { REDUCE: -25, GAIN: 0, MAINTAIN: -15 },
    minProteinPerKg: 1.5,
    maxProteinPerKg: 2.1,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Cukry proste i słodkie napoje',
        keywords: ['cukier', 'słodycze', 'napoje słodzone', 'sok', 'miód', 'syrop'],
        level: 'HARD_BLOCK',
        reason: 'Ryzyko zespołu dumping — gwałtowny napływ cukrów do jelita cienkiego',
      },
      {
        category: 'Tłuste i smażone potrawy',
        keywords: ['smażone', 'tłuste mięso', 'frytki', 'boczek'],
        level: 'STRONG',
        reason: 'Trudne do strawienia po operacji bariatrycznej — ryzyko nietolerancji',
      },
    ],
    systemPromptAdditions:
      'BARIATRIA: małe porcje (150-200ml/posiłek). Białko jako priorytet każdego posiłku. Nie pić podczas jedzenia (30 min przed/po). Produkty miękkie, dobrze przetworzone. Suplementacja: wit. B12, żelazo, wapń, wit. D — obowiązkowo.',
    recipeComplexity: 'SIMPLE',
  },

  // 28.2.9 Hipercholesterolemia
  {
    name: 'Hipercholesterolemia',
    description:
      'Dieta obniżająca stężenie LDL-cholesterolu. Ograniczenie tłuszczów nasyconych, trans i cholesterolu pokarmowego.',
    macroRatios: {
      REDUCE: { proteinPct: 20, fatPct: 25, carbsPct: 55 },
      GAIN: { proteinPct: 20, fatPct: 25, carbsPct: 55 },
      MAINTAIN: { proteinPct: 20, fatPct: 25, carbsPct: 55 },
    },
    caloricAdjustments: { REDUCE: -10, GAIN: 5, MAINTAIN: 0 },
    minProteinPerKg: 0.8,
    maxProteinPerKg: 1.5,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Tłuszcze nasycone',
        keywords: [
          'masło',
          'smalec',
          'tłuste mięso',
          'boczek',
          'kiełbasa',
          'pełnotłuste sery',
          'śmietana',
          'kokos',
          'olej palmowy',
        ],
        level: 'HARD_BLOCK',
        reason:
          'Tłuszcze nasycone >10% energii znacząco podwyższają LDL-cholesterol — kluczowe ograniczenie w hipercholesterolemii',
      },
      {
        category: 'Tłuszcze trans',
        keywords: ['margaryna twarda', 'tłuszcze utwardzone', 'fast food'],
        level: 'HARD_BLOCK',
        reason: 'Tłuszcze trans podwyższają LDL i obniżają HDL',
      },
    ],
    systemPromptAdditions:
      'Dieta hipolipemizująca: sterole roślinne (margaryny funkcjonalne), błonnik rozpuszczalny (owies, jabłka, fasola) — obniżają LDL. Preferuj ryby tłuste (omega-3), oliwę, awokado, orzechy włoskie. Ogranicz czerwone mięso do 1x/tydz.',
    recipeComplexity: 'MODERATE',
  },

  // 28.2.10 NAFLD / Stłuszczenie wątroby
  {
    name: 'NAFLD / Stłuszczenie wątroby',
    description:
      'Dieta dla pacjentów z niealkoholowym stłuszczeniem wątroby (NAFLD/MASLD). Ograniczenie fruktozy, alkoholu i kalorii.',
    macroRatios: {
      REDUCE: { proteinPct: 28, fatPct: 27, carbsPct: 45 },
      GAIN: { proteinPct: 25, fatPct: 27, carbsPct: 48 },
      MAINTAIN: { proteinPct: 25, fatPct: 27, carbsPct: 48 },
    },
    caloricAdjustments: { REDUCE: -10, GAIN: 3, MAINTAIN: 0 },
    minProteinPerKg: 1.0,
    maxProteinPerKg: 1.8,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Fruktoza i syropy',
        keywords: ['syrop fruktozowy', 'syrop glukozowo-fruktozowy', 'napoje słodzone', 'soki owocowe', 'fruktoza'],
        level: 'HARD_BLOCK',
        reason: 'Fruktoza jest metabolizowana wyłącznie przez wątrobę i bezpośrednio nasila stłuszczenie',
      },
      {
        category: 'Alkohol',
        keywords: ['alkohol', 'wino', 'piwo', 'wódka'],
        level: 'HARD_BLOCK',
        reason: 'Alkohol jest hepatotoksyczny i nasila NAFLD',
      },
      {
        category: 'Przetworzona żywność wysokotłuszczowa',
        keywords: ['fast food', 'chipsy', 'frytki', 'tłuste mięso przetworzone'],
        level: 'STRONG',
        reason: 'Nadmiar tłuszczów nasyconych nasila stłuszczenie wątroby',
      },
    ],
    systemPromptAdditions:
      'NAFLD: kawa (2-3 filiżanki/dobę) ma działanie hepatoprotekcyjne — można zalecać. Oliwa z oliwek, witamina E (orzechy, nasiona). Błonnik i warzywa. Ograniczyć czerwone mięso.',
    recipeComplexity: 'MODERATE',
  },

  // 28.2.11 Hashimoto / Niedoczynność tarczycy
  {
    name: 'Hashimoto / Niedoczynność tarczycy',
    description:
      'Dieta dla pacjentów z chorobą Hashimoto i niedoczynnością tarczycy. Uwaga na goitrogeny i soję.',
    macroRatios: {
      REDUCE: { proteinPct: 22, fatPct: 33, carbsPct: 45 },
      GAIN: { proteinPct: 22, fatPct: 33, carbsPct: 45 },
      MAINTAIN: { proteinPct: 22, fatPct: 33, carbsPct: 45 },
    },
    caloricAdjustments: { REDUCE: -10, GAIN: 5, MAINTAIN: 0 },
    minProteinPerKg: 0.8,
    maxProteinPerKg: 1.6,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Soja i produkty sojowe',
        keywords: ['soja', 'tofu', 'tempeh', 'mleko sojowe', 'izoflawonoidy sojowe', 'edamame'],
        level: 'STRONG',
        reason:
          'Izoflawony sojowe mogą hamować wchłanianie lewotyroksyny i wpływać na syntezę hormonów tarczycy',
      },
      {
        category: 'Surowe warzywa krzyżowe',
        keywords: [
          'surowa kapusta',
          'surowy brokuł',
          'surowa brukselka',
          'surowa kalafior',
          'surowa rzodkiewka',
          'surowy jarmuż',
        ],
        level: 'STRONG',
        reason: 'Surowe goitrogeny mogą hamować syntezę hormonów tarczycy — gotowanie dezaktywuje goitrogeny',
      },
    ],
    systemPromptAdditions:
      'Hashimoto: selen (orzechy brazylijskie, ryby morskie) i jod (ryby, nabiał) ważne dla funkcji tarczycy. Warzywa krzyżowe podawaj GOTOWANE — gotowanie dezaktywuje goitrogeny. Suplement witaminy D często konieczny.',
    recipeComplexity: 'MODERATE',
  },

  // 28.2.12 Dna moczanowa
  {
    name: 'Dna moczanowa',
    description:
      'Dieta niskopurynowa dla pacjentów z dną moczanową lub hiperurykemią. Ograniczenie pokarmów bogatych w puryny.',
    macroRatios: {
      REDUCE: { proteinPct: 18, fatPct: 30, carbsPct: 52 },
      GAIN: { proteinPct: 18, fatPct: 30, carbsPct: 52 },
      MAINTAIN: { proteinPct: 18, fatPct: 30, carbsPct: 52 },
    },
    caloricAdjustments: { REDUCE: -12, GAIN: 5, MAINTAIN: 0 },
    minProteinPerKg: 0.8,
    maxProteinPerKg: 1.2,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Produkty bardzo wysokopurynowe',
        keywords: ['podroby', 'wątróbka', 'nerki', 'serce', 'mózg', 'sardynki', 'szproty', 'śledź', 'małże', 'krewetki', 'owoce morza'],
        level: 'HARD_BLOCK',
        reason: 'Bardzo wysoka zawartość puryn (>300mg/100g) — gwałtownie podnosi kwas moczowy',
      },
      {
        category: 'Czerwone mięso i dziczyzna',
        keywords: ['wołowina', 'wieprzowina', 'baranina', 'dziczyzna', 'gęś', 'kaczka'],
        level: 'STRONG',
        reason: 'Wysoka zawartość puryn — ograniczyć do maks. 2x/tydz.',
      },
      {
        category: 'Alkohol',
        keywords: ['piwo', 'alkohol', 'wódka', 'wino'],
        level: 'HARD_BLOCK',
        reason: 'Alkohol (zwłaszcza piwo) zwiększa syntezę kwasu moczowego i hamuje jego wydalanie',
      },
    ],
    systemPromptAdditions:
      'Dna moczanowa: duże ilości wody (min. 2-3l/dobę). Witamina C może obniżać kwas moczowy. Produkty mleczne (odtłuszczone) mają efekt urykozuryczny. Wiśnie i czarne jagody — potencjalnie korzystne.',
    recipeComplexity: 'SIMPLE',
  },

  // 28.2.13 IBD — Crohn / WZJG
  {
    name: 'IBD — Choroba Leśniowskiego-Crohna / WZJG',
    description:
      'Dieta dla pacjentów z nieswoistymi chorobami zapalnymi jelit (IBD). Różnicowanie faza rzutu vs. remisja.',
    macroRatios: {
      REDUCE: { proteinPct: 30, fatPct: 30, carbsPct: 40 },
      GAIN: { proteinPct: 30, fatPct: 30, carbsPct: 40 },
      MAINTAIN: { proteinPct: 28, fatPct: 30, carbsPct: 42 },
    },
    caloricAdjustments: { REDUCE: 5, GAIN: 15, MAINTAIN: 5 },
    minProteinPerKg: 1.2,
    maxProteinPerKg: 1.8,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Błonnik nierozpuszczalny (faza rzutu)',
        keywords: [
          'surowe warzywa',
          'surowe owoce ze skórką',
          'pełnoziarniste',
          'orzechy',
          'nasiona',
          'kukurydza',
          'grzyby',
        ],
        level: 'HARD_BLOCK',
        reason: 'Błonnik nierozpuszczalny drażni zapalnie zmienioną śluzówkę jelita w fazie rzutu IBD',
      },
      {
        category: 'Potrawy tłuste i smażone',
        keywords: ['smażone', 'fast food', 'tłuste sosy', 'boczek', 'słonina'],
        level: 'STRONG',
        reason: 'Tłuste potrawy nasilają biegunkę i dolegliwości w IBD',
      },
    ],
    systemPromptAdditions:
      'IBD: w fazie rzutu — dieta lekkostrawna, gotowana, produkty miękkie i dobrze rozdrobnione. W remisji — stopniowe rozszerzanie. Omega-3 (łosoś, siemię lniane) — efekt przeciwzapalny. Probiotyki przy WZJG.',
    recipeComplexity: 'SIMPLE',
  },

  // 28.2.14 IBS — Low-FODMAP
  {
    name: 'IBS — Dieta Low-FODMAP',
    description:
      'Dieta o niskiej zawartości fermentowalnych oligo-, di-, monosacharydów i polioli (FODMAP) dla pacjentów z IBS.',
    macroRatios: {
      REDUCE: { proteinPct: 20, fatPct: 30, carbsPct: 50 },
      GAIN: { proteinPct: 20, fatPct: 30, carbsPct: 50 },
      MAINTAIN: { proteinPct: 20, fatPct: 30, carbsPct: 50 },
    },
    caloricAdjustments: { REDUCE: -10, GAIN: 5, MAINTAIN: 0 },
    minProteinPerKg: 0.8,
    maxProteinPerKg: 1.5,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Wysokie FODMAP — warzywa i owoce',
        keywords: [
          'cebula',
          'czosnek',
          'por',
          'szalotka',
          'jabłko',
          'gruszka',
          'mango',
          'arbuz',
          'wiśnie',
          'brzoskwinia',
          'nektaryna',
          'suszony owoc',
        ],
        level: 'HARD_BLOCK',
        reason: 'Zawierają wysokie FODMAP fermentowane przez bakterie jelitowe — wywołują wzdęcia i bóle w IBS',
      },
      {
        category: 'Wysokie FODMAP — produkty zbożowe',
        keywords: ['pszenica', 'żyto', 'chleb pszenny', 'makaron pszenny'],
        level: 'HARD_BLOCK',
        reason: 'Fruktany pszenicy i żyta są silnymi FODMAP wyzwalającymi objawy IBS',
      },
      {
        category: 'Nabiał z laktozą',
        keywords: ['mleko krowie', 'jogurt pełnotłusty', 'lody', 'miękkie sery', 'twaróg'],
        level: 'STRONG',
        reason: 'Laktoza jest FODMAP — zastąp produktami bezlaktozowymi lub roślinnymi',
      },
    ],
    systemPromptAdditions:
      'Low-FODMAP: preferuj zielone (niskie FODMAP) warzywa — marchew, cukinia, papryka, szpinak, pomidory, ogórek. Owoce: banany, truskawki, winogrona, kiwi. Ryż, owies, ziemniaki jako bezpieczne źródła węglowodanów. Nabiał bezlaktozowy.',
    recipeComplexity: 'MODERATE',
    avoidFoodCategories: [
      { category: 'Produkty fermentowane zawierające FODMAP', reason: 'Fermentacja nasila FODMAP' },
    ],
  },

  // 28.2.15 Osteoporoza
  {
    name: 'Osteoporoza',
    description:
      'Dieta bogata w wapń i witaminę D dla pacjentów z osteoporozą lub osteopenią. Ochrona masy kostnej.',
    macroRatios: {
      REDUCE: { proteinPct: 25, fatPct: 30, carbsPct: 45 },
      GAIN: { proteinPct: 25, fatPct: 30, carbsPct: 45 },
      MAINTAIN: { proteinPct: 25, fatPct: 30, carbsPct: 45 },
    },
    caloricAdjustments: { REDUCE: -10, GAIN: 5, MAINTAIN: 0 },
    minProteinPerKg: 1.0,
    maxProteinPerKg: 1.6,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Alkohol i kawa w nadmiarze',
        keywords: ['alkohol', 'wódka', 'piwo', 'wino'],
        level: 'STRONG',
        reason: 'Nadmiar alkoholu zaburza metabolizm wapnia i aktywność osteoblastów',
      },
      {
        category: 'Sól w nadmiarze',
        keywords: ['słone przekąski', 'chipsy', 'krakersy', 'sosy solone', 'konserwy'],
        level: 'SOFT',
        reason: 'Wysokie spożycie sodu zwiększa wydalanie wapnia z moczem',
      },
    ],
    systemPromptAdditions:
      'Osteoporoza: priorytet wapń (1000-1200mg/dobę) — nabiał, ryby z ośćmi (sardynki), zielone warzywa, tofu na wapniu. Witamina D (tłuste ryby, jaja, suplementacja). Witamina K2 (fermentowane produkty). Białko konieczne dla mineralnego szkieletu.',
    recipeComplexity: 'MODERATE',
  },

  // 28.2.16 Seniorzy / Sarkopenia
  {
    name: 'Seniorzy / Sarkopenia',
    description:
      'Dieta dla osób starszych z sarkopenią lub ryzykiem sarkopenii. Zwiększona podaż białka, łatwostrawna.',
    macroRatios: {
      REDUCE: { proteinPct: 30, fatPct: 30, carbsPct: 40 },
      GAIN: { proteinPct: 30, fatPct: 30, carbsPct: 40 },
      MAINTAIN: { proteinPct: 30, fatPct: 30, carbsPct: 40 },
    },
    caloricAdjustments: { REDUCE: -5, GAIN: 10, MAINTAIN: 0 },
    minProteinPerKg: 1.5,
    maxProteinPerKg: 2.0,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Trudne do gryzienia i trawienia',
        keywords: ['surowe warzywa twarde', 'suchy chleb razowy', 'twarde mięso'],
        level: 'SOFT',
        reason: 'Seniorzy mogą mieć problemy z gryzieniem i trawieniem twardych pokarmów',
      },
    ],
    systemPromptAdditions:
      'SENIORZY: porcje białkowe (25-30g leucyny bogatego białka) przy każdym posiłku — stymulacja syntezy mięśniowej. Produkty miękkie, lekkostrawne. Wapń i wit. D priorytetowe. Nawodnienie szczególnie ważne (seniorzy mają osłabione uczucie pragnienia).',
    recipeComplexity: 'SIMPLE',
  },

  // 28.2.17 Ciąża
  {
    name: 'Ciąża',
    description:
      'Dieta dla kobiet w ciąży — zwiększone zapotrzebowanie na kwas foliowy, żelazo, DHA, wapń i jod. Bez alkoholu i produktów ryzykownych.',
    macroRatios: {
      REDUCE: { proteinPct: 22, fatPct: 30, carbsPct: 48 },
      GAIN: { proteinPct: 22, fatPct: 30, carbsPct: 48 },
      MAINTAIN: { proteinPct: 22, fatPct: 30, carbsPct: 48 },
    },
    caloricAdjustments: { REDUCE: 10, GAIN: 15, MAINTAIN: 10 },
    minProteinPerKg: 1.1,
    maxProteinPerKg: 1.6,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Alkohol',
        keywords: ['alkohol', 'wino', 'piwo', 'wódka', 'szampan'],
        level: 'HARD_BLOCK',
        reason: 'Alkohol jest teratogenny — bezwzględnie przeciwwskazany w ciąży',
      },
      {
        category: 'Surowe mięso i ryby',
        keywords: ['surowe mięso', 'sushi', 'tatar', 'carpaccio', 'surowa ryba', 'wędzonki surowe'],
        level: 'HARD_BLOCK',
        reason: 'Ryzyko listerozy, toksoplazmozy i salmonelli — niebezpieczne dla płodu',
      },
      {
        category: 'Niepasteryzowane produkty',
        keywords: ['niepasteryzowany ser', 'brie', 'camembert', 'ser pleśniowy', 'niepasteryzowane mleko'],
        level: 'HARD_BLOCK',
        reason: 'Ryzyko listerozy — szczególnie niebezpieczne w ciąży',
      },
      {
        category: 'Ryby drapieżne bogate w rtęć',
        keywords: ['tuńczyk', 'miecznik', 'rekin', 'makrela królewska'],
        level: 'STRONG',
        reason: 'Wysoka zawartość rtęci — neurotoksyczna dla rozwijającego się płodu',
      },
    ],
    systemPromptAdditions:
      'CIĄŻA: kwas foliowy (szpinak, szparagi, fasola, fortyfikowane produkty), żelazo (mięso czerwone, fasola, żółtko), DHA (łosoś, sardynki — max 2 porcje/tydz.), wapń, jod (ryby, nabiał). Unikaj surowych jaj, dużych ilości wątróbki (wit. A teratogenna w nadmiarze).',
    recipeComplexity: 'MODERATE',
  },

  // 28.2.18 Onkologia — wsparcie żywieniowe
  {
    name: 'Onkologia — wsparcie żywieniowe',
    description:
      'Dieta dla pacjentów onkologicznych w trakcie lub po leczeniu. Priorytet: zapobieganie kacheksji, ochrona masy ciała, wsparcie układu odpornościowego.',
    macroRatios: {
      REDUCE: { proteinPct: 30, fatPct: 35, carbsPct: 35 },
      GAIN: { proteinPct: 30, fatPct: 35, carbsPct: 35 },
      MAINTAIN: { proteinPct: 28, fatPct: 32, carbsPct: 40 },
    },
    caloricAdjustments: { REDUCE: 15, GAIN: 20, MAINTAIN: 10 },
    minProteinPerKg: 1.2,
    maxProteinPerKg: 2.0,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Alkohol',
        keywords: ['alkohol', 'wino', 'piwo', 'wódka'],
        level: 'HARD_BLOCK',
        reason: 'Alkohol jest karcynogenem i zaburza metabolizm podczas leczenia onkologicznego',
      },
      {
        category: 'Przetworzone mięso',
        keywords: ['hot dog', 'parówki', 'kiełbasa wędzona', 'bekon', 'salami', 'mortadela'],
        level: 'STRONG',
        reason: 'Przetworzone mięso zakwalifikowane przez IARC jako karcynogen grupy 1',
      },
    ],
    systemPromptAdditions:
      'ONKOLOGIA: zapobiegaj kacheksji — bogate w energię i białko. Omega-3 (łosoś, siemię lniane) mają efekt przeciwkachektyczny. Antyoksydanty (warzywa, owoce kolorowe). W trakcie chemioterapii — lekkostrawne, małe porcje, unikaj ostrych zapachów. Suplementacja wg zaleceń onkologa.',
    recipeComplexity: 'SIMPLE',
  },

  // 28.2.19 Niedokrwistość (niedobór żelaza)
  {
    name: 'Niedokrwistość z niedoboru żelaza',
    description:
      'Dieta bogata w żelazo hemowe i zwiększająca jego wchłanianie. Ograniczenie inhibitorów wchłaniania żelaza.',
    macroRatios: {
      REDUCE: { proteinPct: 25, fatPct: 28, carbsPct: 47 },
      GAIN: { proteinPct: 25, fatPct: 28, carbsPct: 47 },
      MAINTAIN: { proteinPct: 25, fatPct: 28, carbsPct: 47 },
    },
    caloricAdjustments: { REDUCE: -10, GAIN: 5, MAINTAIN: 0 },
    minProteinPerKg: 1.0,
    maxProteinPerKg: 1.6,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [
      {
        category: 'Inhibitory wchłaniania żelaza',
        keywords: ['herbata', 'kawa', 'kakao'],
        level: 'SOFT',
        reason: 'Taniny i polifenole herbaty/kawy blokują wchłanianie żelaza — nie spożywać razem z posiłkami bogatymi w żelazo',
      },
    ],
    systemPromptAdditions:
      'Niedokrwistość z niedoboru Fe: priorytet żelazo hemowe (wołowina, wątróbka kurczaka, jagnięcina). Witamina C przy każdym posiłku z żelazem (zwiększa wchłanianie 3-krotnie). Herbata/kawa min. 1h od posiłku z żelazem. Żelazo niehemowe: fasola, soczewica, szpinak, pestki dyni.',
    recipeComplexity: 'MODERATE',
  },

  // 28.2.20 Niedowaga / Wzrost masy
  {
    name: 'Niedowaga / Wzrost masy ciała',
    description:
      'Dieta hiperkaloryczna dla osób z niedowagą (BMI <18.5) lub potrzebujących zwiększenia masy ciała.',
    macroRatios: {
      REDUCE: { proteinPct: 22, fatPct: 32, carbsPct: 46 },
      GAIN: { proteinPct: 22, fatPct: 32, carbsPct: 46 },
      MAINTAIN: { proteinPct: 20, fatPct: 30, carbsPct: 50 },
    },
    caloricAdjustments: { REDUCE: 10, GAIN: 20, MAINTAIN: 10 },
    minProteinPerKg: 1.0,
    maxProteinPerKg: 1.8,
    defaultMealCount: 5,
    mealDistribution: DEFAULT_5_MEALS,
    foodRestrictions: [],
    systemPromptAdditions:
      'NIEDOWAGA: zwiększ kaloryczność przez bogate w energię produkty: orzechy, awokado, oliwa, nasiona, masło orzechowe, suszone owoce, pełnoziarniste produkty. Dodaj przekąski między posiłkami. Unikaj "pustych kalorii" — priorytet odżywcze produkty wysokoenergetyczne.',
    recipeComplexity: 'MODERATE',
  },
];

// ─── Seed function ────────────────────────────────────────────────────────────

async function seedProtocols(): Promise<void> {
  console.log(`Seeding ${PROTOCOL_SEEDS.length} nutrition protocols...`);

  let created = 0;
  let updated = 0;

  for (const seed of PROTOCOL_SEEDS) {
    const existing = await prisma.nutritionProtocol.findFirst({
      where: { name: seed.name, scope: 'GLOBAL' },
    });

    const data = {
      name: seed.name,
      description: seed.description,
      scope: 'GLOBAL' as const,
      isDefault: seed.isDefault ?? false,
      isActive: true,
      macroRatios: seed.macroRatios as unknown as Prisma.InputJsonValue,
      bmrFormula: 'MIFFLIN' as const,
      caloricAdjustments: seed.caloricAdjustments as unknown as Prisma.InputJsonValue,
      minProteinPerKg: seed.minProteinPerKg ?? 0.8,
      maxProteinPerKg: seed.maxProteinPerKg ?? 2.5,
      defaultMealCount: seed.defaultMealCount ?? 5,
      mealDistribution: (seed.mealDistribution ?? DEFAULT_5_MEALS) as unknown as Prisma.InputJsonValue,
      foodRestrictions: (seed.foodRestrictions ?? []) as unknown as Prisma.InputJsonValue,
      systemPromptAdditions: seed.systemPromptAdditions ?? null,
      preferredCuisines: seed.preferredCuisines ?? [],
      recipeComplexity: seed.recipeComplexity ?? ('MODERATE' as const),
      avoidFoodCategories: (seed.avoidFoodCategories ?? []) as unknown as Prisma.InputJsonValue,
    };

    if (existing) {
      await prisma.nutritionProtocol.update({
        where: { id: existing.id },
        data: { ...data, version: { increment: 1 } },
      });
      updated++;
    } else {
      await prisma.nutritionProtocol.create({ data });
      created++;
    }
  }

  // Ensure exactly ONE default protocol
  const defaults = await prisma.nutritionProtocol.findMany({
    where: { isDefault: true, scope: 'GLOBAL' },
    orderBy: { createdAt: 'asc' },
  });

  if (defaults.length > 1) {
    // Keep only the first (Standard WHO), reset others
    await prisma.nutritionProtocol.updateMany({
      where: { id: { in: defaults.slice(1).map((d) => d.id) } },
      data: { isDefault: false },
    });
    console.log(`Fixed ${defaults.length - 1} extra default protocols.`);
  }

  console.log(`Done: ${created} created, ${updated} updated.`);
  console.log('Default protocol: Standard WHO');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

seedProtocols()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
