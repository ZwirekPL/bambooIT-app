/**
 * Recipe cuisine-type auto-classifier (S-11).
 *
 * Goal: reduce the 38% of recipes stuck at cuisineType="inna" by
 * deriving cuisine from distinctive ingredient signatures and title
 * keywords. The source data is from ingredient list + title; no LLM.
 *
 * Approach: each cuisine has a scored keyword bag. We accumulate scores
 * across title and ingredients; the highest-scoring cuisine wins if its
 * score meets a confidence threshold, otherwise "inna" stays.
 */

import { normalizeProductName } from './productMatcher';

// ─── Categories ────────────────────────────────────────────────────────────────

export type CuisineType =
  | 'polska'
  | 'włoska'
  | 'azjatycka'
  | 'śródziemnomorska'
  | 'meksykańska'
  | 'indyjska'
  | 'amerykańska'
  | 'francuska'
  | 'bliskowschodnia'
  | 'grecka'
  | 'inna';

interface CuisineSignal {
  cuisine: CuisineType;
  /**
   * Canonical-form patterns. Each matching pattern adds `weight` to the
   * cuisine score for that recipe. Strong signals (e.g. "kimchi" for Korean)
   * get higher weights than weak ones (e.g. "cebula" is universal).
   */
  patterns: Array<{ re: RegExp; weight: number }>;
}

const SIGNALS: CuisineSignal[] = [
  // Włoska — pasta + sery + bazylia + pomidor
  {
    cuisine: 'włoska',
    patterns: [
      { re: /\b(mozzarella|parmezan|ricott|pecorino|gorgonzola|grana\s*padano)\b/, weight: 5 },
      { re: /\b(pesto|basilico|risotto|bolognese|carbonara|arrabiata|amatrician|pizza|margherita|lasagn|cannellon|gnocchi|tagliatell|fettuccin|pappardell|penne|spaghett)\b/, weight: 5 },
      { re: /\b(oliw[ay]\s*z\s*oliw|oliw[ay]\s*extra|balsamic|prosciutto|mortadell|salami\s*milan|parma)\b/, weight: 3 },
      { re: /\b(bazyl|bazylii|orega|tymian|rozmaryn)\b/, weight: 1 },
      { re: /\b(tiramisu|panna\s*cott|limoncello|bruschett|focacc|ciabatt)\b/, weight: 4 },
    ],
  },
  // Azjatycka — sos sojowy + imbir + trawa cytrynowa
  {
    cuisine: 'azjatycka',
    patterns: [
      { re: /\b(sojow[yaeą]|soy\s*sauce|tamari|sriracha|hoisin|teriyaki|miso|mirin|sake|ponzu|oyster\s*sauce)\b/, weight: 5 },
      { re: /\b(imbir|imbiru|trawa\s*cytrynow|lemongrass|limonk|lime\s*leaf|kaffir|galanga)\b/, weight: 3 },
      { re: /\b(sushi|sashimi|tempur|ramen|udon|soba|wakame|nori|dashi|wasabi|gari)\b/, weight: 5 },
      { re: /\b(pad\s*thai|tom\s*yam|phở|pho|bún|curry\s*zielon|curry\s*czerwon|massaman)\b/, weight: 5 },
      { re: /\b(kimchi|gochujang|bibimbap|bulgog|tteok)\b/, weight: 5 },
      { re: /\b(makaron\s*ryzow|kluski\s*ryzow|ryż\s*jaśmin|jasmin|basmat|tofu|edamam)\b/, weight: 2 },
      { re: /\b(woku|wok\b|stir.fry|stirfry)\b/, weight: 3 },
    ],
  },
  // Śródziemnomorska — pokrywa się trochę z grecką / włoską, szeroki koszyk
  {
    cuisine: 'śródziemnomorska',
    patterns: [
      { re: /\b(humus|hummus|tabbouleh|tabule|baba\s*ganou|shakshuka|shaksz|falafel)\b/, weight: 5 },
      { re: /\b(bulgur|kuskus|couscous|tahina|tahini|za.atar)\b/, weight: 4 },
      { re: /\b(oliw[ay]\s*z\s*oliw|oliwk|feta|halloumi|kefalotyri)\b/, weight: 2 },
    ],
  },
  // Grecka
  {
    cuisine: 'grecka',
    patterns: [
      { re: /\b(tzatzik|moussaka|mussak|souvlak|gyros|spanakopit|pastitsi|dolmad|saganak|kefalotyri)\b/, weight: 5 },
      { re: /\b(feta|halloumi|jogurt\s*grec|grec[kaioeą]\s*jogurt|gree?k\s*yog)\b/, weight: 4 },
      { re: /\b(oliwk[ai]\s*kalamat|kalamata)\b/, weight: 4 },
    ],
  },
  // Meksykańska
  {
    cuisine: 'meksykańska',
    patterns: [
      { re: /\b(tortilla|taco|burrito|enchilad|quesadill|fajit|guacamole|salsa\s*verde|salsa\s*roja|nachos)\b/, weight: 5 },
      { re: /\b(jalapen|jalapen|chipotl|poblano|serran|habanero)\b/, weight: 5 },
      { re: /\b(czarn[ae]\s*fasol|black\s*beans|kukurydz|cilantro|kolendr|limonk|lime\b)\b/, weight: 2 },
      { re: /\b(chili\s*con\s*carne|refried|chorizo|queso\s*fresco)\b/, weight: 5 },
    ],
  },
  // Indyjska
  {
    cuisine: 'indyjska',
    patterns: [
      { re: /\b(curry|garam\s*masal|masala|korma|tikka|vindaloo|biryani|daal|dal\b|chana|palak|paneer|naan|chapati|roti|poppadom|samosa|pakora)\b/, weight: 5 },
      { re: /\b(ghee|kardamo|kurkum|kumin|kolendr|koriander|cynamon|gozdz|fenugreek|asafoety|tamaryndow)\b/, weight: 2 },
      { re: /\b(kozirog|kozlak|fenugreek|atta|besan|gram\s*flour|mango\s*chutney)\b/, weight: 4 },
    ],
  },
  // Amerykańska
  {
    cuisine: 'amerykańska',
    patterns: [
      { re: /\b(burger|hot\s*dog|hotdog|mac\s*and\s*cheese|buffal|bbq|barbecue|caesar|cheesecake|brownie|cookie|pancake|waffle|maple\s*syrup|syrop\s*klonow|pulled\s*pork|new\s*orleans|creole|cajun|corn\s*bread)\b/, weight: 5 },
      { re: /\b(chipsy|hamburg|donut|doughnut|pepperoni|pizza\s*amerykan|tex.mex)\b/, weight: 3 },
    ],
  },
  // Francuska
  {
    cuisine: 'francuska',
    patterns: [
      { re: /\b(ratatouille|bouillabaisse|coq\s*au\s*vin|boeuf\s*bourguign|cassoulet|quiche|croissant|baguette|crème\s*brûlée|creme\s*brule|tarte|clafoutis|macaron|beurre\s*blanc|beurre\s*noir|mousse\s*au\s*chocol)\b/, weight: 5 },
      { re: /\b(camembert|brie|roquefort|gruy(e|è)re|comté|comte|époisses|dijon|crème\s*fraîche|creme\s*fraiche|confit|au\s*gratin|parisien)\b/, weight: 4 },
    ],
  },
  // Bliskowschodnia — hummus itd już pokryte w śródziemnomorskiej; tu bardziej specific
  {
    cuisine: 'bliskowschodnia',
    patterns: [
      { re: /\b(shawarma|shawerma|kebab|kibbeh|baba\s*ganoush|muhammara|fatteh|labneh|kofta)\b/, weight: 5 },
      { re: /\b(sumak|ras\s*el\s*hanout|baharat|harissa|pomegranate\s*molass|melasa\s*granat)\b/, weight: 4 },
    ],
  },
  // Polska — ostatnia (weight low), bo pokrywa wiele generic
  {
    cuisine: 'polska',
    patterns: [
      { re: /\b(pierog|bigos|golonk|zurek|barszcz|placki\s*ziemniacz|kotlet\s*schabow|schabow|gulasz|rosol|kluski\s*slas|kopytk|leniw|knedl|sernik|mazurek|pasch|faworki|krokiet)\w*/, weight: 5 },
      { re: /\b(kielbas|boczek|kwasn|kiszon[ae]?\s*kapust|kapust|ogorek\s*kiszon|buraczk)\w*/, weight: 3 },
      { re: /\b(koperk|kminek|majera|ziele\s*angi|lubczyk)\w*/, weight: 2 },
    ],
  },
];

