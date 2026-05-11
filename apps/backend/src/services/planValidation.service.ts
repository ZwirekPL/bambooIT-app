import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { decryptJson } from '../utils/encryption';

// ─── Content types ─────────────────────────────────────────────────────────────

/** Individual ingredient in a meal item (24.7) */
export interface PlanIngredient {
  name: string;
  grams: number;
}

export interface PlanItem {
  name: string;
  grams: number;
  /** Total kcal for this serving (not per 100 g) */
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Separate ingredients for shopping list aggregation (24.7) */
  ingredients?: PlanIngredient[];
}

/** Recipe variant for a specific kitchen appliance (17.3.3) */
export interface RecipeVariant {
  appliance: 'THERMOMIX' | 'AIRFRYER';
  prepTimeMin: number;
  steps: string[];
  tips?: string;
}

/** Recipe attached to a meal (17.3) */
export interface MealRecipe {
  prepTimeMin: number;
  steps: string[];
  tips?: string;
  /** Appliance-specific recipe variants (17.3.3) */
  variants?: RecipeVariant[];
}

export interface PlanMeal {
  name: string;
  items: PlanItem[];
  /** Step-by-step recipe for this meal (17.3) */
  recipe?: MealRecipe;
  /** Weighted average glycemic index of ingredients (82.1) */
  glycemicIndex?: number;
  /** Solver decision reasons for this meal (82.10) */
  reasons?: string[];
  /** Cooking method detected from recipe (84.3) */
  cookingMethod?: string;
}

export interface PlanDay {
  day: string;
  meals: PlanMeal[];
}

export interface PlanContent {
  days: PlanDay[];
  [key: string]: unknown;
}

// ─── Validation result types ──────────────────────────────────────────────────

export type ValidationStatus = 'VALID' | 'NEEDS_ADJUST' | 'NEEDS_REPAIR_AI';

export interface ValidationIssue {
  type: 'KCAL' | 'PROTEIN' | 'FAT' | 'CARBS' | 'ALLERGEN' | 'PREFERENCE';
  message: string;
  actual?: number;
  expected?: number;
}

export interface ValidationResult {
  status: ValidationStatus;
  issues: ValidationIssue[];
  avgDailyKcal: number;
  avgDailyProteinG: number;
  avgDailyFatG: number;
  avgDailyCarbsG: number;
}

export interface ShoppingListItem {
  name: string;
  totalGrams: number;
}

/** Enhanced shopping list item with meal usage tracking (19.1) + piece conversion (24.7) */
export interface ShoppingListDetailItem {
  name: string;
  totalGrams: number;
  category: string;
  /** Which meals use this ingredient, e.g. "Pon Śniadanie (50g), Śr Obiad (120g)" */
  usedIn: Array<{ day: string; meal: string; grams: number }>;
  /** Human-friendly unit conversion, e.g. "2 szt.", "3 kromki" (24.7.4) */
  pieces?: string;
  /** True for seasonings typically used "to taste" (salt, pepper, cinnamon) — display without grams */
  tasteOnly?: boolean;
}

export interface ShoppingListCategory {
  category: string;
  items: ShoppingListDetailItem[];
}

// ─── Tolerances ────────────────────────────────────────────────────────────────

/** ±5 % → VALID, ±20 % → NEEDS_ADJUST, >20 % → NEEDS_REPAIR_AI */
const KCAL_VALID_TOL = 0.05;
const KCAL_REPAIR_TOL = 0.20;
/** ±10 % tolerance for protein / fat / carbs */
const MACRO_VALID_TOL = 0.10;
/** Hard floor: never accept plan below this kcal/day unless explicitly allowed (32.3.2) */
const HARD_FLOOR_KCAL = 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDays(content: Record<string, unknown>): PlanDay[] {
  const raw = content['days'];
  if (!Array.isArray(raw)) return [];
  return raw as PlanDay[];
}

function allItems(days: PlanDay[]): PlanItem[] {
  const items: PlanItem[] = [];
  for (const day of days) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        items.push(item);
      }
    }
  }
  return items;
}

function avgDailyTotals(days: PlanDay[]) {
  if (days.length === 0) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };

  let kcal = 0, protein = 0, fat = 0, carbs = 0;
  for (const day of days) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        kcal    += Number(item.kcal)    || 0;
        protein += Number(item.protein) || 0;
        fat     += Number(item.fat)     || 0;
        carbs   += Number(item.carbs)   || 0;
      }
    }
  }

  return {
    kcal:    Math.round(kcal    / days.length),
    protein: Math.round(protein / days.length),
    fat:     Math.round(fat     / days.length),
    carbs:   Math.round(carbs   / days.length),
  };
}

// ─── Macro validation helpers ─────────────────────────────────────────────────

function macroIssue(
  actual: number,
  target: number,
  type: ValidationIssue['type'],
  label: string,
  tol: number,
): ValidationIssue | null {
  if (target === 0) return null;
  const ratio = Math.abs(actual - target) / target;
  if (ratio <= tol) return null;
  return {
    type,
    message: `${label}: actual ${actual}, target ${target} (diff ${Math.round(ratio * 100)}%)`,
    actual,
    expected: target,
  };
}

// ─── Allergen check (7.9.5) ───────────────────────────────────────────────────

type AllergenKey = 'gluten' | 'lactose' | 'nuts' | 'soy' | 'eggs' | 'fish' | 'celery' | 'mustard' | 'sesame';

const ALLERGEN_LABEL_MAP: Record<string, AllergenKey> = {
  gluten: 'gluten',
  lactose: 'lactose',
  nuts: 'nuts',
  soy: 'soy',
  eggs: 'eggs',
  fish: 'fish',
  celery: 'celery',
  mustard: 'mustard',
  sesame: 'sesame',
  // Polish synonyms
  gluten_pl: 'gluten',
  laktoza: 'lactose',
  orzechy: 'nuts',
  soja: 'soy',
  jajka: 'eggs',
  ryby: 'fish',
  seler: 'celery',
  gorczyca: 'mustard',
  sezam: 'sesame',
};

async function checkAllergens(
  items: PlanItem[],
  patientAllergens: string[],
): Promise<ValidationIssue[]> {
  if (patientAllergens.length === 0) return [];

  const allergenKeys: AllergenKey[] = [];
  for (const a of patientAllergens) {
    const key = ALLERGEN_LABEL_MAP[a.toLowerCase().trim()];
    if (key && !allergenKeys.includes(key)) allergenKeys.push(key);
  }
  if (allergenKeys.length === 0) return [];

  const uniqueNames = [...new Set(items.map(i => i.name))];
  const issues: ValidationIssue[] = [];

  for (const name of uniqueNames) {
    const foodProduct = await prisma.foodProduct.findFirst({
      where: { name: { contains: name, mode: 'insensitive' } },
      include: { allergens: true },
    });
    if (!foodProduct?.allergens?.length) continue;

    for (const key of allergenKeys) {
      const allergenRecord = foodProduct.allergens.find(a => a.allergenCode === key && a.presence === 'CONTAINS');
      if (allergenRecord) {
        issues.push({
          type: 'ALLERGEN',
          message: `"${name}" contains ${key} (patient has this allergy)`,
        });
        break;
      }
    }
  }

  return issues;
}

