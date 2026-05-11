/**
 * clean-ilewazy-names.js — DRY RUN
 * Reads ILEWAZY products, strips prefixes, converts genitive to nominative.
 * Outputs mapping to data/ilewazy-name-mapping.json for review.
 *
 * Run: node scripts/clean-ilewazy-names.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.resolve(__dirname, '../data/ilewazy-name-mapping.json');

const PREFIX_PATTERNS = [
  { re: /^\d[\d,.]*\s+sztuk[ia]?\s+(.+)$/i, label: 'N sztuk' },
  { re: /^\d[\d,.]*\s+plaster[kó]w?\s+(.+)$/i, label: 'N plastrów' },
  { re: /^\d[\d,.]*\s+plastry?\s+(.+)$/i, label: 'N plastry' },
  { re: /^\d[\d,.]*\s+kawałk[óo]w?\s+(.+)$/i, label: 'N kawałków' },
  { re: /^\d[\d,.]*\s+krom[ek]+\s+(.+)$/i, label: 'N kromek' },
  { re: /^\d[\d,.]*\s+kostek\s+(.+)$/i, label: 'N kostek' },
  { re: /^\d[\d,.]*\s+kulek\s+(.+)$/i, label: 'N kulek' },
  { re: /^\d[\d,.]*\s+rurek\s+(.+)$/i, label: 'N rurek' },
  { re: /^\d[\d,.]*\s+gał[eę]k\s+(.+)$/i, label: 'N gałek' },
  { re: /^\d[\d,.]*\s+gałki\s+(.+)$/i, label: 'N gałki' },
  { re: /^\d[\d,.]*\s+liś[ct][i]*\s+(.+)$/i, label: 'N liści' },
  { re: /^\d[\d,.]*\s+(.+)$/i, label: 'N <word>' },
  { re: /^garść\s+(.+)$/i, label: 'garść' },
  { re: /^łyżeczka\s+(.+)$/i, label: 'łyżeczka' },
  { re: /^łyżka\s+(.+)$/i, label: 'łyżka' },
  { re: /^kawałek\s+(.+)$/i, label: 'kawałek' },
  { re: /^kromka\s+(.+)$/i, label: 'kromka' },
  { re: /^kostka\s+(.+)$/i, label: 'kostka' },
  { re: /^krążek\s+(.+)$/i, label: 'krążek' },
  { re: /^kulka\s+(.+)$/i, label: 'kulka' },
  { re: /^kula\s+(.+)$/i, label: 'kula' },
  { re: /^porcja\s+(.+)$/i, label: 'porcja' },
  { re: /^butelka\s+(.+)$/i, label: 'butelka' },
  { re: /^szklanka\s+(.+)$/i, label: 'szklanka' },
  { re: /^filiżanka\s+(.+)$/i, label: 'filiżanka' },
  { re: /^kieliszek\s+(.+)$/i, label: 'kieliszek' },
  { re: /^kufel\s+(.+)$/i, label: 'kufel' },
  { re: /^lampka\s+(.+)$/i, label: 'lampka' },
  { re: /^plaster\s+(.+)$/i, label: 'plaster' },
  { re: /^plasterek\s+(.+)$/i, label: 'plasterek' },
  { re: /^kiść\s+(.+)$/i, label: 'kiść' },
  { re: /^listek\s+(.+)$/i, label: 'listek' },
  { re: /^gałązka\s+(.+)$/i, label: 'gałązka' },
  { re: /^kartonik\s+(.+)$/i, label: 'kartonik' },
];

const IRREGULAR_MAP = {
  'pistacji':'pistacje','malin':'maliny','migdałów':'migdały',
  'orzechów':'orzechy','orzeszków':'orzeszki','pestek':'pestki',
  'rodzynek':'rodzynki','fig':'figi','daktyli':'daktyle',
  'nerkowców':'nerkowce','kasztanów':'kasztany','fistaszków':'fistaszki',
  'bananów':'banany','wiśni':'wiśnie','czereśni':'czereśnie',
  'jagód':'jagody','jeżyn':'jeżyny','borówek':'borówki',
  'truskawek':'truskawki','porzeczek':'porzeczki','agrestu':'agrest',
  'winogron':'winogrona','oliwek':'oliwki','owoców':'owoce',
  'ziaren':'ziarna','nasion':'nasiona','grzybów':'grzyby',
  'pieczarek':'pieczarki','warzyw':'warzywa',
  'chipsów':'chipsy','chrupek':'chrupki','paluszków':'paluszki',
  'krakersów':'krakersy','herbatników':'herbatniki',
  'ciasteczek':'ciasteczka','ciastek':'ciastka',
  'cukierków':'cukierki','drażetek':'drażetki',
  'czekoladek':'czekoladki','batoników':'batoniki',
  'galaretek':'galaretki','kulek':'kulki','biszkoptów':'biszkopty',
  'sucharków':'sucharki','rurek':'rurki','kumkwatów':'kumkwaty',
  'śliwek':'śliwki','moreli':'morele','brzoskwiń':'brzoskwinie',
  'kostek':'kostki','plastrów':'plastry','kawałków':'kawałki',
  'słupków':'słupki',
  'sera':'ser','serka':'serek','jogurtu':'jogurt','twarogu':'twaróg',
  'mleka':'mleko','masła':'masło','margaryny':'margaryna','oleju':'olej',
  'oliwy':'oliwa','śmietany':'śmietana','śmietanki':'śmietanka',
  'majonezu':'majonez','smalcu':'smalec',
  'pasty':'pasta','dżemu':'dżem','miodu':'miód','cukru':'cukier',
  'soli':'sól','pieprzu':'pieprz','cynamonu':'cynamon','sosu':'sos',
  'ketchupu':'ketchup','musztardy':'musztarda','chrzanu':'chrzan',
  'udźca':'udziec','łopatki':'łopatka','karkówki':'karkówka',
  'polędwicy':'polędwica','kaszanki':'kaszanka',
  'kiełbasy':'kiełbasa','pasztetu':'pasztet','szynki':'szynka',
  'boczku':'boczek','łososia':'łosoś','dorsza':'dorsz',
  'tuńczyka':'tuńczyk','mintaja':'mintaj','makreli':'makrela',
  'pstrąga':'pstrąg','karpia':'karp','halibuta':'halibut',
  'krewetek':'krewetki','udek':'udka',
  'makaronu':'makaron','ryżu':'ryż','kaszy':'kasza','mąki':'mąka',
  'chleba':'chleb','pieczywa':'pieczywo','bułki':'bułka',
  'pierogów':'pierogi','kopytek':'kopytka','knedli':'knedle',
  'papryki':'papryka','pomidoru':'pomidor','ogórka':'ogórek',
  'sałaty':'sałata','szpinaku':'szpinak','marchewki':'marchewka',
  'pietruszki':'pietruszka','selera':'seler','buraka':'burak',
  'ziemniaka':'ziemniak','ziemniaków':'ziemniaki','kapusty':'kapusta',
  'cukinii':'cukinia','dyni':'dynia','bakłażana':'bakłażan',
  'fasoli':'fasola','soczewicy':'soczewica','grochu':'groch',
  'kukurydzy':'kukurydza','czosnku':'czosnek','imbiru':'imbir',
  'wina':'wino','piwa':'piwo','soku':'sok','napoju':'napój',
  'kawy':'kawa','herbaty':'herbata','herbatki':'herbatka','syropu':'syrop',
  'bulionu':'bulion','zupy':'zupa','ciasta':'ciasto',
  'pizzy':'pizza','budyniu':'budyń','lodów':'lody',
  'pełnoziarnistego':'pełnoziarnisty','pełnoziarnistych':'pełnoziarniste',
  'orzechowego':'orzechowy','orzechowej':'orzechowa',
  'kokosowego':'kokosowy','kokosowej':'kokosowa',
  'migdałowego':'migdałowy','migdałowej':'migdałowa',
  'naturalnego':'naturalny','naturalnej':'naturalna',
  'kremowego':'kremowy','kremowej':'kremowa',
  'truskawkowego':'truskawkowy','truskawkowej':'truskawkowa',
  'malinowego':'malinowy','malinowej':'malinowa',
  'jagodowego':'jagodowy','jagodowej':'jagodowa',
  'cytrynowego':'cytrynowy','cytrynowej':'cytrynowa',
  'owocowego':'owocowy','owocowej':'owocowa',
  'drobiowego':'drobiowy','drobiowej':'drobiowa',
  'wieprzowego':'wieprzowy','wieprzowej':'wieprzowa',
  'wołowego':'wołowy','wołowej':'wołowa',
  'tartych':'tarte','tartego':'tarte',
  'blanszowanych':'blanszowane',
  'prażonych':'prażone','prażonego':'prażone','prażonej':'prażona',
  'smażonych':'smażone','smażonego':'smażone',
  'suszonych':'suszone','suszonego':'suszone','suszonej':'suszona',
  'wędzonych':'wędzone','wędzonego':'wędzone','wędzonej':'wędzona',
  'gotowanych':'gotowane','gotowanego':'gotowane','gotowanej':'gotowana',
  'mrożonych':'mrożone','mrożonego':'mrożone',
  'liofilizowanego':'liofilizowany','liofilizowanej':'liofilizowana',
  'liofilizowanych':'liofilizowane',
  'kandyzowanych':'kandyzowane','kandyzowanego':'kandyzowane',
  'solonych':'solone','solonego':'solone',
  'grillowanych':'grillowane','pieczonych':'pieczone',
  'pieczonego':'pieczone','pieczonej':'pieczona',
  'surowych':'surowe','surowego':'surowe',
  'świeżego':'świeże','świeżej':'świeża',
  'czarnego':'czarne','czarnej':'czarna',
  'białego':'białe','białej':'biała',
  'czerwonego':'czerwone','czerwonej':'czerwona',
  'zielonego':'zielone','zielonej':'zielona',
  'odtłuszczonego':'odtłuszczony',
  'mielonego':'mielony','mielonej':'mielona',
  'bezglutenowego':'bezglutenowy',
  'bezjajecznego':'bezjajeczny',
  'złotego':'złoty',
  'masy':'masa','gałki':'gałki',
  'karamboli':'karambola','kandyzowanej':'kandyzowana',
  'jajecznej':'jajeczna',
  'siemienia':'siemię',
  'lodów':'lody',
  'gałki':'gałki',
  'gorzkiej':'gorzka',
  'karamboli':'karambola',
  'amarantusków':'amarantuski',
  'baryłek':'baryłki',
  'suszonych':'suszone',
  'jajek':'jajka',
  'przepiórczych':'przepiórcze',
  'jajeczek':'jajeczka',
  'ptasiego':'ptasie',
  'mleczka':'mleczko',
  'leniwych':'leniwe',
  'pomidorowego':'pomidorowy',
  'cielęcego':'cielęcy',
  'wołowego':'wołowy',
  'sezamowego':'sezamowy',
  'lnianego':'lniany',
  'jaglane':'jaglane',
  'słodzonej':'słodzona',
  'gazowanej':'gazowana',
  'niegazowanej':'niegazowana',
  'ziemniaczanych':'ziemniaczane',
  'ryżowych':'ryżowe',
  'orkiszowych':'orkiszowe',
  'bekonowych':'bekonowe',
};

const SUFFIX_RULES = [
  { sfx:'iego', rep:'y' },
  { sfx:'owej', rep:'owa' },
  { sfx:'iej', rep:'ia' },
  { sfx:'ego', rep:'e' },
  { sfx:'owych', rep:'owe' },
  { sfx:'anych', rep:'ane' },
  { sfx:'onych', rep:'one' },
  { sfx:'nych', rep:'ne' },
  { sfx:'ków', rep:'ki' },
  { sfx:'tów', rep:'ty' },
  { sfx:'dów', rep:'dy' },
  { sfx:'nów', rep:'ny' },
  { sfx:'ów', rep:'y' },
  { sfx:'ek', rep:'ki' },
];

const STOP_WORDS = new Set([
  'z','ze','w','we','na','i','a','o','do','bez','po','przy',
  'przed','przez','dla','od','pod','nad','za','plus','bio','light','%',
]);

function inflectWord(rawToken) {
  const lower = rawToken.toLowerCase();
  if (STOP_WORDS.has(lower)) return rawToken;
  if (rawToken.startsWith('(') || rawToken.endsWith(')')) return rawToken;
  if (rawToken === rawToken.toUpperCase() && /[A-ZŁŚŹŻĆŃÓĄĘ]{2,}/.test(rawToken)) return rawToken;
  if (IRREGULAR_MAP[lower]) return IRREGULAR_MAP[lower];
  for (const { sfx, rep } of SUFFIX_RULES) {
    if (lower.endsWith(sfx) && lower.length > sfx.length + 2) {
      return lower.slice(0, -sfx.length) + rep;
    }
  }
  return rawToken;
}

// Prepositions after which words stay in their original case (locative/genitive)
const PREPOSITIONS = new Set([
  'w','we','z','ze','na','do','bez','po','przy','przed','przez',
  'dla','od','pod','nad','za','ku','o','między',
]);

function processName(name) {
  const trimmed = name.trim();
  for (const { re, label } of PREFIX_PATTERNS) {
    const m = trimmed.match(re);
    if (!m) continue;
    const remainder = m[1].trim();
    const tokens = remainder.split(/\s+/);

    // Inflect tokens BEFORE the first preposition
    // After a preposition, words stay in their grammatical case
    // Special handling: adjectives before nouns (e.g., "kruchych ciastek" → "kruche ciastka")
    let afterPreposition = false;
    const converted = tokens.map((tok, idx) => {
      const lower = tok.toLowerCase();
      if (PREPOSITIONS.has(lower)) {
        afterPreposition = true;
        return tok;
      }
      if (afterPreposition) return tok;

      // Adjective genitive plural ending in -ych/-ich before a noun
      // These need special handling: "kruchych" → "kruche", "białych" → "białe"
      if (/ych$/i.test(lower) || /ich$/i.test(lower)) {
        // Check IRREGULAR_MAP first
        if (IRREGULAR_MAP[lower]) return IRREGULAR_MAP[lower];
        // Generic: -ych → -e, -ich → -e (nominative plural neuter/non-masculine)
        if (lower.endsWith('ych')) return lower.slice(0, -3) + 'e';
        if (lower.endsWith('ich')) return lower.slice(0, -3) + 'ie';
      }

      return inflectWord(tok);
    });

    const joined = converted.join(' ');
    const finalName = joined.charAt(0).toUpperCase() + joined.slice(1);
    const hasResidual = !afterPreposition && joined.toLowerCase().split(/\s+/).some(w =>
      !STOP_WORDS.has(w) && (/ów$/.test(w) || /iego$/.test(w) || /owej$/.test(w))
    );
    return { cleanName: finalName, prefix: label, needsReview: hasResidual || finalName.length < 3 };
  }
  return { cleanName: trimmed, prefix: null, needsReview: false };
}

async function main() {
  console.log('=== ILEWAZY Name Cleaner — DRY RUN ===\n');

  const prisma = new PrismaClient();
  const products = await prisma.cleanProduct.findMany({
    where: { sourcePrimary: 'ILEWAZY' },
    select: { id: true, name: true, slug: true, category: true },
    orderBy: { name: 'asc' },
  });
  await prisma.$disconnect();

  console.log(`Loaded ${products.length} ILEWAZY products.\n`);

  const mapping = {};
  const flagged = [];
  const prefixCounts = {};
  let alreadyClean = 0;

  for (const prod of products) {
    const { cleanName, prefix, needsReview } = processName(prod.name);
    if (prefix === null) { alreadyClean++; continue; }
    prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
    if (cleanName !== prod.name) mapping[prod.name] = cleanName;
    if (needsReview) flagged.push({ original: prod.name, proposed: cleanName, prefix, category: prod.category });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), totalProducts: products.length, withPrefix: Object.keys(mapping).length, alreadyClean, flaggedForReview: flagged.length, prefixBreakdown: prefixCounts, mapping, flaggedEntries: flagged }, null, 2), 'utf8');

  console.log(`Total:          ${products.length}`);
  console.log(`Changed:        ${Object.keys(mapping).length}`);
  console.log(`Already clean:  ${alreadyClean}`);
  console.log(`Flagged:        ${flagged.length}`);
  console.log('\nPrefix breakdown:');
  for (const [label, count] of Object.entries(prefixCounts).sort(([,a],[,b]) => b - a)) {
    console.log(`  ${String(count).padStart(4)}  ${label}`);
  }
  console.log('\nSample conversions:');
  let shown = 0;
  for (const [old, nw] of Object.entries(mapping)) {
    if (shown++ >= 30) break;
    console.log(`  "${old}" → "${nw}"`);
  }
  if (flagged.length > 0) {
    console.log(`\n⚠️  FLAGGED for review (${flagged.length}):`);
    for (const e of flagged.slice(0, 20)) console.log(`  [${e.category}] "${e.original}" → "${e.proposed}"`);
    if (flagged.length > 20) console.log(`  ...and ${flagged.length - 20} more in JSON.`);
  }
  console.log(`\nOutput: ${OUTPUT_PATH}`);
  console.log('DRY RUN — no database changes.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
