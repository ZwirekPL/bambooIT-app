/**
 * fix-translations.js
 *
 * Fixes Polish food product name translations in the database:
 * 1. Removes gender markers (a) — artifacts from translation
 * 2. Replaces remaining English words/phrases with Polish equivalents
 * 3. Fixes unnatural Polish phrases
 * 4. Regenerates slugs
 *
 * Usage: node scripts/fix-translations.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({
  datasourceUrl: 'postgresql://dietetyk:dietetyk123@localhost:5432/dietetyk_ai?schema=public',
});

// ---------------------------------------------------------------------------
// SLUG GENERATION
// ---------------------------------------------------------------------------

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

// ---------------------------------------------------------------------------
// PHRASE REPLACEMENTS (applied first, longest match first)
// ---------------------------------------------------------------------------

const PHRASE_MAP = {
  // Multi-word phrases
  'separable lean and fat': 'część chuda i tłusta',
  'separable lean only': 'część chuda',
  'no salt added': 'bez dodatku soli',
  'with added': 'z dodatkiem',
  'whole milk': 'z pełnego mleka',
  'whole-wheat': 'pełnoziarnisty',
  'whole wheat': 'pełnoziarnisty',
  'whole-grain': 'pełnoziarnisty',
  'multi-grain': 'wieloziarnisty',
  'short-grain': 'krótkoziarnisty',
  'long-grain': 'długoziarnisty',
  'medium-grain': 'średnioziarnisty',
  'all grades': 'wszystkie klasy',
  'trimmed to': 'przycięty do',
  'not trimmed': 'nieprzycinany',
  'New Zealand': 'nowozelandzki',
  'deep-fried': 'smażony w głębokim oleju',
  'pan-fried': 'smażony na patelni',
  'stir-fried': 'smażony z mieszaniem',
  'par fried': 'podsmażony',
  'pre-cooked': 'wstępnie ugotowany',
  'par-baked': 'wstępnie pieczony',
  'heated in oven': 'podgrzany w piekarniku',
  'as purchased': 'jak kupiony',
  'as served': 'jak podany',
  'drained solids': 'odsączony',
  'ready-to-serve': 'gotowy do podania',
  'ready-to-eat': 'gotowy do jedzenia',
  'ready-to-heat': 'gotowy do podgrzania',
  'ready-to-bake': 'gotowy do pieczenia',
  'ready-to-cook': 'gotowy do gotowania',
  'ready-to-fry': 'gotowy do smażenia',
  'shelf stable': 'o długim terminie przydatności',
  'commercially prepared': 'produkcji przemysłowej',
  'with salt': 'z solą',
  'without salt': 'bez soli',
  'fat-free': 'beztłuszczowy',
  'non-fat': 'beztłuszczowy',
  'nonfat': 'beztłuszczowy',
  'low-fat': 'niskotłuszczowy',
  'lowfat': 'niskotłuszczowy',
  'reduced-fat': 'o obniżonej zawartości tłuszczu',
  'full-fat': 'pełnotłusty',
  'skim': 'odtłuszczony',
  '1% milkfat': '1% tłuszczu',
  '2% milkfat': '2% tłuszczu',
  'vitamin A': 'witamina A',
  'vitamin D': 'witamina D',
  'vitamin C': 'witamina C',
  'vitamin E': 'witamina E',
  'vitamin K': 'witamina K',
  'vitamin B': 'witamina B',
  'bone-in': 'z kością',
  'boneless': 'bez kości',
  'skinless': 'bez skóry',
  'skin-on': 'ze skórą',
  'deli meat': 'wędlina',
  'pre-packaged': 'pakowany',
  'pan-broiled': 'smażony na patelni',
  'on wolnym ogniu': 'na wolnym ogniu', // fix potential typo from "simmered" replacement
  'charbroiled': 'grillowany na węglu',
  'pasta do smarowania': 'pasta do smarowania', // keep as-is (prevent double replace)
  'danie główne': 'danie główne', // keep as-is
  'includes foods': '(zawiera produkty',
  'Food Distribution Program': 'program dystrybucji żywności)',
  'bez gniazd nasiennych': 'bez gniazd nasiennych', // keep
  'z żywymi kulturami': 'z żywymi kulturami', // keep
  'w głębokim oleju': 'w głębokim oleju', // keep
  'smażony w głębokim oleju': 'smażony w głębokim oleju', // keep
  'na patelni': 'na patelni', // keep
};

// ---------------------------------------------------------------------------
// SINGLE WORD REPLACEMENTS (applied after phrases)
// ---------------------------------------------------------------------------

const WORD_MAP = {
  'separable': 'oddzielny',
  'lean': 'chudy',
  'only': '',
  'half': 'połówka',
  'whole': 'cały',
  'choice': 'klasa Choice',
  'select': 'klasa Select',
  'prime': 'klasa Prime',
  'trimmed': 'przycięty',
  'fat': 'tłuszcz',
  'uncooked': 'niegotowany',
  'cooked': 'gotowany',
  'raw': 'surowy',
  'fresh': 'świeży',
  'imported': 'importowany',
  'Australian': 'australijski',
  'domestic': 'krajowy',
  'baby': 'młody',
  'young': 'młody',
  'mature': 'dojrzały',
  'aged': 'dojrzały',
  'original': 'oryginalny',
  'regular': 'zwykły',
  'thick': 'gruby',
  'thin': 'cienki',
  'extra': 'ekstra',
  'large': 'duży',
  'small': 'mały',
  'medium': 'średni',
  'mini': 'mini',
  'short': 'krótki',
  'long': 'długi',
  'round': 'okrągły',
  'flat': 'płaski',
  'deep': 'głęboki',
  'high': 'wysoki',
  'low': 'niski',
  'soft': 'miękki',
  'hard': 'twardy',
  'dry': 'suchy',
  'wet': 'mokry',
  'hot': 'gorący',
  'cold': 'zimny',
  'warm': 'ciepły',
  'cool': 'chłodny',
  'sweet': 'słodki',
  'bitter': 'gorzki',
  'sour': 'kwaśny',
  'spicy': 'pikantny',
  'mild': 'łagodny',
  'strong': 'mocny',
  'heavy': 'ciężki',
  'light': 'lekki',
  'dark': 'ciemny',
  'white': 'biały',
  'yellow': 'żółty',
  'red': 'czerwony',
  'green': 'zielony',
  'brown': 'brązowy',
  'black': 'czarny',
  'orange': 'pomarańczowy',
  'purple': 'fioletowy',
  'pink': 'różowy',
  'golden': 'złoty',
  'amber': 'bursztynowy',
  'pale': 'jasny',
  'colored': 'kolorowy',
  'mixed': 'mieszany',
  'blended': 'mieszany',
  'added': 'dodany',
  'included': 'w zestawie',
  'with': 'z',
  'without': 'bez',
  'and': 'i',
  'or': 'lub',
  'in': 'w',
  'on': 'na',
  'from': 'z',
  'for': 'dla',
  'to': 'do',
  'by': 'przez',
  'each': 'każdy',
  'per': 'na',
  'about': 'około',
  'approximately': 'około',
  'various': 'różny',
  'different': 'różny',
  'other': 'inny',
  'specific': 'specyficzny',
  'standard': 'standardowy',
  'traditional': 'tradycyjny',
  'classic': 'klasyczny',
  'modern': 'nowoczesny',
  'new': 'nowy',
  'old': 'stary',
  'pack': 'opakowanie',
  'package': 'opakowanie',
  'container': 'pojemnik',
  'jar': 'słoik',
  'can': 'puszka',
  'bottle': 'butelka',
  'box': 'pudełko',
  'bag': 'torebka',
  'pouch': 'saszetka',
  'cup': 'kubek',
  'glass': 'szklanka',
  'serving': 'porcja',
  'portion': 'porcja',
  'piece': 'kawałek',
  'slice': 'plasterek',
  'chunk': 'kawałek',
  'strip': 'pasek',
  'cube': 'kostka',
  'ball': 'kulka',
  'ring': 'krążek',
  'link': 'paluszek',
  'patty': 'kotlet',
  'stick': 'paluszek',
  'fillet': 'filet',
  'steak': 'stek',
  'roast': 'pieczeń',
  'chop': 'kotlet',
  'cutlet': 'kotlet',
  'grain': 'ziarno',
  'crumbles': 'gruboziarnisty',
  'fluid': 'płynny',
  'evaporated': 'odparowany',
  'condensed': 'skondensowany',
  'concentrated': 'skoncentrowany',
  'diluted': 'rozcieńczony',
  'fortified': 'wzbogacony',
  'enriched': 'wzbogacony',
  'salted': 'solony',
  'unsalted': 'niesolony',
  'seasoned': 'przyprawiony',
  'flavored': 'aromatyzowany',
  'unflavored': 'bez smaku',
  'plain': 'zwykły',
  'natural': 'naturalny',
  'organic': 'organiczny',
  'conventional': 'konwencjonalny',
  'homemade': 'domowy',
  'unprepared': 'nieprzygotowany',
  'prepared': 'przygotowany',
  'heated': 'podgrzany',
  'frozen': 'mrożony',
  'canned': 'z puszki',
  'bottled': 'butelkowany',
  'jarred': 'ze słoika',
  'dehydrated': 'odwodniony',
  'reconstituted': 'odtworzony',
  'dried': 'suszony',
  'instant': 'błyskawiczny',
  'powdered': 'w proszku',
  'granulated': 'granulowany',
  'ground': 'mielony',
  'cracked': 'łamany',
  'rolled': 'płatkowany',
  'puffed': 'ekspandowany',
  'flaked': 'w płatkach',
  'shredded': 'tarty',
  'grated': 'tarty',
  'chopped': 'siekany',
  'diced': 'w kostkę',
  'sliced': 'krojony',
  'minced': 'drobno mielony',
  'mashed': 'puree',
  'crushed': 'kruszony',
  'squeezed': 'wyciskany',
  'pressed': 'tłoczony',
  'blanched': 'blanszowany',
  'peeled': 'obrany',
  'unpeeled': 'nieobrany',
  'pitted': 'bez pestek',
  'seeded': 'z pestkami',
  'seedless': 'bezpestkowy',
  'cored': 'bez gniazd nasiennych',
  'washed': 'myty',
  'unwashed': 'niemyty',
  'sorted': 'sortowany',
  'sifted': 'przesiany',
  'strained': 'przecedzony',
  'filtered': 'filtrowany',
  'clarified': 'klarowany',
  'pasteurized': 'pasteryzowany',
  'homogenized': 'homogenizowany',
  'sterilized': 'sterylizowany',
  'fermented': 'fermentowany',
  'cultured': 'z żywymi kulturami',
  'sprouted': 'kiełkowany',
  'soaked': 'namoczony',
  'pickled': 'marynowany',
  'cured': 'peklowany',
  'smoked': 'wędzony',
  'barbecued': 'z grilla',
  'brined': 'w solance',
  'marinated': 'marynowany',
  'stuffed': 'nadziewany',
  'glazed': 'glazurowany',
  'coated': 'w panierce',
  'breaded': 'panierowany',
  'battered': 'w cieście',
  'crusted': 'w skorupce',
  'wrapped': 'zawijany',
  'formed': 'formowany',
  'shaped': 'formowany',
  'molded': 'formowany',
  'extruded': 'wytłaczany',
  'panned': 'na patelni',
  'baked': 'pieczony',
  'fried': 'smażony',
  'sauteed': 'podsmażany',
  'braised': 'duszony',
  'stewed': 'gulaszowy',
  'simmered': 'duszony na wolnym ogniu',
  'poached': 'pochowany',
  'steamed': 'gotowany na parze',
  'boiled': 'gotowany',
  'grilled': 'grillowany',
  'broiled': 'pieczony',
  'roasted': 'pieczony',
  'toasted': 'opiekany',
  'blackened': 'przypalany',
  'flamed': 'flambowany',
  'drained': 'odsączony',
  'undrained': 'nieodsączony',
  'liquid': 'płynny',
  'solids': 'stałe',
  'syrup': 'syrop',
  'broth': 'bulion',
  'stock': 'wywar',
  'gravy': 'sos pieczeniowy',
  'juice': 'sok',
  'nectar': 'nektar',
  'puree': 'puree',
  'paste': 'pasta',
  'sauce': 'sos',
  'dip': 'dip',
  'spread': 'pasta do smarowania',
  'topping': 'polewa',
  'filling': 'nadzienie',
  'coating': 'panierka',
  'crust': 'skorupka',
  'shell': 'skorupka',
  'wrap': 'tortilla',
  'base': 'baza',
  'mix': 'mieszanka',
  'blend': 'mieszanka',
  'combination': 'połączenie',
  'assortment': 'asortyment',
  'variety': 'odmiana',
  'type': 'typ',
  'style': 'styl',
  'brand': 'marka',
  'flavor': 'smak',
  'taste': 'smak',
  'aroma': 'aromat',
  'texture': 'tekstura',
  'breakfast': 'śniadaniowy',
  'lunch': 'obiadowy',
  'dinner': 'obiadowy',
  'snack': 'przekąska',
  'dessert': 'deser',
  'appetizer': 'przystawka',
  'entree': 'danie główne',
  'side': 'dodatek',
  'main': 'główny',
  'unheated': 'niepodgrzany',
  'end': 'część',
};

// ---------------------------------------------------------------------------
// BUILD REGEX PATTERNS (sorted by length descending for phrases)
// ---------------------------------------------------------------------------

// Phrase patterns: sorted longest first, case-insensitive
const phraseEntries = Object.entries(PHRASE_MAP)
  .sort((a, b) => b[0].length - a[0].length);

const phrasePatterns = phraseEntries.map(([phrase, replacement]) => ({
  regex: new RegExp(escapeRegex(phrase), 'gi'),
  replacement,
}));

// Word patterns: sorted longest first, with word boundaries
const wordEntries = Object.entries(WORD_MAP)
  .sort((a, b) => b[0].length - a[0].length);

const wordPatterns = wordEntries.map(([word, replacement]) => ({
  regex: new RegExp(`(?<=^|[\\s,;:(/"'])${escapeRegex(word)}(?=$|[\\s,;:)/"'.!?])`, 'gi'),
  replacement,
}));

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// FIX NAME
// ---------------------------------------------------------------------------

function fixName(name) {
  let result = name;

  // 1. Remove gender markers (a)
  result = result.replace(/\(a\)/g, '');

  // 2. Apply phrase replacements first
  for (const { regex, replacement } of phrasePatterns) {
    result = result.replace(regex, replacement);
  }

  // 3. Apply word replacements (with word boundaries)
  for (const { regex, replacement } of wordPatterns) {
    result = result.replace(regex, replacement);
  }

  // 4. Fix specific Polish phrases
  // "cały, 3.25% milkfat" -> "pełne, 3.25% tłuszczu" (already handled milkfat above)
  result = result.replace(/cały,\s*3\.25%\s*tłuszczu/gi, 'pełne, 3.25% tłuszczu');

  // 5. Clean up whitespace/punctuation artifacts
  result = result.replace(/,,/g, ',');           // double commas
  result = result.replace(/\s{2,}/g, ' ');       // double spaces
  result = result.replace(/,\s*$/g, '');          // trailing commas
  result = result.replace(/^\s+|\s+$/g, '');      // trim
  result = result.replace(/\s+,/g, ',');          // space before comma
  result = result.replace(/,\s{2,}/g, ', ');      // normalize comma spacing

  return result;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Fix Polish Food Translations ===\n');

  // 1. Load all products
  const products = await prisma.foodProduct.findMany({
    select: { id: true, name: true, slug: true },
  });
  console.log(`Loaded ${products.length} products from database.\n`);

  // 2. Compute fixes
  const updates = [];
  for (const p of products) {
    const newName = fixName(p.name);
    if (newName !== p.name) {
      updates.push({ id: p.id, oldName: p.name, newName, oldSlug: p.slug });
    }
  }
  console.log(`Products to update: ${updates.length} out of ${products.length}\n`);

  if (updates.length === 0) {
    console.log('Nothing to update. Exiting.');
    await prisma['$disconnect']();
    return;
  }

  // 3. Generate new slugs, track used slugs
  // First collect all existing slugs that won't change
  const unchangedSlugs = new Set();
  const changingIds = new Set(updates.map(u => u.id));
  for (const p of products) {
    if (!changingIds.has(p.id)) {
      unchangedSlugs.add(p.slug);
    }
  }

  const usedSlugs = new Set(unchangedSlugs);
  for (const u of updates) {
    let baseSlug = slugify(u.newName);
    if (!baseSlug) baseSlug = 'produkt';
    let slug = baseSlug;
    while (usedSlugs.has(slug)) {
      const suffix = crypto.randomBytes(3).toString('hex');
      slug = `${baseSlug}-${suffix}`.slice(0, 200);
    }
    usedSlugs.add(slug);
    u.newSlug = slug;
  }

  // 4. Phase 1: Set temporary slugs to avoid unique constraint conflicts
  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(updates.length / BATCH_SIZE);

  console.log('Phase 1: Setting temporary slugs...');
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    await prisma.$transaction(
      batch.map(u =>
        prisma.foodProduct.update({
          where: { id: u.id },
          data: { slug: `__tmp__${u.id}` },
        })
      )
    );

    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      console.log(`  Phase 1: ${batchNum}/${totalBatches}`);
    }
  }

  // Phase 2: Set final name + slug
  console.log('Phase 2: Applying name fixes and final slugs...');
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    await prisma.$transaction(
      batch.map(u =>
        prisma.foodProduct.update({
          where: { id: u.id },
          data: { name: u.newName, slug: u.newSlug },
        })
      )
    );

    console.log(`  Phase 2: Batch ${batchNum}/${totalBatches} done (${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length} products)`);
  }

  // 5. Summary
  console.log(`\n=== DONE ===`);
  console.log(`Updated: ${updates.length} products`);
  console.log(`\nSample changes (first 10):`);
  for (const u of updates.slice(0, 10)) {
    console.log(`  "${u.oldName}" → "${u.newName}"`);
  }

  await prisma['$disconnect']();
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  await prisma['$disconnect']();
  process.exit(1);
});
