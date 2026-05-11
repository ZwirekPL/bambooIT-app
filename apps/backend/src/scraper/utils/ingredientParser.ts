/**
 * Deterministic Polish ingredient parser.
 *
 * Takes a free-form Polish recipe ingredient line and extracts:
 *   { quantity, unit, canonicalUnit, estimatedGrams, name, modifiers, notes }
 *
 * Designed to replace the OpenAI call in pipeline/02-normalize.ts for the 80%+
 * of cases that are regular. Falls back to `grams=null` when unparseable.
 *
 * Handles:
 *   - Polish quantity: "2", "1/2", "½", "1,5", "1.5", "2-3" (range → avg),
 *     "kilka" (~3), "około 2", "pół" (0.5), "ćwierć" (0.25)
 *   - Polish units with inflection: łyżka/łyżki/łyżek, szklanka/szklanki/szklanek,
 *     pęczek/pęczka, ząbek/ząbki/ząbków, sztuka/sztuki/szt, plaster/plastry, etc.
 *   - Weight/volume units: g, kg, ml, l, dag (1dag=10g)
 *   - Modifiers: "duża", "mała", "świeży", "suszony" — kept as notes
 *   - Brand stripping: "oliwa Monini" → "oliwa"
 *   - Trailing qualifiers: "do smaku", "opcjonalnie", "posiekany", "obrany"
 */

// ─── Output type ───────────────────────────────────────────────────────────────

export type CanonicalUnit =
  | 'g'            // grams (literal)
  | 'ml'           // milliliters
  | 'piece'        // whole pieces (szt)
  | 'tbsp'         // łyżka stołowa (15ml/15g default)
  | 'tsp'          // łyżeczka (5ml/5g default)
  | 'cup'          // szklanka (250ml default)
  | 'bunch'        // pęczek
  | 'clove'        // ząbek
  | 'pinch'        // szczypta
  | 'handful'      // garść
  | 'slice'        // plaster / kromka
  | 'stick'        // laska (wanilii/cynamonu)
  | 'can'          // puszka
  | 'jar'          // słoik
  | 'package'      // opakowanie/paczka
  | 'drop'         // kropla
  | 'none';        // pure count or taste-only

export interface ParsedIngredient {
  originalText: string;
  quantity: number | null;      // null if "do smaku" / "szczypta" / count-less
  unit: string | null;          // original unit string as parsed
  canonicalUnit: CanonicalUnit;
  estimatedGrams: number | null;
  name: string;                 // cleaned product name
  modifiers: string[];          // "duża", "świeży", "suszony"
  notes: string[];              // "do smaku", "opcjonalnie"
  tasteOnly: boolean;           // true when "do smaku" / spice without qty
}

// ─── Polish unit dictionary ────────────────────────────────────────────────────

// All recognized forms map to a single canonical unit. Forms cover Polish
// inflection (nom/gen/acc/inst/loc, singular & plural).
const UNIT_FORMS: Record<string, CanonicalUnit> = {
  // grams
  g: 'g', gram: 'g', gramy: 'g', gramów: 'g', gr: 'g',
  dag: 'g', dkg: 'g',   // deka = 10g — handled with *10 conversion below
  kg: 'g', kilogram: 'g', kilogramy: 'g', kilo: 'g', // *1000
  // volumes
  ml: 'ml', mililitr: 'ml', mililitry: 'ml', mililitrów: 'ml',
  l: 'ml', litr: 'ml', litry: 'ml', litrów: 'ml', // *1000
  // kitchen measures
  'łyżka': 'tbsp', 'łyżki': 'tbsp', 'łyżek': 'tbsp', 'łyżkę': 'tbsp', 'łyżką': 'tbsp',
  'łyżka stołowa': 'tbsp', 'łyżek stołowych': 'tbsp',
  'łyżeczka': 'tsp', 'łyżeczki': 'tsp', 'łyżeczek': 'tsp', 'łyżeczkę': 'tsp', 'łyżeczką': 'tsp',
  szklanka: 'cup', szklanki: 'cup', szklanek: 'cup', 'szklankę': 'cup', 'szklanką': 'cup',
  kubek: 'cup', kubka: 'cup', kubki: 'cup', 'kubków': 'cup',
  'pęczek': 'bunch', 'pęczka': 'bunch', 'pęczki': 'bunch', 'pęczków': 'bunch', 'pęczkiem': 'bunch',
  'ząbek': 'clove', 'ząbka': 'clove', 'ząbki': 'clove', 'ząbków': 'clove', 'ząbkiem': 'clove',
  szczypta: 'pinch', szczypty: 'pinch', szczyptą: 'pinch',
  'garść': 'handful', 'garści': 'handful', 'garściami': 'handful',
  plaster: 'slice', plastry: 'slice', plastrów: 'slice', 'plasterek': 'slice', 'plasterki': 'slice', 'plasterków': 'slice',
  kromka: 'slice', kromki: 'slice', kromek: 'slice',
  laska: 'stick', laski: 'stick', lasek: 'stick',
  puszka: 'can', puszki: 'can', puszek: 'can', 'puszkę': 'can',
  'słoik': 'jar', 'słoika': 'jar', 'słoiki': 'jar', 'słoików': 'jar',
  opakowanie: 'package', opakowania: 'package', 'opakowań': 'package', paczka: 'package', paczki: 'package',
  kropla: 'drop', kropli: 'drop', kropel: 'drop',
  // piece forms
  sztuka: 'piece', sztuki: 'piece', sztuk: 'piece', 'sztukę': 'piece', szt: 'piece',
};