// ─── Preference check (7.9.6) ─────────────────────────────────────────────────

const MEAT_KW    = ['wołowina', 'wieprzowina', 'kurczak', 'indyk', 'boczek', 'kiełbasa', 'mięso', 'beef', 'pork', 'chicken', 'turkey', 'bacon', 'sausage', 'meat', 'ham', 'szynka', 'schab', 'golonka'];
const FISH_KW    = ['łosoś', 'tuńczyk', 'dorsz', 'makrela', 'ryba', 'salmon', 'tuna', 'cod', 'fish', 'shrimp', 'krewetki', 'śledź', 'halibut'];
const DAIRY_KW   = ['mleko', 'jogurt', 'ser', 'twaróg', 'śmietana', 'masło', 'milk', 'yogurt', 'cheese', 'cream', 'butter', 'kefir', 'maślanka'];
const EGG_KW     = ['jajko', 'jajka', 'jaje', 'egg', 'eggs'];

function checkPreferences(items: PlanItem[], preferences: string[]): ValidationIssue[] {
  if (preferences.length === 0) return [];

  const lower = preferences.map(p => p.toLowerCase());
  const isVegan = lower.some(p => ['vegan', 'wegańska', 'weganka', 'weganin'].includes(p));
  const isVeg   = lower.some(p => ['vegetarian', 'wegetariańska', 'wegetarianin', 'wegetarianka'].includes(p));

  if (!isVegan && !isVeg) return [];

  const forbiddenKW = isVegan
    ? [...MEAT_KW, ...FISH_KW, ...DAIRY_KW, ...EGG_KW]
    : [...MEAT_KW, ...FISH_KW];

  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  const dietLabel = isVegan ? 'vegan' : 'vegetarian';

  for (const item of items) {
    const nameLower = item.name.toLowerCase();
    if (forbiddenKW.some(kw => nameLower.includes(kw)) && !seen.has(item.name)) {
      seen.add(item.name);
      issues.push({
        type: 'PREFERENCE',
        message: `"${item.name}" may not be suitable for ${dietLabel} diet`,
      });
    }
  }

  return issues;
}

// ─── Auto-adjust: scale grams to hit target kcal (7.9.7) ─────────────────────

export function autoAdjustContent(content: PlanContent, targetKcal: number): PlanContent {
  const days = extractDays(content as Record<string, unknown>);
  if (days.length === 0) return content;

  const avg = avgDailyTotals(days);
  if (avg.kcal === 0) return content;

  const scale = targetKcal / avg.kcal;

  const adjustedDays: PlanDay[] = days.map(day => ({
    ...day,
    meals: (day.meals ?? []).map(meal => ({
      ...meal,
      items: (meal.items ?? []).map(item => ({
        ...item,
        grams:   Math.round(Number(item.grams)   * scale),
        kcal:    Math.round(Number(item.kcal)    * scale),
        protein: Math.round(Number(item.protein) * scale * 10) / 10,
        fat:     Math.round(Number(item.fat)     * scale * 10) / 10,
        carbs:   Math.round(Number(item.carbs)   * scale * 10) / 10,
        // V2: also scale ingredient grams proportionally
        ...(item.ingredients?.length ? {
          ingredients: item.ingredients.map(ing => ({
            ...ing,
            grams: Math.round(Number(ing.grams) * scale),
          })),
        } : {}),
      })),
    })),
  }));

  return { ...content, days: adjustedDays };
}

// ─── Shopping list (7.9.8 + 17.4.5) ─────────────────────────────────────────

/** Normalize name for aggregation key (lowercase, trim, collapse whitespace, strip diacritics) */
function normalizeForAggregation(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
}

// ─── Smart ingredient name extraction ────────────────────────────────────────

/** Unit words that follow a leading number and should be stripped */
const UNIT_WORDS = [
  'g', 'kg', 'dag', 'ml', 'l', 'dl',
  'łyżk[aięy]', 'łyżeczk[aięy]', 'łyżeczek',
  'szklan(?:k[aięy]|ek)', 'garś[ćc]', 'garści',
  'szczyp(?:t[aęy]|cie)', 'plaster(?:k[aiówy]*|ek|y)?',
  'kromk[aięy]', 'kromek', 'kawał(?:k[aiówy]*|ek|y)?',
  'szt\\.?', 'sztuk[aięy]?', 'puszk[aięy]?', 'puszek',
  'opakowa(?:ń|ni[aeu])', 'porcj[aięy]?',
  'saszetk[aięy]?', 'ząb(?:ek|k[aiówy]*)?',
  'krąż(?:ek|k[aiówy]*)?', 'połów(?:ek|k[aiówy]*)?',
  'listek', 'listk[aiówy]*', 'pęcz(?:ek|k[aiówy]*)?',
  'łyżk[aięy]?', 'łyżeczk[aięy]?',
].join('|');

const RE_LEADING_QTY_UNIT = new RegExp(
  `^[\\d\\s,./]+(?:i\\s+\\d+[,./]?\\d*\\s+)?(?:${UNIT_WORDS})\\b\\s*`, 'i'
);
const RE_LEADING_BARE_NUM = /^\d+[\s,./\d]*\s+/;

/**
 * Strip quantity prefixes, size descriptors, and prep notes from ingredient name.
 * "2 bardzo duże lub 3 małe jajka - około 150 g po rozbiciu" → "jajka"
 * "100 g piersi kurczaka" → "piersi kurczaka"
 * "masło klarowane - do smażenia 30 g" → "masło klarowane"
 */
