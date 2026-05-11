/**
 * Seed script: adds 15 example Polish recipes to the database.
 *
 * Usage:
 *   node scripts/seed-recipes.js
 *
 * Prerequisites:
 *   - DATABASE_URL set (or .env in packages/database)
 *   - FoodProduct + FoodProductNutrients rows already imported (USDA importer)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0142/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

/**
 * Find the best FoodProduct match for a given ingredient name.
 * 1. Exact match on name (case-insensitive)
 * 2. Contains match (pick the shortest name for specificity)
 * Returns { product, nutrients } or null.
 */
function findProduct(allProducts, searchName) {
  const lower = searchName.toLowerCase();

  // 1. Exact match
  const exact = allProducts.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Contains match — pick shortest name among matches
  const matches = allProducts.filter((p) =>
    p.name.toLowerCase().includes(lower)
  );
  if (matches.length > 0) {
    matches.sort((a, b) => a.name.length - b.name.length);
    return matches[0];
  }

  return null;
}

// ---------------------------------------------------------------------------
// Recipe definitions
// ---------------------------------------------------------------------------

const RECIPES = [
  {
    title: 'Owsianka z bananem i miodem',
    description:
      'Klasyczna owsianka na mleku z plasterkami banana i odrobiną miodu. Pożywne i szybkie śniadanie.',
    category: 'śniadania',
    cuisineType: 'polska',
    mealType: 'BREAKFAST',
    difficulty: 'EASY',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    totalTimeMinutes: 15,
    servings: 1,
    tags: ['śniadanie', 'owsianka', 'szybkie'],
    tips: 'Owsiankę można podać z dodatkiem orzechów lub jagód.',
    ingredients: [
      { search: 'owies', grams: 50, unit: 'g', quantity: 50, displayName: 'płatki owsiane' },
      { search: 'mleko', grams: 200, unit: 'ml', quantity: 200, displayName: 'mleko 3.25%' },
      { search: 'banan', grams: 120, unit: 'szt', quantity: 1, displayName: 'banan' },
      { search: 'miod', grams: 15, unit: 'g', quantity: 15, displayName: 'miód' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Wsyp płatki owsiane do garnka i zalej mlekiem.', durationMinutes: 1 },
      { stepNumber: 2, instruction: 'Gotuj na małym ogniu ok. 8 minut, mieszając od czasu do czasu.', durationMinutes: 8 },
      { stepNumber: 3, instruction: 'Przełóż do miseczki, ułóż plasterki banana na wierzchu i polej miodem.', durationMinutes: 1 },
    ],
  },
  {
    title: 'Jajecznica na maśle',
    description:
      'Prosta jajecznica smażona na maśle. Klasyka polskiego śniadania.',
    category: 'śniadania',
    cuisineType: 'polska',
    mealType: 'BREAKFAST',
    difficulty: 'EASY',
    prepTimeMinutes: 2,
    cookTimeMinutes: 5,
    totalTimeMinutes: 7,
    servings: 1,
    tags: ['śniadanie', 'jajka', 'szybkie'],
    tips: 'Jajecznicę zdejmij z ognia chwilę przed pełnym ścięciem — dokładnie dojdzie na gorącej patelni.',
    ingredients: [
      { search: 'jajko', grams: 150, unit: 'szt', quantity: 3, displayName: 'jajka kurze' },
      { search: 'maslo', grams: 10, unit: 'g', quantity: 10, displayName: 'masło' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rozgrzej masło na patelni na średnim ogniu.', durationMinutes: 1 },
      { stepNumber: 2, instruction: 'Wbij jajka bezpośrednio na patelnię, podsmaż mieszając łopatką aż do ścięcia.', durationMinutes: 4 },
    ],
  },
  {
    title: 'Sałatka grecka',
    description:
      'Klasyczna sałatka z pomidorami, ogórkiem, papryką, oliwkami, cebulą i serem feta.',
    category: 'sałatki',
    cuisineType: 'grecka',
    mealType: 'LUNCH',
    difficulty: 'EASY',
    prepTimeMinutes: 15,
    cookTimeMinutes: 0,
    totalTimeMinutes: 15,
    servings: 1,
    tags: ['sałatka', 'grecka', 'lekka'],
    tips: 'Użyj dojrzałych pomidorów i dobrej jakości oliwy extra virgin.',
    ingredients: [
      { search: 'pomidor', grams: 150, unit: 'g', quantity: 150, displayName: 'pomidory' },
      { search: 'ogorek', grams: 100, unit: 'g', quantity: 100, displayName: 'ogórek' },
      { search: 'cebula', grams: 30, unit: 'g', quantity: 30, displayName: 'cebula czerwona' },
      { search: 'oliwa', grams: 15, unit: 'ml', quantity: 15, displayName: 'oliwa z oliwek' },
      { search: 'ser feta', grams: 50, unit: 'g', quantity: 50, displayName: 'ser feta' },
      { search: 'oliwki', grams: 30, unit: 'g', quantity: 30, displayName: 'oliwki czarne' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Pokrój pomidory, ogórka i cebulę w kostkę lub plastry.', durationMinutes: 5 },
      { stepNumber: 2, instruction: 'Połóż warzywa na talerzu, dodaj oliwki i pokruszoną fetę.', durationMinutes: 3 },
      { stepNumber: 3, instruction: 'Skrop oliwą z oliwek, dopraw solą i oregano.', durationMinutes: 1 },
    ],
  },
  {
    title: 'Pierś z kurczaka z ryżem i brokułami',
    description:
      'Pieczona pierś z kurczaka podana z gotowanym ryżem i brokułami na parze. Zbilansowany obiad.',
    category: 'dania główne',
    cuisineType: 'polska',
    mealType: 'LUNCH',
    difficulty: 'MEDIUM',
    prepTimeMinutes: 10,
    cookTimeMinutes: 30,
    totalTimeMinutes: 40,
    servings: 1,
    tags: ['obiad', 'kurczak', 'ryż', 'brokuły'],
    tips: 'Kurczaka oprósz papryką wędzoną przed pieczeniem dla dodatkowego aromatu.',
    ingredients: [
      { search: 'piersi z kurczaka', grams: 150, unit: 'g', quantity: 150, displayName: 'pierś z kurczaka' },
      { search: 'ryz bialy', grams: 80, unit: 'g', quantity: 80, displayName: 'ryż biały (suchy)' },
      { search: 'brokul', grams: 150, unit: 'g', quantity: 150, displayName: 'brokuły' },
      { search: 'oliwa', grams: 10, unit: 'ml', quantity: 10, displayName: 'oliwa z oliwek' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Rozgrzej piekarnik do 200°C. Pierś z kurczaka dopraw solą, pieprzem i natłuść oliwą.', durationMinutes: 5 },
      { stepNumber: 2, instruction: 'Piecz pierś ok. 25 minut do osiągnięcia temp. wewnętrznej 74°C.', durationMinutes: 25 },
      { stepNumber: 3, instruction: 'Ugotuj ryż wg instrukcji na opakowaniu. Brokuły gotuj na parze ok. 5 minut.', durationMinutes: 15 },
      { stepNumber: 4, instruction: 'Pokrój pierś w plastry i podaj z ryżem i brokułami.', durationMinutes: 2 },
    ],
  },
  {
    title: 'Zupa pomidorowa',
    description:
      'Tradycyjna polska zupa pomidorowa na bulionie, podawana z makaronem lub ryżem.',
    category: 'zupy',
    cuisineType: 'polska',
    mealType: 'LUNCH',
    difficulty: 'MEDIUM',
    prepTimeMinutes: 10,
    cookTimeMinutes: 30,
    totalTimeMinutes: 40,
    servings: 2,
    tags: ['zupa', 'pomidorowa', 'polska'],
    tips: 'Dodaj łyżeczkę cukru, by zneutralizować kwasowość pomidorów.',
    ingredients: [
      { search: 'pomidor', grams: 400, unit: 'g', quantity: 400, displayName: 'pomidory' },
      { search: 'cebula', grams: 80, unit: 'szt', quantity: 1, displayName: 'cebula' },
      { search: 'maslo', grams: 20, unit: 'g', quantity: 20, displayName: 'masło' },
      { search: 'smietana', grams: 50, unit: 'ml', quantity: 50, displayName: 'śmietana' },
      { search: 'makaron', grams: 100, unit: 'g', quantity: 100, displayName: 'makaron' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Cebulę pokrój i zeszklij na maśle w garnku.', durationMinutes: 5 },
      { stepNumber: 2, instruction: 'Dodaj pokrojone pomidory, sól, pieprz i gotuj 20 minut.', durationMinutes: 20 },
      { stepNumber: 3, instruction: 'Zblenduj zupę na gładki krem, dodaj śmietanę i wymieszaj.', durationMinutes: 3 },
      { stepNumber: 4, instruction: 'Podaj z ugotowanym makaronem.', durationMinutes: 2 },
    ],
  },
  {
    title: 'Makaron z sosem bolognese',
    description:
      'Makaron spaghetti z klasycznym włoskim sosem mięsnym na pomidorach.',
    category: 'dania główne',
    cuisineType: 'włoska',
    mealType: 'DINNER',
    difficulty: 'MEDIUM',
    prepTimeMinutes: 10,
    cookTimeMinutes: 35,
    totalTimeMinutes: 45,
    servings: 2,
    tags: ['makaron', 'bolognese', 'włoskie'],
    tips: 'Sos smakuje lepiej odgrzany następnego dnia.',
    ingredients: [
      { search: 'makaron', grams: 200, unit: 'g', quantity: 200, displayName: 'makaron spaghetti' },
      { search: 'wolowina mielona', grams: 250, unit: 'g', quantity: 250, displayName: 'mięso mielone wołowe' },
      { search: 'pomidor', grams: 300, unit: 'g', quantity: 300, displayName: 'pomidory' },
      { search: 'cebula', grams: 80, unit: 'szt', quantity: 1, displayName: 'cebula' },
      { search: 'czosnek', grams: 6, unit: 'szt', quantity: 2, displayName: 'ząbki czosnku' },
      { search: 'oliwa', grams: 15, unit: 'ml', quantity: 15, displayName: 'oliwa z oliwek' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Na oliwie zeszklij cebulę i czosnek.', durationMinutes: 5 },
      { stepNumber: 2, instruction: 'Dodaj mięso mielone i smaż aż się zarumieni, rozbijając grudki.', durationMinutes: 8 },
      { stepNumber: 3, instruction: 'Dodaj pomidory, sól, pieprz, oregano. Gotuj pod przykryciem ok. 25 minut.', durationMinutes: 25 },
      { stepNumber: 4, instruction: 'Ugotuj makaron al dente wg instrukcji na opakowaniu.', durationMinutes: 10 },
      { stepNumber: 5, instruction: 'Wymieszaj makaron z sosem i podaj.', durationMinutes: 1 },
    ],
  },
  {
    title: 'Omlet z warzywami',
    description:
      'Puszysty omlet z papryką, pomidorami i szpinakiem. Zdrowe, białkowe śniadanie.',
    category: 'śniadania',
    cuisineType: 'polska',
    mealType: 'BREAKFAST',
    difficulty: 'EASY',
    prepTimeMinutes: 5,
    cookTimeMinutes: 8,
    totalTimeMinutes: 13,
    servings: 1,
    tags: ['śniadanie', 'omlet', 'białko'],
    tips: 'Omlet smażony pod przykryciem lepiej się napuszy.',
    ingredients: [
      { search: 'jajko', grams: 100, unit: 'szt', quantity: 2, displayName: 'jajka kurze' },
      { search: 'papryka', grams: 50, unit: 'g', quantity: 50, displayName: 'papryka czerwona' },
      { search: 'pomidor', grams: 60, unit: 'g', quantity: 60, displayName: 'pomidor' },
      { search: 'szpinak', grams: 30, unit: 'g', quantity: 30, displayName: 'szpinak' },
      { search: 'maslo', grams: 8, unit: 'g', quantity: 8, displayName: 'masło' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Jajka roztrzep widelcem, dodaj sól i pieprz.', durationMinutes: 1 },
      { stepNumber: 2, instruction: 'Pokrój paprykę i pomidora w drobną kostkę.', durationMinutes: 2 },
      { stepNumber: 3, instruction: 'Na maśle podsmaż warzywa 2 minuty, dodaj szpinak.', durationMinutes: 3 },
      { stepNumber: 4, instruction: 'Wlej jajka i smaż pod przykryciem aż omlet się zetnie (~3 min).', durationMinutes: 3 },
    ],
  },
  {
    title: 'Kanapka z jajkiem i awokado',
    description:
      'Tost z puree z awokado i jajkiem na twardo. Sycące śniadanie bogate w zdrowe tłuszcze.',
    category: 'śniadania',
    cuisineType: 'międzynarodowa',
    mealType: 'BREAKFAST',
    difficulty: 'EASY',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    totalTimeMinutes: 15,
    servings: 1,
    tags: ['śniadanie', 'awokado', 'jajko'],
    tips: 'Posyp chili w płatkach i skrop sokiem z cytryny dla lepszego smaku.',
    ingredients: [
      { search: 'chleb', grams: 60, unit: 'szt', quantity: 2, displayName: 'kromki chleba' },
      { search: 'jajko', grams: 50, unit: 'szt', quantity: 1, displayName: 'jajko kurze' },
      { search: 'awokado', grams: 80, unit: 'g', quantity: 80, displayName: 'awokado' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ugotuj jajko na twardo (10 minut), obierz i pokrój w plastry.', durationMinutes: 12 },
      { stepNumber: 2, instruction: 'Awokado rozgnieć widelcem, dopraw solą i pieprzem.', durationMinutes: 2 },
      { stepNumber: 3, instruction: 'Chleb opiecz w tosterze. Posmaruj puree z awokado, ułóż plastry jajka.', durationMinutes: 2 },
    ],
  },
  {
    title: 'Sałatka z tuńczykiem',
    description:
      'Lekka sałatka z tuńczykiem w puszce, kukurydzą, ogórkiem i jogurtem naturalnym.',
    category: 'sałatki',
    cuisineType: 'międzynarodowa',
    mealType: 'LUNCH',
    difficulty: 'EASY',
    prepTimeMinutes: 10,
    cookTimeMinutes: 0,
    totalTimeMinutes: 10,
    servings: 1,
    tags: ['sałatka', 'tuńczyk', 'lekka'],
    tips: 'Zamiast jogurtu możesz użyć odrobiny majonezu.',
    ingredients: [
      { search: 'tunczyk', grams: 100, unit: 'g', quantity: 100, displayName: 'tuńczyk w puszce' },
      { search: 'kukurydza', grams: 50, unit: 'g', quantity: 50, displayName: 'kukurydza konserwowa' },
      { search: 'ogorek', grams: 80, unit: 'g', quantity: 80, displayName: 'ogórek' },
      { search: 'jogurt', grams: 30, unit: 'g', quantity: 30, displayName: 'jogurt naturalny' },
      { search: 'salata', grams: 50, unit: 'g', quantity: 50, displayName: 'sałata' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Odcedź tuńczyka i kukurydzę. Pokrój ogórka w kostkę.', durationMinutes: 3 },
      { stepNumber: 2, instruction: 'Wymieszaj tuńczyka, kukurydzę, ogórka i jogurt.', durationMinutes: 2 },
      { stepNumber: 3, instruction: 'Podaj na liściach sałaty. Dopraw solą i pieprzem.', durationMinutes: 1 },
    ],
  },
  {
    title: 'Placki z cukinii',
    description:
      'Chrupiące placki warzywne z cukinii i cebuli z dodatkiem jajka i mąki. Lekka kolacja.',
    category: 'dania główne',
    cuisineType: 'polska',
    mealType: 'DINNER',
    difficulty: 'MEDIUM',
    prepTimeMinutes: 15,
    cookTimeMinutes: 15,
    totalTimeMinutes: 30,
    servings: 2,
    tags: ['kolacja', 'cukinia', 'placki'],
    tips: 'Cukinię po startciu odciśnij z nadmiaru wody, by placki były chrupiące.',
    ingredients: [
      { search: 'cukinia', grams: 300, unit: 'g', quantity: 300, displayName: 'cukinia' },
      { search: 'jajko', grams: 50, unit: 'szt', quantity: 1, displayName: 'jajko' },
      { search: 'maka', grams: 40, unit: 'g', quantity: 40, displayName: 'mąka pszenna' },
      { search: 'cebula', grams: 50, unit: 'szt', quantity: 0.5, displayName: 'cebula' },
      { search: 'oliwa', grams: 15, unit: 'ml', quantity: 15, displayName: 'oliwa do smażenia' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Cukinię zetrzyj na tarce o grubych oczkach, posól i zostaw 5 minut. Odciśnij wodę.', durationMinutes: 8 },
      { stepNumber: 2, instruction: 'Wymieszaj startą cukinię z posiekaną cebulą, jajkiem i mąką. Dopraw pieprzem.', durationMinutes: 3 },
      { stepNumber: 3, instruction: 'Nakładaj łyżką porcje na rozgrzaną patelnię z oliwą i smaż po 3 minuty z każdej strony.', durationMinutes: 15 },
    ],
  },
  {
    title: 'Koktajl bananowo-jogurtowy',
    description:
      'Szybki, kremowy koktajl z banana, jogurtu i odrobiny miodu. Idealny na przekąskę.',
    category: 'napoje',
    cuisineType: 'międzynarodowa',
    mealType: 'SNACK',
    difficulty: 'EASY',
    prepTimeMinutes: 5,
    cookTimeMinutes: 0,
    totalTimeMinutes: 5,
    servings: 1,
    tags: ['koktajl', 'banan', 'jogurt', 'szybkie'],
    tips: 'Zamroź banana wcześniej, by koktajl był gęstszy i chłodniejszy.',
    ingredients: [
      { search: 'banan', grams: 120, unit: 'szt', quantity: 1, displayName: 'banan' },
      { search: 'jogurt', grams: 150, unit: 'g', quantity: 150, displayName: 'jogurt naturalny' },
      { search: 'mleko', grams: 100, unit: 'ml', quantity: 100, displayName: 'mleko' },
      { search: 'miod', grams: 10, unit: 'g', quantity: 10, displayName: 'miód' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Banana obierz i połam na kawałki.', durationMinutes: 1 },
      { stepNumber: 2, instruction: 'Wrzuć banana, jogurt, mleko i miód do blendera. Miksuj 30 sekund do gładkości.', durationMinutes: 1 },
    ],
  },
  {
    title: 'Tosty z serem i pomidorem',
    description:
      'Chrupiące tosty z topiącym się serem i plastrem pomidora. Szybka przekąska.',
    category: 'przekąski',
    cuisineType: 'międzynarodowa',
    mealType: 'SNACK',
    difficulty: 'EASY',
    prepTimeMinutes: 3,
    cookTimeMinutes: 5,
    totalTimeMinutes: 8,
    servings: 1,
    tags: ['przekąska', 'tosty', 'ser', 'szybkie'],
    tips: 'Dodaj listki bazylii po wyjęciu z piekarnika.',
    ingredients: [
      { search: 'chleb', grams: 60, unit: 'szt', quantity: 2, displayName: 'kromki chleba tostowego' },
      { search: 'ser', grams: 40, unit: 'g', quantity: 40, displayName: 'ser żółty' },
      { search: 'pomidor', grams: 60, unit: 'g', quantity: 60, displayName: 'pomidor' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Na kromki chleba ułóż plastry sera i pomidora.', durationMinutes: 2 },
      { stepNumber: 2, instruction: 'Zapiekaj w piekarniku (200°C) lub tosterze ok. 5 minut aż ser się rozpuści.', durationMinutes: 5 },
    ],
  },
  {
    title: 'Kurczak curry z ryżem',
    description:
      'Aromatyczny kurczak w sosie curry z mlekiem kokosowym, podany z ryżem basmati.',
    category: 'dania główne',
    cuisineType: 'azjatycka',
    mealType: 'DINNER',
    difficulty: 'MEDIUM',
    prepTimeMinutes: 10,
    cookTimeMinutes: 25,
    totalTimeMinutes: 35,
    servings: 2,
    tags: ['kolacja', 'curry', 'kurczak', 'azjatyckie'],
    tips: 'Dodaj trochę soku z limonki na końcu gotowania dla świeżości.',
    ingredients: [
      { search: 'piersi z kurczaka', grams: 300, unit: 'g', quantity: 300, displayName: 'pierś z kurczaka' },
      { search: 'ryz bialy', grams: 160, unit: 'g', quantity: 160, displayName: 'ryż biały (suchy)' },
      { search: 'mleko kokosowe', grams: 200, unit: 'ml', quantity: 200, displayName: 'mleko kokosowe' },
      { search: 'cebula', grams: 80, unit: 'szt', quantity: 1, displayName: 'cebula' },
      { search: 'czosnek', grams: 6, unit: 'szt', quantity: 2, displayName: 'ząbki czosnku' },
      { search: 'oliwa', grams: 15, unit: 'ml', quantity: 15, displayName: 'oliwa z oliwek' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Kurczaka pokrój w kostkę, cebulę i czosnek posiekaj.', durationMinutes: 5 },
      { stepNumber: 2, instruction: 'Na oliwie zeszklij cebulę i czosnek, dodaj 2 łyżki pasty curry.', durationMinutes: 3 },
      { stepNumber: 3, instruction: 'Dodaj kurczaka i smaż 5 minut. Wlej mleko kokosowe, duś 15 minut.', durationMinutes: 20 },
      { stepNumber: 4, instruction: 'Ugotuj ryż wg instrukcji na opakowaniu. Podaj kurczaka na ryżu.', durationMinutes: 15 },
    ],
  },
  {
    title: 'Ryż z warzywami',
    description:
      'Kolorowy ryż smażony z mieszanką warzyw — marchewką, groszkiem i kukurydzą. Uniwersalny dodatek.',
    category: 'dodatki',
    cuisineType: 'azjatycka',
    mealType: 'SIDE_DISH',
    difficulty: 'EASY',
    prepTimeMinutes: 5,
    cookTimeMinutes: 15,
    totalTimeMinutes: 20,
    servings: 2,
    tags: ['dodatek', 'ryż', 'warzywa'],
    tips: 'Używaj ryżu ugotowanego dzień wcześniej — lepiej się smaży.',
    ingredients: [
      { search: 'ryz bialy', grams: 160, unit: 'g', quantity: 160, displayName: 'ryż biały (suchy)' },
      { search: 'marchew', grams: 60, unit: 'g', quantity: 60, displayName: 'marchewka' },
      { search: 'groszek', grams: 50, unit: 'g', quantity: 50, displayName: 'groszek zielony' },
      { search: 'kukurydza', grams: 50, unit: 'g', quantity: 50, displayName: 'kukurydza' },
      { search: 'oliwa', grams: 10, unit: 'ml', quantity: 10, displayName: 'oliwa z oliwek' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Ugotuj ryż al dente wg instrukcji na opakowaniu. Odcedź.', durationMinutes: 12 },
      { stepNumber: 2, instruction: 'Marchewkę pokrój w drobną kostkę.', durationMinutes: 2 },
      { stepNumber: 3, instruction: 'Na patelni rozgrzej oliwę, podsmaż marchewkę 3 min, dodaj groszek i kukurydzę.', durationMinutes: 4 },
      { stepNumber: 4, instruction: 'Dodaj ugotowany ryż, smaż razem 3 minuty, dopraw solą, pieprzem i sosem sojowym.', durationMinutes: 3 },
    ],
  },
  {
    title: 'Naleśniki z serem',
    description:
      'Cienkie naleśniki nadziane słodkim twarogiem z rodzynkami. Klasyczny polski deser.',
    category: 'desery',
    cuisineType: 'polska',
    mealType: 'DESSERT',
    difficulty: 'MEDIUM',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    servings: 2,
    tags: ['deser', 'naleśniki', 'twaróg', 'polska'],
    tips: 'Ciasto na naleśniki powinno odpocząć 15 minut w lodówce przed smażeniem.',
    ingredients: [
      { search: 'maka', grams: 100, unit: 'g', quantity: 100, displayName: 'mąka pszenna' },
      { search: 'jajko', grams: 50, unit: 'szt', quantity: 1, displayName: 'jajko' },
      { search: 'mleko', grams: 200, unit: 'ml', quantity: 200, displayName: 'mleko' },
      { search: 'twarog', grams: 200, unit: 'g', quantity: 200, displayName: 'twaróg półtłusty' },
      { search: 'maslo', grams: 15, unit: 'g', quantity: 15, displayName: 'masło do smażenia' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Mąkę, jajko i mleko wymieszaj na gładkie ciasto. Odstaw na 15 minut.', durationMinutes: 17 },
      { stepNumber: 2, instruction: 'Smaż cienkie naleśniki na lekko nasmarowanej masłem patelni (ok. 1 min z każdej strony).', durationMinutes: 12 },
      { stepNumber: 3, instruction: 'Twaróg wymieszaj z cukrem waniliowym i opcjonalnie rodzynkami.', durationMinutes: 3 },
      { stepNumber: 4, instruction: 'Nałóż nadzienie na naleśniki, zroluj lub złóż w trójkąty. Podaj ciepłe.', durationMinutes: 3 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('--- Seed Recipes Script ---\n');

  // 1. Load all FoodProducts with nutrients
  console.log('Loading FoodProducts from database...');
  const allProducts = await prisma.foodProduct.findMany({
    where: { isActive: true },
    include: { nutrients: true },
  });
  console.log(`Found ${allProducts.length} active FoodProducts.\n`);

  if (allProducts.length === 0) {
    console.error('ERROR: No FoodProducts found in DB. Run the USDA importer first.');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const recipe of RECIPES) {
    const slug = slugify(recipe.title);

    // 2. Check if recipe already exists
    const existing = await prisma.recipe.findUnique({ where: { slug } });
    if (existing) {
      console.log(`SKIP: "${recipe.title}" (slug "${slug}" already exists)`);
      skipped++;
      continue;
    }

    // 3. Match ingredients
    const matchedIngredients = [];
    let allMatched = true;

    for (let i = 0; i < recipe.ingredients.length; i++) {
      const ing = recipe.ingredients[i];
      const product = findProduct(allProducts, ing.search);

      if (!product) {
        console.warn(`  WARNING: No FoodProduct match for "${ing.search}" (recipe: ${recipe.title}) — skipping ingredient`);
        allMatched = false;
        continue;
      }

      if (!product.nutrients) {
        console.warn(`  WARNING: FoodProduct "${product.name}" has no nutrients — skipping ingredient`);
        continue;
      }

      console.log(`  Matched "${ing.search}" → "${product.name}" (id: ${product.id})`);
      matchedIngredients.push({
        foodProductId: product.id,
        sortOrder: i,
        quantity: ing.quantity,
        unit: ing.unit,
        grams: ing.grams,
        displayName: ing.displayName,
        isOptional: false,
        nutrients: product.nutrients, // keep reference for snapshot calc
      });
    }

    if (matchedIngredients.length === 0) {
      console.warn(`  SKIP: "${recipe.title}" — no ingredients matched at all.\n`);
      skipped++;
      continue;
    }

    if (!allMatched) {
      console.log(`  Proceeding with ${matchedIngredients.length}/${recipe.ingredients.length} matched ingredients.`);
    }

    // 4. Compute nutrition snapshot
    let totalKcal = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;

    for (const ing of matchedIngredients) {
      const n = ing.nutrients;
      // Nutrients are per 100g, scale by grams
      const factor = Number(ing.grams) / 100;
      totalKcal += Number(n.kcal) * factor;
      totalProtein += Number(n.protein_g) * factor;
      totalFat += Number(n.fat_g) * factor;
      totalCarbs += Number(n.carbs_g) * factor;
    }

    const servings = recipe.servings || 1;
    const perServingKcal = totalKcal / servings;
    const perServingProtein = totalProtein / servings;
    const perServingFat = totalFat / servings;
    const perServingCarbs = totalCarbs / servings;

    // 5. Create recipe with all related records
    const createdRecipe = await prisma.recipe.create({
      data: {
        source: 'manual',
        title: recipe.title,
        slug,
        description: recipe.description,
        category: recipe.category,
        cuisineType: recipe.cuisineType,
        mealType: recipe.mealType,
        difficulty: recipe.difficulty,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        totalTimeMinutes: recipe.totalTimeMinutes,
        servings: recipe.servings,
        tips: recipe.tips,
        tags: recipe.tags,
        isActive: true,
        qualityScore: 70,
        verificationStatus: 'UNVERIFIED',
        languageCode: 'pl',

        ingredients: {
          create: matchedIngredients.map((ing) => ({
            foodProductId: ing.foodProductId,
            sortOrder: ing.sortOrder,
            quantity: ing.quantity,
            unit: ing.unit,
            grams: ing.grams,
            displayName: ing.displayName,
            isOptional: ing.isOptional,
          })),
        },

        instructionSteps: {
          create: recipe.steps.map((s) => ({
            stepNumber: s.stepNumber,
            instruction: s.instruction,
            durationMinutes: s.durationMinutes,
          })),
        },

        nutritionSnapshot: {
          create: {
            kcal: perServingKcal.toFixed(2),
            protein_g: perServingProtein.toFixed(3),
            fat_g: perServingFat.toFixed(3),
            carbs_g: perServingCarbs.toFixed(3),
            totalKcal: totalKcal.toFixed(2),
            totalProtein_g: totalProtein.toFixed(3),
            totalFat_g: totalFat.toFixed(3),
            totalCarbs_g: totalCarbs.toFixed(3),
          },
        },
      },
    });

    console.log(`  CREATED: "${recipe.title}" (id: ${createdRecipe.id}, slug: ${slug})`);
    console.log(`    Nutrition/serving: ${perServingKcal.toFixed(0)} kcal, P ${perServingProtein.toFixed(1)}g, F ${perServingFat.toFixed(1)}g, C ${perServingCarbs.toFixed(1)}g`);
    console.log('');
    created++;
  }

  console.log('--- Summary ---');
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total recipes defined: ${RECIPES.length}`);
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