// Extra prefix that forces volume semantics even when the word could be count
const SCALE_MULTIPLIERS: Record<string, number> = {
  kg: 1000, kilogram: 1000, kilogramy: 1000, kilo: 1000,
  l: 1000, litr: 1000, litry: 1000, litrów: 1000,
  dag: 10, dkg: 10,
};

// ─── Default grams per canonical unit (when product not known) ─────────────────

/**
 * Sensible defaults when we don't know which CleanProduct a recipe line maps
 * to yet. Callers with a `HouseholdMeasure` override should prefer that.
 */
const DEFAULT_GRAMS: Record<CanonicalUnit, number | null> = {
  g: 1,          // identity
  ml: 1,         // assume water density — caller should refine per product
  piece: 80,     // a medium onion/tomato baseline
  tbsp: 15,      // 1 tablespoon = 15g of mid-density food
  tsp: 5,        // 1 teaspoon = 5g
  cup: 240,      // 1 cup ≈ 240ml of mid-density food
  bunch: 30,     // pęczek natki/koperku
  clove: 5,      // ząbek czosnku
  pinch: 1,      // szczypta soli/pieprzu
  handful: 30,   // garść orzechów / suszonych owoców
  slice: 25,     // plaster wędliny / sera
  stick: 2,      // laska wanilii/cynamonu
  can: 400,      // puszka warzyw
  jar: 300,      // słoik przetworów
  package: 200,  // paczka
  drop: 0.1,
  none: null,
};

// ─── Quantity parsing ──────────────────────────────────────────────────────────

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

const WORD_QUANTITIES: Record<string, number> = {
  'pół': 0.5, 'połowa': 0.5, 'połowy': 0.5, 'połówka': 0.5, 'pol': 0.5,
  'ćwierć': 0.25, 'ćwiartka': 0.25,
  kilka: 3, kilku: 3, kilkoro: 3, kilkanaście: 12,
  pare: 2, 'parę': 2, pary: 2,
  jedna: 1, jeden: 1, jedno: 1, jednej: 1, jedną: 1,
  'dwa': 2, dwie: 2, dwoje: 2,
  'trzy': 3, trzech: 3, troje: 3,
  'cztery': 4, czterech: 4, czworo: 4,
  'pięć': 5, 'pięciu': 5, 'pięcioro': 5,
  'sześć': 6, 'sześciu': 6,
  'siedem': 7, siedmiu: 7,
  'osiem': 8, 'ośmiu': 8,
  'dziewięć': 9, 'dziewięciu': 9,
  'dziesięć': 10, 'dziesięciu': 10,
};

/**
 * Parse a leading quantity token. Returns consumed length and numeric value.
 * Supports: "2", "1.5", "1,5", "1/2", "1 1/2", "½", "około 2", "kilka", ranges.
 */