function extractBaseProduct(rawName: string): string {
  let s = rawName.trim();

  // 1. Remove trailing prep notes after dash
  s = s.replace(/\s*[-—–]\s+(?:po |do |waga |w |na |przed |około|ok\.|u mnie|można|opcjonalnie).*$/i, '');
  // Also remove generic trailing dashes: "chuda szynka w plasterkach 150 g"
  s = s.replace(/\s*[-—–]\s+\d+.*$/i, '');

  // 2. Remove parenthetical content with quantities or notes
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ');

  // 3. Remove leading "number + unit": "100 g", "2 łyżki", "1/2 szklanki"
  s = s.replace(RE_LEADING_QTY_UNIT, '');
  // Then bare leading numbers: "2 jajka", "3 średnie jajka"
  s = s.replace(RE_LEADING_BARE_NUM, '');

  // 3b. Remove kitchen-unit prefixes (no number): szczypta, garść, pęczek, listek/listki, plaster, łyżka, łyżeczka
  s = s.replace(/^(?:szczypt[aęy]|garś[ćc](?:i)?|pęcz(?:ek|k[aięy])|listek|listk[aiów]*|plaster(?:ek|k[aiów]*)?|krąż(?:ek|k[aiów]*)|łyżk[aięy]|łyżeczk[aięy]|ząb(?:ek|k[aiów]*))\s+/gi, '');

  // 3c. Remove preparation adverbs: "cienko siekanego", "grubo pokrojonego"
  s = s.replace(/\b(?:cienko|grubo|drobno)\s+(?:siekane(?:go|j)?|pokrojone(?:go|j)?|startego?|mielone(?:go|j)?)\b\s*/gi, '');

  // 4. Remove size/quantity modifiers — accepts both Polish (ł) and ASCII-fallback (l) forms
  s = s.replace(/\b(?:bardzo\s+)?(?:duż\w{0,6}|ma[łl]\w{0,6}|średni(?:ej?\s+wielkości|\w{0,4})?|spor\w{0,4}|niepe[łl]n\w{0,4}|czubat\w{0,4}|p[łl]ask\w{0,4}|pe[łl]n\w{0,4})\s+/gi, '');

  // 4b. Remove state modifiers (świeża, suszony, mielony, mrożony etc.) and descriptive prefixes (płatki, listki)
  s = s.replace(/\b(?:śwież[aoeyiągą]+|suszon[aeyogichą]+|mielon[aeyogichą]+|wędzon[aeyogichą]+|mrożon[aeyogichą]+|siekan[aeyogichą]+|startego?|krojonego?|płatk[ówaiy]*|listk[aiów]*)\s+/gi, '');

  // 5. Remove filler words
  s = s.replace(/\b(?:około|ok\.?|mniej\s+więcej|niecałe|ewentualnie|najlepiej|dowolne|dowolny|ulubion[eayichgo]+|ulubiony|dobrej\s+jakości|świeżo\s+\w+)\s+/gi, '');

  // 6. Remove "lub ..." / "albo ..." alternatives
  s = s.replace(/\s+(?:lub|albo|czy|bądź)\s+.*$/gi, '');

  // 7. Remove embedded quantities: "150 g", "100 ml"
  s = s.replace(/\d+[\s]*(?:g|kg|dag|ml|l|dl)\b/gi, '');
  // Remove stray numbers at end
  s = s.replace(/\s+\d+\s*$/, '');

  // 8. Remove trailing descriptors like "w plastrach", "w plasterkach", "na twardo", "ze skórą"
  // Keep them — they can help differentiate (e.g. łosoś wędzony vs łosoś świeży)
  // But remove "w bloku lub w plasterkach" type noise
  s = s.replace(/\s+w\s+bloku\b/gi, '');

  // 9. Clean up
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[-—–,.\s:]+|[-—–,.\s:]+$/g, '');

  return s.length >= 2 ? s : rawName.trim();
}

// ─── Canonical name mapping for Polish ingredients ──────────────────────────