// ─── Scoring ───────────────────────────────────────────────────────────────────

export interface CuisineReport {
  cuisine: CuisineType;
  confidence: number;        // 0-1
  scores: Record<string, number>;
  topSignals: Array<{ cuisine: string; score: number }>;
}

const MIN_CONFIDENCE_SCORE = 4; // need at least this total weight to classify

export function classifyCuisine(
  title: string,
  ingredientNames: string[],
): CuisineReport {
  const corpus = [title, ...ingredientNames]
    .map((s) => normalizeProductName(s))
    .filter(Boolean)
    .join(' ');

  const scores: Record<string, number> = {};
  for (const signal of SIGNALS) {
    let score = 0;
    for (const { re, weight } of signal.patterns) {
      if (re.test(corpus)) score += weight;
    }
    if (score > 0) scores[signal.cuisine] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];

  if (!top || top[1] < MIN_CONFIDENCE_SCORE) {
    return {
      cuisine: 'inna',
      confidence: 0,
      scores,
      topSignals: sorted.map(([c, s]) => ({ cuisine: c, score: s })),
    };
  }

  const totalScore = sorted.reduce((a, [, s]) => a + s, 0);
  const confidence = totalScore > 0 ? top[1] / totalScore : 0;

  return {
    cuisine: top[0] as CuisineType,
    confidence: Math.round(confidence * 100) / 100,
    scores,
    topSignals: sorted.slice(0, 3).map(([c, s]) => ({ cuisine: c, score: s })),
  };
}