function parseQuantity(input: string): { value: number | null; rest: string } {
  let s = input.trim();

  // strip leading "około", "ok.", "~", "prawie"
  const approxRe = /^(?:około|ok\.?|ok|~|prawie|niespełna)\s+/i;
  if (approxRe.test(s)) s = s.replace(approxRe, '');

  // Unicode fraction alone at start (½ łyżeczki soli)
  const ufMatch = s.match(/^([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])\s*/);
  if (ufMatch) {
    return { value: UNICODE_FRACTIONS[ufMatch[1]], rest: s.slice(ufMatch[0].length) };
  }

  // "1 ½"
  const mixedUnicodeMatch = s.match(/^(\d+)\s+([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])\s*/);
  if (mixedUnicodeMatch) {
    const value = parseInt(mixedUnicodeMatch[1], 10) + UNICODE_FRACTIONS[mixedUnicodeMatch[2]];
    return { value, rest: s.slice(mixedUnicodeMatch[0].length) };
  }

  // "1 1/2" mixed fraction
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*/);
  if (mixedMatch) {
    const value = parseInt(mixedMatch[1], 10) + parseInt(mixedMatch[2], 10) / parseInt(mixedMatch[3], 10);
    return { value, rest: s.slice(mixedMatch[0].length) };
  }

  // "1/2"
  const fractionMatch = s.match(/^(\d+)\s*\/\s*(\d+)\s*/);
  if (fractionMatch) {
    const value = parseInt(fractionMatch[1], 10) / parseInt(fractionMatch[2], 10);
    return { value, rest: s.slice(fractionMatch[0].length) };
  }

  // Range "2-3" or "2–3" or "2 do 3" → average
  const rangeMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:-|–|do)\s*(\d+(?:[.,]\d+)?)\s*/);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1].replace(',', '.'));
    const b = parseFloat(rangeMatch[2].replace(',', '.'));
    return { value: (a + b) / 2, rest: s.slice(rangeMatch[0].length) };
  }

  // Decimal number "1.5" or "1,5"
  const decimalMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*/);
  if (decimalMatch) {
    const value = parseFloat(decimalMatch[1].replace(',', '.'));
    return { value, rest: s.slice(decimalMatch[0].length) };
  }

  // Polish word quantities — use lookahead instead of \b because Polish letters
  // (ć, ś, ż) are not in JS default \w class, so \b misbehaves after them.
  const wordMatch = s.match(/^([a-ząęćłńóśźż]+)(?=\s|[.,;:!?]|$)/i);
  if (wordMatch) {
    const word = wordMatch[1].toLowerCase();
    if (WORD_QUANTITIES[word] != null) {
      return { value: WORD_QUANTITIES[word], rest: s.slice(wordMatch[0].length) };
    }
  }

  return { value: null, rest: s };
}

// ─── Unit parsing ──────────────────────────────────────────────────────────────

/**
 * Try to consume a unit token from the start of the string.
 * Returns consumed token (for display), canonical unit, and grams multiplier
 * for the scale prefix (kg → *1000, dag → *10).
 */
function parseUnit(input: string): { unit: string | null; canonical: CanonicalUnit; scale: number; rest: string } {
  const s = input.trim();
  // Try two-word units first (łyżka stołowa, łyżek stołowych).
  // Lookahead replaces \b because Polish letters break default word boundary.
  const twoWord = s.match(/^([a-ząęćłńóśźż.]+)\s+([a-ząęćłńóśźż]+)(?=\s|[.,;:]|$)/i);
  if (twoWord) {
    const two = `${twoWord[1]} ${twoWord[2]}`.toLowerCase();
    if (UNIT_FORMS[two]) {
      return {
        unit: two,
        canonical: UNIT_FORMS[two],
        scale: SCALE_MULTIPLIERS[twoWord[1].toLowerCase()] ?? 1,
        rest: s.slice(twoWord[0].length),
      };
    }
  }

  // Single-word unit (with or without trailing dot).
  const oneWord = s.match(/^([a-ząęćłńóśźż]+)(\.)?(?=\s|[.,;:]|$)/i);
  if (oneWord) {
    const token = oneWord[1].toLowerCase();
    if (UNIT_FORMS[token]) {
      return {
        unit: token,
        canonical: UNIT_FORMS[token],
        scale: SCALE_MULTIPLIERS[token] ?? 1,
        rest: s.slice(oneWord[0].length),
      };
    }
  }

  return { unit: null, canonical: 'none', scale: 1, rest: s };
}

// ─── Brand stripping ───────────────────────────────────────────────────────────

const BRAND_LIST = [
  'knorr', 'winiary', 'hellmann\'s', 'hellmanns', 'maggi', 'kamis', 'prymat',
  'łowicz', 'pudliszki', 'tymbark', 'danone', 'zott', 'mlekovita', 'president',
  'lurpak', 'rama', 'kasia', 'delecta', 'gellwe', 'bakalland', 'okocim',
  'monini', 'filippo berio', 'olitalia', 'carrefour', 'tesco', 'lidl',
  'biedronka', 'tonina', 'tesco value', 'aro', 'pilos', 'milbona',
  'rio mare', 'karlsbad', 'primavera', 'orzechy dotyk natury',
];