const CANONICAL_PRODUCTS: Array<[RegExp, string]> = [
  // Eggs — all forms → "jajka"
  [/^jaj(?:k[oa]|ec|[ae]|ka|ek)\b.*$/i, 'jajka'],
  [/\bjaj(?:k[oa]|a|e|ka)\b.*(?:ugotowane|na twardo|gotowane)?/i, 'jajka'],

  // Chicken breast
  [/\bpier(?:ś|si|s)\s+kurczak/i, 'pierś kurczaka'],
  [/\bfilet(?:y)?\s+(?:z\s+)?kurczak/i, 'pierś kurczaka'],

  // Chicken meat (other)
  [/\bmięs[oa]\s+(?:z\s+)?kurczak/i, 'mięso z kurczaka'],

  // Turkey
  [/\bmięs[oa]\s+mielon[eayo]+\s+(?:z\s+)?indyk/i, 'mięso mielone z indyka'],
  [/\bindyk/i, 'indyk'],

  // Mozzarella
  [/\bmozzarell[aiy]?\s*light/i, 'mozzarella light'],
  [/\btar(?:ta|tej)\s+mozzarell/i, 'mozzarella tarta'],
  [/\bmozzarell[aiy]?\s+w\s+kulce/i, 'mozzarella (kulka)'],
  [/\bmozzarell/i, 'mozzarella'],

  // Parmesan
  [/\bparmezan/i, 'parmezan'],

  // Śmietanka — group by fat %
  [/\bśmietan(?:k[aię]|y)?\s*(?:kremówk[aię])?\s*30\s*%/i, 'śmietanka 30%'],
  [/\bśmietan(?:k[aię]|y)?\s*(?:kremówk[aię])?\s*36\s*%/i, 'śmietanka 30%'],
  [/\bśmietan(?:k[aię]|y)?\s*12\s*%/i, 'śmietanka 12%'],
  [/\bśmietan[aiy]/i, 'śmietana'],

  // Feta
  [/\bfet[aęy]/i, 'ser feta'],

  // Camembert
  [/\bcamembert/i, 'ser camembert'],

  // Cheddar
  [/\bcheddar/i, 'ser cheddar'],

  // Twaróg
  [/\btwar(?:óg|og|ożek|ożk)/i, 'twaróg'],

  // Serek puszysty
  [/\bserek\s+puszyst/i, 'serek puszysty'],
  [/\bserek\s+naturaln/i, 'serek naturalny puszysty'],
  [/\bserek\s+waniliow/i, 'serek waniliowy'],

  // Ser żółty (generic yellow cheese)
  [/\bser\s+żółt/i, 'ser żółty'],
  [/\bżółt[eayo]+\s+ser/i, 'ser żółty'],

  // Jogurt
  [/\bjogurt\s+naturaln/i, 'jogurt naturalny'],

  // Skyr
  [/\bskyr\s+waniliow/i, 'skyr waniliowy'],
  [/\bskyr\s+naturaln/i, 'skyr naturalny'],
  [/\bskyr\s+pitn/i, 'skyr pitny'],
  [/\bskyr\b/i, 'skyr'],

  // Masło klarowane — order: klarowane / orzechowe must come BEFORE plain "masło"
  [/\bmasł[oaęui]\s+klarowan/i, 'masło klarowane'],
  [/\bmasł[oaęui]\s+orzechow/i, 'masło orzechowe'],
  [/\bmasł[oaęui]\b/i, 'masło'],

  // Oliwa — all grammatical forms (oliwa, oliwy, oliwie, oliwą)
  [/\boliw\w*\s+(?:z\s+oliwek|extra)/i, 'oliwa z oliwek'],
  [/\boliw\w*/i, 'oliwa z oliwek'],

  // Olej — all grammatical forms (olej, oleju, olejem); specific variants first
  [/\bolej\w*\s+rzepakow/i, 'olej rzepakowy'],
  [/\bolej\w*\s+sezamow/i, 'olej sezamowy'],
  [/\bolej\w*\s+(?:roślinne|roślinnego|do\s+smażenia)/i, 'olej roślinny'],
  [/\bolej\w*/i, 'olej'],

  // Mleko / mleczko — all grammatical forms; specific variants first
  [/\b(?:mleczk[oaięu]|mlek\w{0,4})\s+kokosow/i, 'mleko kokosowe'],
  [/\bmlek\w{0,4}\s+(?:roślinne|roślinnego|owsiane|owsianego|migdałowe|migdałowego|sojowe|sojowego)/i, 'mleko roślinne'],
  [/\bmlek\w{0,4}\s+zwykłe/i, 'mleko'],
  [/\bmlek\w{0,4}\b/i, 'mleko'],

  // Mąka
  [/\bmąk[aięy]\s+orkiszow[eayo]*\s*(?:razow|pełnoziarnist)/i, 'mąka orkiszowa razowa'],
  [/\bmąk[aięy]\s+orkiszow/i, 'mąka orkiszowa'],
  [/\bmąk[aięy]\s+pszenn[eayo]*\s*(?:tortow)?/i, 'mąka pszenna'],
  [/\bmąk[aięy]\b/i, 'mąka pszenna'],

  // Makaron
  [/\bmakaron\s+udon/i, 'makaron udon'],
  [/\bmakaron\s+penne/i, 'makaron penne'],
  [/\bmakaron\s+(?:do\s+)?spaghetti/i, 'makaron spaghetti'],
  [/\bmakaron\s+fettuc/i, 'makaron fettuccine'],
  [/\bmakaron\b/i, 'makaron'],

  // Chleb / pieczywo
  [/\bpieczywo\b/i, 'pieczywo'],
  [/\bchleb\s+żytni/i, 'chleb żytni'],
  [/\bchleb\b/i, 'chleb'],

  // Ryż — word boundary replaced with negative lookahead (Polish "ż" is non-word in JS regex)
  [/\bryż\s+biał/i, 'ryż biały'],
  [/\bryż(?!\w)/i, 'ryż'],

  // Czosnek
  [/\bczosn(?:ek|ku)\b/i, 'czosnek'],
  [/\bząb(?:ek|ki)?\s+czosn/i, 'czosnek'],

  // Cebula — diminutives ("cebulka") + grammatical forms
  [/\bcebul(?:k[aię])?\s+szalotk/i, 'szalotka'],
  [/\bszalotk/i, 'szalotka'],
  [/\bcebul\w*\s+czerwon/i, 'cebula czerwona'],
  [/\bcebul\w*\s+marynow/i, 'cebula marynowana'],
  [/\bcebul\w*/i, 'cebula'],

  // Pietruszka
  [/\bnatk[aię]\s+pietruszk/i, 'natka pietruszki'],
  [/\bpietruszk[aięy]?\b/i, 'pietruszka'],

  // Marchewka / marchew
  [/\bmarchew(?:k[aięy]|i)?\b/i, 'marchewka'],

  // Pestki dyni
  [/\bpest(?:ek|ki)\s+dyni/i, 'pestki dyni'],

  // Passata / przecier
  [/\bpassat[aęy]/i, 'passata pomidorowa'],
  [/\bprzecier\s+pomidor/i, 'passata pomidorowa'],
  [/\bkoncentrat\s+pomidor/i, 'koncentrat pomidorowy'],

  // Pomidory koktajlowe
  [/\bpomidor(?:y|ów|ki|ków)?\s+koktajlow/i, 'pomidory koktajlowe'],
  [/\bpomidor(?:y|ki)\s+suszon/i, 'pomidory suszone'],

  // Sok z cytryny / limonki
  [/\bsok\s+(?:z\s+)?cytryn/i, 'sok z cytryny'],
  [/\bsok\s+(?:z\s+)?limonk/i, 'sok z limonki'],

  // Cukier
  [/\bcukier\s+wanili(?:ow|now)/i, 'cukier waniliowy'],
  [/\bcukier\s+pudr/i, 'cukier puder'],
  [/\bcukier\s+trzcinow/i, 'cukier trzcinowy'],
  [/\bcukr[u]?\b/i, 'cukier'],
  [/\berytrytol/i, 'erytrytol'],

  // Sól i pieprz
  [/\bsól\s+i\s+pieprz/i, 'sól i pieprz'],

  // Proszek do pieczenia — supports both "proszek" (mianownik) and "proszku" (dopełniacz)
  [/\bprosz(?:ek|k\w+)\s+do\s+pieczen/i, 'proszek do pieczenia'],

  // Drożdże
  [/\bdrożdż/i, 'drożdże instant'],

  // Sos sojowy / teriyaki / ostrygowy — all grammatical forms
  [/\bsos\w*\s+sojow/i, 'sos sojowy'],
  [/\bsos\w*\s+teriyaki/i, 'sos teriyaki'],
  [/\bsos\w*\s+ostrygow/i, 'sos ostrygowy'],
  [/\bsos\w*\s+worcester/i, 'sos Worcester'],

  // Szczypiorek — all forms
  [/\bszczypior\w*/i, 'szczypiorek'],

  // Musztarda — specific variants before plain
  [/\bmusztard\w*\s+dijon/i, 'musztarda dijon'],
  [/\bmusztard\w*\s+francusk/i, 'musztarda francuska'],
  [/\bmusztard\w*\s+delikatesow/i, 'musztarda delikatesowa'],
  [/\bmusztard\w*/i, 'musztarda'],

  // Bulion / rosół
  [/\bbulion\w*\s+warzywn/i, 'bulion warzywny'],
  [/\bbulion\w*\s+drobiow/i, 'bulion drobiowy'],
  [/\bbulion\w*/i, 'bulion'],
  [/\bros[óo]ł\w*/i, 'rosół'],

  // Fresh herbs
  [/\bbazyli\w*/i, 'bazylia'],
  [/\bkolendr\w*/i, 'kolendra'],
  [/\bmięt[aęy]\w*/i, 'mięta'],
  [/\btymianek|\btymianku|\btymiank[aięem]/i, 'tymianek'],
  [/\boregano\w*/i, 'oregano'],
  [/\bkoper(?:ek|k[aięu])?\b/i, 'koperek'],

  // Mixed dried fruits / nuts
  [/\bmiks\w*\s+(?:suszon\w+\s+)?owoc\w*/i, 'mieszanka suszonych owoców'],
  [/\bmiks\w*\s+(?:bakali|orzech)\w*/i, 'mieszanka bakalii'],
  [/\b(?:suszon\w+\s+owoc\w*|owoc\w*\s+suszon\w+)/i, 'mieszanka suszonych owoców'],

  // Chili / ostre przyprawy
  [/\bchili\w*/i, 'chili'],
  [/\bpapryk\w*\s+chili/i, 'chili'],

  // Papryka słodka (przyprawa) vs papryka (warzywo) — specific before generic
  [/\bpapryk\w*\s+słodk\w*|\bsłodk\w*\s+papryk\w*/i, 'papryka słodka'],
  [/\bpapryk\w*\s+ostra|\bostr\w*\s+papryk\w*/i, 'papryka ostra'],
  [/\bpapryk\w*\s+wędzon\w*/i, 'papryka wędzona'],
];

/**
 * Set of all canonical output names — used by repair-suggester to verify that
 * a normalized displayName is a recognised product (not just leftover text).
 */
const CANONICAL_OUTPUT_NAMES: Set<string> = new Set(
  CANONICAL_PRODUCTS.map(([, name]) => name.toLowerCase()),
);

/** Returns true when `name` is one of the canonical output products known to this module. */
export function isCanonicalProductName(name: string): boolean {
  return CANONICAL_OUTPUT_NAMES.has(name.toLowerCase().trim());
}

/**
 * Try to match ingredient name against canonical products list.
 * Returns canonical name or null if no match.
 */
function findCanonicalName(cleaned: string): string | null {
  for (const [re, canonical] of CANONICAL_PRODUCTS) {
    if (re.test(cleaned)) return canonical;
  }
  return null;
}

/**
 * Full normalization pipeline: extract base product → canonical mapping → aggregation key.
 * Returns { displayName, aggregationKey }.
 */
export function normalizeIngredientName(rawName: string): { displayName: string; key: string } {
  const base = extractBaseProduct(rawName);
  const canonical = findCanonicalName(base);
  const displayName = canonical ?? base;
  const key = normalizeForAggregation(displayName);
  return { displayName, key };
}

// ─── Gram-to-piece conversion table (24.7.4) ────────────────────────────────

interface PieceConversion {
  gramsPerUnit: number;
  unitName: string;      // singular
  unitNamePlural: string; // plural (2-4)
  unitNameMany: string;   // many (5+)
}

const PIECE_CONVERSIONS: Record<string, PieceConversion> = {
  'banan':              { gramsPerUnit: 120, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'jajko':              { gramsPerUnit: 60,  unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'jajo':               { gramsPerUnit: 60,  unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'jajka':              { gramsPerUnit: 60,  unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'chleb':              { gramsPerUnit: 30,  unitName: 'kromka', unitNamePlural: 'kromki', unitNameMany: 'kromek' },
  'pieczywo':           { gramsPerUnit: 30,  unitName: 'kromka', unitNamePlural: 'kromki', unitNameMany: 'kromek' },
  'bulka':              { gramsPerUnit: 80,  unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'tortilla':           { gramsPerUnit: 60,  unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'jabłko':             { gramsPerUnit: 180, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'jablko':             { gramsPerUnit: 180, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'gruszka':            { gramsPerUnit: 170, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'pomarancza':         { gramsPerUnit: 180, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'kiwi':               { gramsPerUnit: 75,  unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'pomidor':            { gramsPerUnit: 150, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'ogorek':             { gramsPerUnit: 200, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'papryka':            { gramsPerUnit: 160, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'cebula':             { gramsPerUnit: 110, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'awokado':            { gramsPerUnit: 150, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'avocado':            { gramsPerUnit: 150, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'ziemniak':           { gramsPerUnit: 150, unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'marchew':            { gramsPerUnit: 80,  unitName: 'szt.', unitNamePlural: 'szt.', unitNameMany: 'szt.' },
  'czosnek':            { gramsPerUnit: 5,   unitName: 'ząbek', unitNamePlural: 'ząbki', unitNameMany: 'ząbków' },
};

/** Convert grams to human-readable piece count if applicable */
function gramsToPieces(name: string, totalGrams: number): string | undefined {
  const normalized = normalizeForAggregation(name);
  for (const [key, conv] of Object.entries(PIECE_CONVERSIONS)) {
    if (normalized.includes(key)) {
      const count = totalGrams / conv.gramsPerUnit;
      if (count < 0.3) return undefined; // too small to express in pieces
      const rounded = Math.round(count * 2) / 2; // round to 0.5
      if (rounded <= 0) return undefined;
      const unit = rounded === 1 ? conv.unitName
        : rounded >= 2 && rounded <= 4 ? conv.unitNamePlural
        : conv.unitNameMany;
      // Format: "2 szt." or "1.5 szt."
      const numStr = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
      return `${numStr} ${unit}`;
    }
  }
  return undefined;
}

// ─── Shopping list portion snapping ──────────────────────────────────────────

/** Snap aggregated shopping list totals to nearest whole portion for portioned products */
const PORTION_SNAP: Array<[RegExp, number]> = [
  [/\bjaj/i,                60],   // egg ~60g
  [/\bchleb|pieczywo/i,     30],   // bread slice ~30g
  [/\bbułk/i,               80],   // roll ~80g
  [/\btortill/i,            60],   // tortilla ~60g
];

function snapPortionedTotal(displayName: string, totalGrams: number): number {
  for (const [re, unit] of PORTION_SNAP) {
    if (re.test(displayName)) {
      // Round to nearest whole unit, minimum 1 unit
      return Math.max(unit, Math.round(totalGrams / unit) * unit);
    }
  }
  return totalGrams;
}

/**
 * Ingredients typically measured "to taste" rather than grams. When a shopping list
 * aggregates to 0g (or near zero), show "do smaku" instead of the number.
 * Applies to canonical display names only — extendable as new canonicals are added.
 */
const TASTE_ONLY_NAMES = new Set<string>([
  'sól', 'sól i pieprz',
  'pieprz', 'pieprz czarny', 'pieprz biały',
  'chili',
  'papryka słodka', 'papryka ostra', 'papryka wędzona',
  'cynamon',
  'oregano', 'tymianek', 'rozmaryn', 'majeranek',
  'kurkuma', 'kminek', 'kmin rzymski',
  'gałka muszkatołowa', 'imbir mielony',
  'liść laurowy', 'ziele angielskie',
  'suszony czosnek', 'czosnek granulowany',
]);

/**
 * Minimum realistic purchase portion for products that cannot be bought in small grams.
 * Applied as `max(totalGrams, minGrams)` — the shopping list will never suggest "1g rukoli".
 */
const MIN_PURCHASE_PORTION: Array<[RegExp, number]> = [
  // Fresh herbs in pot / small package
  [/^bazylia$/i,            15],
  [/^kolendra$/i,           15],
  [/^mięta$/i,              15],
  [/^koperek$/i,            15],
  // Bunches
  [/^szczypiorek$/i,        30],
  [/^natka pietruszki$/i,   30],
  // Salad leaves (bag)
  [/^rukola$/i,             50],
  [/^roszponk/i,            50],
  [/^sałat/i,               100],
  // Hard portion cheese
  [/^parmezan$/i,           50],
  [/^ser feta$/i,            50],
  [/^mozzarella(?!.*light)/i,  125],
  // Jars / bottles — word-boundary (matches "Extra konfitura z wiśni" too)
  [/\b(?:konfitura|dżem|marmolada|miód)\b/i,   250],
  [/^passata pomidorowa$/i, 400],
  [/^koncentrat pomidorowy$/i, 70],
  // Citrus (1 piece)
  [/^cytryna$/i,           120],
  [/^limonka$/i,            60],
  [/^pomarańcz/i,           180],
  // Garlic head
  [/^czosnek$/i,            30],
];

function applyMinPurchasePortion(displayName: string, totalGrams: number): number {
  for (const [re, minG] of MIN_PURCHASE_PORTION) {
    if (re.test(displayName)) {
      return Math.max(totalGrams, minG);
    }
  }
  return totalGrams;
}

// ─── Ingredient extraction helper (24.7) ─────────────────────────────────────

interface RawIngredient { name: string; grams: number }

/** Extract individual ingredients from a meal item. Uses ingredients[] if available, falls back to item name+grams. */
function extractIngredients(item: PlanItem): RawIngredient[] {
  const ingredients = (item as PlanItem & { ingredients?: PlanIngredient[] }).ingredients;
  if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
    return ingredients.map(ing => ({ name: ing.name, grams: Number(ing.grams) || 0 }));
  }
  // Fallback: use item name and grams directly
  return [{ name: item.name, grams: Number(item.grams) || 0 }];
}

/**
 * Detect ingredient names that are recipe-instruction fragments leaking into the shopping list.
 * Examples: "zioła i przyprawy: po szczypcie soli i pieprzu;"
 *           "proszek do pieczenia i soda oczyszczona po pół płaskiej łyżeczki"
 * Heuristic: long + (contains colon/semicolon OR has many words and no canonical reduction).
 */
// ─── Ingredient-name validation (BUG-3 prevention) ──────────────────────────
//
// Catches compound / list-like / truncated displayName values at insert time.
// Run this from recipe import pipelines (scripts/import-recipes.ts, scraper save step).
// Current mode: log-only (non-blocking). Switch to hard-reject after 1 week of clean logs.

export interface IngredientValidationResult {
  /** true when the name passes all checks (empty/null names are treated as valid). */
  valid: boolean;
  /** Machine-readable codes for each failed check (empty when valid). */
  reasons: string[];
}

const MAX_INGREDIENT_NAME_LENGTH = 60;
const JUNK_PREFIX_RE = /^(?:przyprawy|zioła|dekoracja|dodatki|orzechy|sery|bakali[ae]?|topping|kasze|mączne\s+przekąski|przetwory|marynat[ay])\s*[:\-]/i;
const ALLCAPS_SHORT_RE = /^[A-ZĄĘŁŻŚĆŃÓŹ]{3,8}$/;

/**
 * Validate a RecipeIngredient.displayName against patterns we know cause trouble
 * downstream (solver, nutrition, shopping list). Empty/null names pass.
 */
export function validateIngredientName(name: string | null | undefined): IngredientValidationResult {
  const reasons: string[] = [];
  if (!name) return { valid: true, reasons };
  const trimmed = name.trim();
  if (!trimmed) return { valid: true, reasons };

  if (trimmed.length > MAX_INGREDIENT_NAME_LENGTH) {
    reasons.push(`too-long (${trimmed.length}>${MAX_INGREDIENT_NAME_LENGTH})`);
  }
  if (/[:;]/.test(trimmed)) {
    reasons.push('contains-colon-or-semicolon');
  }
  if (JUNK_PREFIX_RE.test(trimmed)) {
    reasons.push('junk-prefix-category');
  }
  if (ALLCAPS_SHORT_RE.test(trimmed)) {
    reasons.push('all-caps-short-name');
  }
  // We also flag standalone adjectives ("Mrożone", "Surowe") — reuse set declared below.
  if (trimmed.split(/\s+/).length === 1 && STANDALONE_DANGLING_WORDS.has(trimmed.toLowerCase())) {
    reasons.push('standalone-dangling-adjective');
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Standalone adjectives/participles that should never appear alone on a shopping list —
 * they're leftovers from truncated ingredient names (e.g. "Mrożone" instead of
 * "Mrożony groszek", "BIAŁA" instead of "Maślanka biała"). Skip when they stand alone.
 */
const STANDALONE_DANGLING_WORDS = new Set([
  'mrożone', 'mrożony', 'mrożona',
  'surowe', 'surowy', 'surowa',
  'świeże', 'świeży', 'świeża',
  'suszone', 'suszony', 'suszona',
  'gotowane', 'gotowany', 'gotowana',
  'biała', 'biały', 'białe',
  'czerwona', 'czerwony', 'czerwone',
  'zielona', 'zielony', 'zielone',
  'duża', 'duży', 'duże',
]);

function isJunkIngredientName(displayName: string): boolean {
  if (displayName.length > 30 && /[:;]/.test(displayName)) return true;
  const wordCount = (displayName.match(/\s/g) ?? []).length + 1;
  if (displayName.length > 40 && wordCount > 5) return true;
  // ALL-CAPS short name (≤8 chars, only capital letters) — likely data corruption, e.g. "BIAŁA"
  if (displayName.length <= 8 && /^[A-ZĄĘŁŻŚĆŃÓŹ]{3,}$/.test(displayName)) return true;
  // Single dangling adjective/participle ("Mrożone", "Surowe") — truncated import
  if (wordCount === 1 && STANDALONE_DANGLING_WORDS.has(displayName.toLowerCase().trim())) return true;
  return false;
}

export function buildShoppingList(content: PlanContent, dayIndices?: number[]): ShoppingListItem[] {
  let days = extractDays(content as Record<string, unknown>);
  if (dayIndices) days = days.filter((_, i) => dayIndices.includes(i));
  const totals = new Map<string, number>();
  const displayNames = new Map<string, string>();

  for (const day of days) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        for (const ing of extractIngredients(item)) {
          if (ing.grams < 1) continue; // Krok 5: skip zero / near-zero gram entries
          const { displayName, key } = normalizeIngredientName(ing.name);
          if (isJunkIngredientName(displayName)) continue; // Krok 4: skip recipe-fragment junk

          const prev = totals.get(key) ?? 0;
          totals.set(key, prev + ing.grams);

          if (!displayNames.has(key)) {
            displayNames.set(key, displayName);
          }
        }
      }
    }
  }

  return [...totals.entries()]
    .map(([key, totalGrams]) => ({
      name: displayNames.get(key) ?? key,
      totalGrams: Math.round(totalGrams),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

// ─── Categorized shopping list (19.1) ────────────────────────────────────────

const SHOPPING_CATEGORIES: Record<string, string[]> = {
  'Białko': [
    'kurczak', 'indyk', 'łosoś', 'tuńczyk', 'tofu', 'jajk', 'jajko', 'szynk', 'mięs',
    'wołowin', 'wieprzow', 'krewet', 'dorsz', 'pstrąg', 'makrela', 'sardynk',
    'polędwic', 'filet', 'pierś', 'udziec', 'tempeh', 'seitan',
    'kiełbas', 'boczek', 'salami', 'bekon', 'szynka',
  ],
  'Nabiał': [
    'jogurt', 'mleko krow',
    // Specific cheese patterns that won't match "konserwowa" or "seler"
    'ser żółt', 'ser feta', 'ser cheddar', 'ser camembert', 'ser pleśniow',
    'serek', 'serka', 'serku', 'serkiem', 'serki',
    'feta', 'mozzarell', 'śmietan', 'mascarpone', 'burrat',
    'twaróg', 'twarożk', 'twarożek', 'kefir', 'ricotta', 'parmezan',
    'maślank', 'skyr',
  ],
  'Produkty zbożowe': [
    'chleb', 'ryż', 'makaron', 'płatk', 'owsian', 'tortill', 'bułk',
    'kasza', 'mąka', 'granola', 'wrap', 'bagiet', 'pieczywo', 'quinoa', 'kuskus',
    'komosa', 'gnocchi', 'pinsa', 'penne', 'spaghetti', 'fettuc', 'udon',
  ],
  'Warzywa': [
    'pomidor', 'ogórek', 'ogórk', 'sałat', 'szpinak', 'brokuł', 'papryk', 'cebul', 'szalotk',
    'czosnek', 'marchew', 'ziemniak', 'dyni', 'dynia', 'cukini', 'bakłażan', 'awokado',
    'avocado', 'kapust', 'rzodkiew', 'por ', 'fasol', 'groszek', 'kukurydz',
    'seler', 'pietruszk', 'natka', 'koperek', 'koper ', 'szczypior', 'szczypiorek',
    'rukola', 'jarmuż', 'burak', 'batat', 'kalafior', 'papryczk',
    'bazyli', 'kolendra', 'karczoch',
  ],
  'Owoce': [
    'banan', 'jabłk', 'gruszk', 'truskawk', 'maliny', 'malin', 'jagod', 'borówk',
    'pomarańcz', 'cytry', 'limonk', 'kiwi', 'mango', 'ananas', 'śliwk', 'winogrono',
    'grejpfrut', 'nektarynk', 'brzoskwini', 'arbuz', 'melon', 'mandaryń', 'mandarynk',
    'owoce', 'owoc',
  ],
  'Orzechy i nasiona': [
    'orzech', 'migdał', 'chia', 'siemię', 'słonecznik', 'dynia nasion', 'sezam',
    'pestki', 'pestek', 'nerkowc', 'makadami', 'pekan', 'piniow', 'pinii', 'tahini',
    'masło orzechow',
  ],
  'Oleje i tłuszcze': [
    'oliwa', 'olej', 'masło klaro', 'masło', 'smalec', 'ghee', 'margaryn',
  ],
  'Napoje': [
    'mleko roślin', 'mleko owsian', 'mleko migdał', 'mleko sojow', 'mleko kokos',
    'napój roślin', 'sok', 'kawa', 'herbata', 'woda', 'kakao', 'smoothie',
  ],
  'Mrożonki': [
    'mrożon', 'frozen',
  ],
  'Przetwory i konserwy': [
    'passat', 'koncentrat pomidor', 'kiszony', 'kiszon',
    'dżem', 'konfitur', 'sos pomidor', 'sos sojow', 'sriracha',
    'pesto', 'majonez', 'musztard', 'chrzan',
  ],
  'Przyprawy i inne': [],
};

/**
 * Priority category patterns — checked BEFORE SHOPPING_CATEGORIES to resolve ambiguity.
 * E.g. "sok z cytryny" contains "cytryn" which would match Owoce first — but as a juice
 * it belongs to Przyprawy. First regex wins.
 */
const PRIORITY_CATEGORY_PATTERNS: Array<[RegExp, string]> = [
  // Citrus juice / vinegar → Przyprawy (not Owoce/Napoje)
  [/\bsok\w*\s+(?:z\s+)?(?:cytryn|limonk|pomarańcz|grejpfrut)/i, 'Przyprawy i inne'],
  [/\b(?:ocet|octu|octem|octow\w*)\b/i, 'Przyprawy i inne'],

  // Plant-based drinks → Napoje (must come BEFORE the "owsian" keyword in Produkty zbożowe)
  [/\bnapój\s+roślin\w*|\bnapoj\s+roslin\w*/i, 'Napoje'],
  [/\bmleko\s+roślin\w*|\bmleko\s+owsian\w*|\bmleko\s+migdał\w*|\bmleko\s+sojow\w*/i, 'Napoje'],
  [/\bnapój\s+(?:owsian|sojow|migdał|ryżow|kokosow)\w*/i, 'Napoje'],

  // Papryka słodka/ostra/wędzona to PRZYPRAWA (mielona), nie warzywo — priority przed SHOPPING_CATEGORIES 'papryk' keyword
  [/\bpapryk\w*\s+słodk\w*|\bsłodk\w*\s+papryk\w*/i, 'Przyprawy i inne'],
  [/\bpapryk\w*\s+ostr\w*|\bostr\w*\s+papryk\w*/i, 'Przyprawy i inne'],
  [/\bpapryk\w*\s+wędzon\w*|\bwędzon\w*\s+papryk\w*/i, 'Przyprawy i inne'],

  // Porzeczki → Owoce (missing keyword in SHOPPING_CATEGORIES)
  [/\bporzeczk\w*/i, 'Owoce'],

  // Specific proteins missing from SHOPPING_CATEGORIES
  [/\bgolonk\w*/i, 'Białko'],
  [/\bros[óo][łl]?\w*/i, 'Białko'],  // rosół / Rosól / rosol variants
  [/\bpolędwicz\w*|\bpoledwicz\w*/i, 'Białko'],
  [/\bżeberk\w*|\bzeberk\w*/i, 'Białko'],
  [/\bschab\w*/i, 'Białko'],
  [/\bkabanos\w*/i, 'Białko'],
  [/\bparówk\w*|\bparowk\w*/i, 'Białko'],
  [/\bkielbas\w*|\bkiełbas\w*/i, 'Białko'],
  [/\bszynk\w*/i, 'Białko'],

  // Specific vegetables
  [/\bbób\b|\bbob\b/i, 'Warzywa'],
  [/\bkalarep\w*/i, 'Warzywa'],
  [/\bszparag\w*/i, 'Warzywa'],
  [/\bgrzyb\w*/i, 'Warzywa'],
  [/\bshimej\w*/i, 'Warzywa'],
  [/\bpieczark\w*/i, 'Warzywa'],
  [/\bboczniak\w*/i, 'Warzywa'],
  [/\bshiitake\w*/i, 'Warzywa'],
  [/\bpor\b/i, 'Warzywa'],  // word boundary — avoids "poranna", "porcja"
  [/\bciecierzyc\w*/i, 'Warzywa'],
  [/\bsoczewic\w*/i, 'Warzywa'],

  // Bulion / broth → Przetwory (stored item, not a fresh herb category)
  [/\bbulion\w*/i, 'Przetwory i konserwy'],

  // Specific baked goods
  [/\bciasto\s+(?:francusk|kruch|drożdż)/i, 'Produkty zbożowe'],
  [/\bbułeczk\w*|\bbuleczk\w*/i, 'Produkty zbożowe'],
  [/\bbagietk\w*/i, 'Produkty zbożowe'],
  [/\btost\w*/i, 'Produkty zbożowe'],
  [/\bgrzank\w*/i, 'Produkty zbożowe'],

  // Herbs go to Warzywa section (as in original)
  [/\bbazyli\w*|\bkolendr\w*|\btymianek|\btymianku|\boregano\w*|\bkoperek|\bmięt\w+/i, 'Warzywa'],
];

export function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();

  // 1. Priority patterns first (disambiguate cases where multiple categories could match)
  for (const [re, category] of PRIORITY_CATEGORY_PATTERNS) {
    if (re.test(name)) return category;
  }

  // 2. Fallback: SHOPPING_CATEGORIES keyword scan
  for (const [category, keywords] of Object.entries(SHOPPING_CATEGORIES)) {
    for (const kw of keywords) {
      // Support \b word boundary in keyword patterns
      if (kw.includes('\\b') || kw.includes('(') || kw.includes('[')) {
        if (new RegExp(kw, 'i').test(lower)) return category;
      } else {
        if (lower.includes(kw)) return category;
      }
    }
  }
  return 'Przyprawy i inne';
}

/** Shorten day name: "Poniedziałek" → "Pon", "Monday" → "Mon" */
function shortDay(day: string): string {
  return day.slice(0, 3);
}

export function buildCategorizedShoppingList(content: PlanContent, dayIndices?: number[]): ShoppingListCategory[] {
  let days = extractDays(content as Record<string, unknown>);
  if (dayIndices) days = days.filter((_, i) => dayIndices.includes(i));

  // Map: normalizedKey → { name, totalGrams, category, usedIn[], pieces? }
  const items = new Map<string, ShoppingListDetailItem>();

  for (const day of days) {
    for (const meal of day.meals ?? []) {
      for (const item of meal.items ?? []) {
        for (const ing of extractIngredients(item)) {
          const { displayName, key } = normalizeIngredientName(ing.name);
          if (isJunkIngredientName(displayName)) continue; // skip recipe-fragment junk

          const isTaste = TASTE_ONLY_NAMES.has(displayName.toLowerCase());
          // Allow 0g entries through ONLY when they are taste-only (salt, pepper, etc.);
          // otherwise keep the near-zero filter to suppress noise.
          if (ing.grams < 1 && !isTaste) continue;

          const grams = ing.grams;

          const existing = items.get(key);
          if (existing) {
            existing.totalGrams += grams;
            existing.usedIn.push({ day: shortDay(day.day), meal: meal.name, grams: Math.round(grams) });
          } else {
            items.set(key, {
              name: displayName,
              totalGrams: grams,
              category: categorizeIngredient(displayName),
              usedIn: [{ day: shortDay(day.day), meal: meal.name, grams: Math.round(grams) }],
              tasteOnly: isTaste,
            });
          }
        }
      }
    }
  }

  // Round totals, snap portioned products, apply min-purchase portion, compute piece conversions
  for (const item of items.values()) {
    item.totalGrams = Math.round(item.totalGrams);
    item.totalGrams = snapPortionedTotal(item.name, item.totalGrams);
    item.totalGrams = applyMinPurchasePortion(item.name, item.totalGrams);
    // For taste-only items we don't compute pieces; renderer will show "do smaku"
    if (!item.tasteOnly) {
      item.pieces = gramsToPieces(item.name, item.totalGrams);
    }
  }

  // Group by category, maintaining SHOPPING_CATEGORIES order
  const result: ShoppingListCategory[] = [];
  for (const catName of Object.keys(SHOPPING_CATEGORIES)) {
    const catItems = [...items.values()]
      .filter(i => i.category === catName)
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    if (catItems.length > 0) {
      result.push({ category: catName, items: catItems });
    }
  }

  return result;
}

// ─── Main validate function ───────────────────────────────────────────────────

export async function validatePlan(planId: string): Promise<ValidationResult> {
  const plan = await prisma.dietPlan.findUnique({
    where: { id: planId },
    include: {
      patient: {
        include: {
          nutritionTargets: true,
          interviews: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');

  const content = decryptJson(plan.content) as Record<string, unknown>;
  const days = extractDays(content);

  if (days.length === 0) {
    const result: ValidationResult = {
      status: 'NEEDS_REPAIR_AI',
      issues: [{ type: 'KCAL', message: 'Plan has no days/meals data' }],
      avgDailyKcal: 0,
      avgDailyProteinG: 0,
      avgDailyFatG: 0,
      avgDailyCarbsG: 0,
    };
    await persistValidation(planId, result);
    return result;
  }

  const avg = avgDailyTotals(days);
  const items = allItems(days);
  const issues: ValidationIssue[] = [];

  // 7.9.1–7.9.4 — macro validation against NutritionTargets
  const targets = plan.patient.nutritionTargets;
  if (targets) {
    const kcalIssue = macroIssue(avg.kcal, targets.targetKcal, 'KCAL', 'Calories', KCAL_VALID_TOL);
    if (kcalIssue) issues.push(kcalIssue);

    const proteinIssue = macroIssue(avg.protein, targets.targetProteinG, 'PROTEIN', 'Protein', MACRO_VALID_TOL);
    if (proteinIssue) issues.push(proteinIssue);

    const fatIssue = macroIssue(avg.fat, targets.targetFatG, 'FAT', 'Fat', MACRO_VALID_TOL);
    if (fatIssue) issues.push(fatIssue);

    const carbsIssue = macroIssue(avg.carbs, targets.targetCarbsG, 'CARBS', 'Carbohydrates', MACRO_VALID_TOL);
    if (carbsIssue) issues.push(carbsIssue);
  } else {
    // 32.3.1: Fallback — use DietPlan.kcal when nutritionTargets missing
    console.warn(`[validatePlan] Plan ${planId}: patient has no nutritionTargets, using plan.kcal (${plan.kcal}) as fallback`);
    if (plan.kcal) {
      const kcalIssue = macroIssue(avg.kcal, plan.kcal, 'KCAL', 'Calories (plan.kcal fallback)', KCAL_VALID_TOL);
      if (kcalIssue) issues.push(kcalIssue);
    }
  }

  // 32.3.2: Hard floor — reject plans below 1000 kcal/day
  const policyMeta = (plan.policyMetadata as Record<string, unknown> | null) ?? {};
  const allowVeryLowCalorie = policyMeta.allowVeryLowCalorie === true;
  if (avg.kcal > 0 && avg.kcal < HARD_FLOOR_KCAL && !allowVeryLowCalorie) {
    issues.push({
      type: 'KCAL',
      message: `Plan below hard floor: ${avg.kcal} kcal/day (minimum ${HARD_FLOOR_KCAL} kcal unless allowVeryLowCalorie)`,
      actual: avg.kcal,
      expected: HARD_FLOOR_KCAL,
    });
  }

  // 7.9.5 — allergen check
  if (plan.patient.interviews.length > 0) {
    const interviewAnswers = decryptJson(plan.patient.interviews[0].answers) as Record<string, unknown>;
    const rawAllergies = interviewAnswers['allergies'] ?? interviewAnswers['alergie'] ?? [];
    const patientAllergens: string[] = Array.isArray(rawAllergies) ? rawAllergies.map(String) : [];
    const allergenIssues = await checkAllergens(items, patientAllergens);
    issues.push(...allergenIssues);

    // 7.9.6 — preference check
    const rawPrefs = interviewAnswers['dietaryPreferences'] ?? interviewAnswers['preferencjeDietetyczne'] ?? interviewAnswers['diet'] ?? [];
    const preferences: string[] = Array.isArray(rawPrefs) ? rawPrefs.map(String) : (typeof rawPrefs === 'string' ? [rawPrefs] : []);
    const prefIssues = checkPreferences(items, preferences);
    issues.push(...prefIssues);
  }

  // 7.9.9 — determine status
  let status: ValidationStatus = 'VALID';
  if (issues.length > 0) {
    const hasHardIssue = issues.some(i => i.type === 'ALLERGEN' || i.type === 'PREFERENCE');
    if (hasHardIssue) {
      status = 'NEEDS_REPAIR_AI';
    } else {
      // Check kcal deviation to decide NEEDS_ADJUST vs NEEDS_REPAIR_AI
      const kcalIssue = issues.find(i => i.type === 'KCAL');
      if (kcalIssue && kcalIssue.expected && kcalIssue.actual) {
        const ratio = Math.abs(kcalIssue.actual - kcalIssue.expected) / kcalIssue.expected;
        status = ratio > KCAL_REPAIR_TOL ? 'NEEDS_REPAIR_AI' : 'NEEDS_ADJUST';
      } else {
        status = 'NEEDS_ADJUST';
      }
    }
  }

  const result: ValidationResult = {
    status,
    issues,
    avgDailyKcal:     avg.kcal,
    avgDailyProteinG: avg.protein,
    avgDailyFatG:     avg.fat,
    avgDailyCarbsG:   avg.carbs,
  };

  await persistValidation(planId, result);
  return result;
}

// ─── Persist validation result to DB ─────────────────────────────────────────

async function persistValidation(planId: string, result: ValidationResult) {
  await prisma.dietPlan.update({
    where: { id: planId },
    data: {
      validated: result.status === 'VALID',
      validationStatus: result.status,
      validationErrors: result.issues.length > 0
        ? (result.issues as unknown as import('@db').Prisma.InputJsonArray)
        : [],
    },
  });
}