function stripBrand(text: string): string {
  let out = text;
  for (const brand of BRAND_LIST) {
    const re = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, '');
  }
  return out.replace(/\s+/g, ' ').trim();
}

// ─── Modifiers & notes extraction ──────────────────────────────────────────────

const TRAILING_NOTE_PHRASES = [
  'do smaku', 'według uznania', 'wedle uznania', 'opcjonalnie',
  'do dekoracji', 'do podania',
  'świeżo mielony', 'świeżo zmielony', 'świeżo posiekany',
  'posiekany', 'posiekana', 'posiekane', 'grubo posiekany', 'drobno posiekany',
  'starty', 'starta', 'starte',
  'obrany', 'obrana', 'obrane',
  'pokrojony w kostkę', 'pokrojona w kostkę', 'pokrojone w kostkę',
  'pokrojony w plastry', 'pokrojona w plastry',
  'umyty', 'umyta', 'umyte',
  'świeży', 'świeża', 'świeże',
  'suszony', 'suszona', 'suszone',
  'mrożony', 'mrożona', 'mrożone',
  'opcjonalny', 'opcjonalna',
];

const MODIFIER_WORDS = new Set([
  // size — all cases (nom/gen/acc/inst)
  'duża', 'duże', 'duży', 'dużą', 'dużej', 'dużego', 'dużych', 'duzych', 'dużym',
  'mała', 'małe', 'mały', 'małą', 'małej', 'małego', 'małych',
  'średnia', 'średnie', 'średni', 'średnią', 'średniej', 'średniego', 'średnich',
  'wielkiej', 'wielkie', 'wielkich',
  // freshness / state — cover all Polish cases
  'świeża', 'świeże', 'świeży', 'świeżą', 'świeżej', 'świeżego', 'świeżych', 'świeżo',
  'suszona', 'suszone', 'suszony', 'suszoną', 'suszonej', 'suszonego', 'suszonych',
  'mrożona', 'mrożone', 'mrożony', 'mrożoną', 'mrożonej', 'mrożonego', 'mrożonych',
  'mielona', 'mielone', 'mielony', 'mieloną', 'mielonej', 'mielonego', 'mielonych',
  'gotowana', 'gotowane', 'gotowany', 'gotowaną', 'gotowanej', 'gotowanego', 'gotowanych',
  'pieczona', 'pieczone', 'pieczony', 'pieczoną', 'pieczonej', 'pieczonego', 'pieczonych',
  'drobno', 'grubo',
  'dojrzała', 'dojrzałe', 'dojrzały', 'dojrzałą', 'dojrzałej', 'dojrzałego',
]);

function stripTrailingNotes(text: string): { clean: string; notes: string[] } {
  let s = text.trim();
  const notes: string[] = [];

  // Strip known trailing phrases iteratively, case-insensitive
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of TRAILING_NOTE_PHRASES) {
      // phrase could appear anywhere — but most often at the end
      const re = new RegExp(`[,\\s-]*\\b${phrase}\\b\\s*$`, 'i');
      if (re.test(s)) {
        s = s.replace(re, '').trim();
        notes.push(phrase);
        changed = true;
      }
    }
  }

  return { clean: s, notes };
}

function extractModifiers(text: string): { clean: string; modifiers: string[] } {
  const tokens = text.split(/\s+/);
  const modifiers: string[] = [];
  const kept: string[] = [];

  for (const tok of tokens) {
    const low = tok.toLowerCase().replace(/[.,]$/, '');
    if (MODIFIER_WORDS.has(low)) {
      modifiers.push(low);
    } else {
      kept.push(tok);
    }
  }

  return { clean: kept.join(' ').trim(), modifiers };
}

// ─── Compound splitter ─────────────────────────────────────────────────────────

/**
 * Split lines like "sól i pieprz do smaku" into ["sól do smaku", "pieprz do smaku"].
 * Detects: "X i Y", "X, Y", "X oraz Y" where X and Y are short (< 30 chars each).
 * Rejects compound patterns "X: A, B" (list after colon) — caller should handle.
 */
export function splitCompound(text: string): string[] {
  // Don't split category-like lists with a colon: "orzechy: włoskie, nerkowce"
  if (/:/.test(text)) return [text];

  // Simple "X i Y do smaku" pattern
  const iMatch = text.match(/^(.{1,40}?)\s+i\s+(.{1,40}?)(\s+do\s+smaku)?$/i);
  if (iMatch) {
    const left = iMatch[1].trim();
    const right = iMatch[2].trim();
    const suffix = iMatch[3] || '';
    // Both sides must look like simple ingredient names (short, no numbers)
    if (!/\d/.test(left) && !/\d/.test(right) && left.length >= 2 && right.length >= 2) {
      return [left + suffix, right + suffix];
    }
  }

  return [text];
}

// ─── Main parser ───────────────────────────────────────────────────────────────

const TASTE_PATTERNS = /\b(?:do smaku|wedle uznania|według uznania)\b/i;

/**
 * Trim trailing qualifiers and descriptions from the product name.
 * Keeps the head (first ingredient reference) and drops:
 *   - comment after "," / "-" / "—" / "("
 *   - "np. X" (example)
 *   - "lub X"/"ew. X" (alternatives)
 */
function trimDescription(name: string): string {
  let s = name;

  // 1. Strip leading non-ingredient prefixes. These can appear alone ("opcjonalnie")
  //    or connected to the real name by a dash ("opcjonalnie - 50 ml wina").
  //    Require whitespace or punctuation after the prefix so we don't chop
  //    inside real words (e.g. "Pomidor" must not lose its "Po" prefix).
  s = s.replace(/^(?:po|ok\.?|około|opcjonalnie|ew\.?|ewentualnie)(?=\s|[-–—:])\s*[-–—:]?\s*/i, '');

  // 2. Drop everything after the first description separator. Only apply when
  //    there is meaningful content before it (≥3 chars) so we don't strip
  //    a real name that happens to start with a separator-like character.
  const cutMatch = s.match(/^(.{3,}?)\s*[,\-–—(]/);
  if (cutMatch) s = cutMatch[1].trim();

  // 3. Drop trailing "lub ..." / "np. ..." / "albo ..."
  s = s.replace(/\s+(?:lub|np\.?|albo)\s+.*$/i, '');

  return s.trim();
}

export function parseIngredient(text: string): ParsedIngredient {
  const originalText = text;
  let working = text.trim().replace(/\s+/g, ' ');

  // Early: "do smaku" without quantity
  const isTasteOnly = TASTE_PATTERNS.test(working) && !/^\d/.test(working) && !/^[½⅓⅔¼¾]/.test(working);

  // Strip brands before extracting quantity/unit (brand shouldn't block parsing)
  working = stripBrand(working);

  // Strip trailing notes (do smaku, posiekany, itp.)
  const { clean: afterNotes, notes } = stripTrailingNotes(working);
  working = afterNotes;

  // Parse quantity
  const { value: parsedQuantity, rest: afterQty } = parseQuantity(working);
  working = afterQty;

  // Parse unit (if quantity present or not — some lines have unit without qty)
  const { unit, canonical, scale, rest: afterUnit } = parseUnit(working);
  working = afterUnit;

  // When we recognize a kitchen unit but quantity is absent ("pęczek natki",
  // "garść orzechów", "szczypta soli") — imply quantity = 1.
  const quantity = parsedQuantity == null && canonical !== 'none' ? 1 : parsedQuantity;

  // Extract modifiers (duża, mała, świeży)
  const { clean: afterModifiers, modifiers } = extractModifiers(working);

  // Name is what remains — trim punctuation
  let name = afterModifiers.replace(/^[-–,;:\s]+|[-–,;:\s]+$/g, '').trim();
  // Normalize whitespace
  name = name.replace(/\s+/g, ' ');
  // Trim descriptions / alternatives ("Schabu, najlepiej..." → "Schabu")
  name = trimDescription(name);

  // Apply scale to quantity (kg → g, l → ml)
  const scaledQuantity = quantity != null ? quantity * scale : null;

  // Compute estimatedGrams using default grams for canonical unit
  let estimatedGrams: number | null = null;
  if (scaledQuantity != null) {
    const per = DEFAULT_GRAMS[canonical];
    if (per != null) estimatedGrams = Math.round(scaledQuantity * per * 100) / 100;
  } else if (isTasteOnly || canonical === 'pinch') {
    estimatedGrams = DEFAULT_GRAMS.pinch;
  }

  return {
    originalText,
    quantity: scaledQuantity,
    unit: unit,
    canonicalUnit: canonical,
    estimatedGrams,
    name,
    modifiers,
    notes,
    tasteOnly: isTasteOnly,
  };
}

/**
 * Parse a list of ingredient lines, expanding compounds ("sól i pieprz").
 */
export function parseIngredientList(lines: string[]): ParsedIngredient[] {
  const out: ParsedIngredient[] = [];
  for (const line of lines) {
    for (const piece of splitCompound(line)) {
      out.push(parseIngredient(piece));
    }
  }
  return out;
}
