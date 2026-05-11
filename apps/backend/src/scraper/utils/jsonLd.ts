/**
 * Unified schema.org/Recipe JSON-LD parser.
 *
 * Handles the quirks of recipe JSON-LD found in the wild:
 *   - Root can be: single object, array of objects, or object with `@graph` array.
 *   - `@type` can be a string OR array of strings (e.g. ["Recipe", "NewsArticle"]).
 *   - Duration strings can be: "PT30M", "PT1H30M", "30M" (jadlonomia quirk, no PT),
 *     or free Polish text "1 godz. 30 min".
 *   - `recipeYield` can be: number, string "4 porcje", array of strings,
 *     or QuantitativeValue object.
 *   - `image` can be: string URL, array of strings, ImageObject (has `url` field),
 *     or array of ImageObjects.
 *   - `recipeInstructions` can be: string, array of strings, array of HowToStep
 *     (has `text`), or array of HowToSection (has nested `itemListElement`).
 *   - `nutrition` (NutritionInformation) values are typically strings like
 *     "420 kcal", "12 g", so we strip non-numeric suffixes.
 *
 * This module is IO-free and takes a Cheerio instance.
 */

import type { CheerioAPI } from 'cheerio';

// ─── Output type ───────────────────────────────────────────────────────────────

export interface ParsedNutrition {
  calories?: number;      // kcal
  protein?: number;       // g
  fat?: number;           // g
  saturatedFat?: number;  // g
  carbs?: number;         // g
  fiber?: number;         // g
  sugar?: number;         // g
  sodium?: number;        // mg
  cholesterol?: number;   // mg
}

export interface ParsedRecipeJsonLd {
  title: string;
  description?: string;
  rawIngredients: string[];
  steps: string[];

  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  servings?: number;

  rating?: number;
  ratingCount?: number;
  imageUrl?: string;

  category?: string;
  cuisineType?: string;
  tags: string[];

  nutrition?: ParsedNutrition;

  author?: string;
  datePublished?: string;  // ISO 8601
}

// ─── Duration parsing ──────────────────────────────────────────────────────────

/**
 * Parse an ISO 8601 duration (or relaxed variant) into minutes.
 * Accepts: "PT30M", "PT1H30M", "30M", "1H", "30 minut", "1 godz. 15 min".
 * Returns undefined when no positive duration can be extracted.
 */
export function parseIsoDuration(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;

  // ISO 8601 style (with or without leading PT — jadlonomia strips it)
  const iso = s.match(/^(?:PT)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) {
    const h = parseInt(iso[1] || '0', 10);
    const m = parseInt(iso[2] || '0', 10);
    const total = h * 60 + m;
    if (total > 0) return total;
  }

  // Polish free text
  const lower = s.toLowerCase();
  let total = 0;
  const h = lower.match(/(\d+)\s*(?:godz(?:in\w*)?|h)\b/);
  if (h) total += parseInt(h[1], 10) * 60;
  const m = lower.match(/(\d+)\s*(?:min(?:ut\w*)?)\b/);
  if (m) total += parseInt(m[1], 10);
  if (total > 0) return total;

  // Bare number → interpret as minutes
  const bare = s.match(/^\s*(\d+)\s*$/);
  if (bare) {
    const n = parseInt(bare[1], 10);
    if (n > 0) return n;
  }

  return undefined;
}

// ─── Yield parsing ─────────────────────────────────────────────────────────────

/**
 * Parse `recipeYield` value into number of servings.
 * Accepts: 4, "4", "4 porcje", "około 6", ["4 porcje"], { value: 4 }.
 */
export function parseYield(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const parsed = parseYield(v);
      if (parsed != null) return parsed;
    }
    return undefined;
  }
  if (typeof raw === 'object') {
    // QuantitativeValue { value: 4 } or { value: "4" }
    const qv = raw as { value?: unknown };
    if ('value' in qv) return parseYield(qv.value);
    return undefined;
  }
  if (typeof raw === 'string') {
    const m = raw.match(/(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0) return n;
    }
  }
  return undefined;
}

// ─── Image parsing ─────────────────────────────────────────────────────────────

/**
 * Extract first image URL from possible shapes:
 *   "https://..." | ["https://..."] | { url: "https://..." } | [{ url: "..." }]
 */
export function parseImage(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw.trim() || undefined;
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const extracted = parseImage(v);
      if (extracted) return extracted;
    }
    return undefined;
  }
  if (typeof raw === 'object') {
    const obj = raw as { url?: unknown; contentUrl?: unknown };
    if (typeof obj.url === 'string') return obj.url.trim() || undefined;
    if (typeof obj.contentUrl === 'string') return obj.contentUrl.trim() || undefined;
  }
  return undefined;
}

// ─── Rating parsing ────────────────────────────────────────────────────────────

interface ParsedRating {
  rating?: number;
  ratingCount?: number;
}

export function parseRating(raw: unknown): ParsedRating {
  if (!raw || typeof raw !== 'object') return {};
  const ar = raw as { ratingValue?: unknown; ratingCount?: unknown; reviewCount?: unknown };
  const rating = toNumberOrUndef(ar.ratingValue);
  const ratingCount = toNumberOrUndef(ar.ratingCount ?? ar.reviewCount);
  return { rating, ratingCount };
}

function toNumberOrUndef(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

// ─── Instructions parsing ──────────────────────────────────────────────────────

/**
 * Flatten recipeInstructions into a string array.
 * Handles: string, string[], HowToStep[], HowToSection[] (with nested itemListElement).
 * For HowToSection, prepends the section name (if any) to the first sub-step.
 */
export function parseInstructions(raw: unknown): string[] {
  const out: string[] = [];
  if (!raw) return out;

  if (typeof raw === 'string') {
    // Sometimes a single string with newline-separated steps
    const pieces = raw.split(/\n\s*\n|\r?\n(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean);
    out.push(...(pieces.length > 1 ? pieces : [raw.trim()]));
    return out;
  }

  if (!Array.isArray(raw)) {
    // Single HowToStep or HowToSection object
    return parseInstructions([raw]);
  }

  for (const step of raw) {
    if (typeof step === 'string') {
      const t = step.trim();
      if (t) out.push(t);
      continue;
    }
    if (!step || typeof step !== 'object') continue;
    const obj = step as { '@type'?: string | string[]; text?: unknown; name?: unknown; itemListElement?: unknown };
    const typeRaw = obj['@type'];
    const types = Array.isArray(typeRaw) ? typeRaw : typeRaw ? [typeRaw] : [];

    if (types.includes('HowToSection')) {
      // Nested steps inside a section — prepend section name to the first sub-step.
      const sectionName = typeof obj.name === 'string' ? obj.name.trim() : '';
      const nested = parseInstructions(obj.itemListElement);
      if (sectionName && nested.length > 0) {
        out.push(`${sectionName}: ${nested[0]}`);
        out.push(...nested.slice(1));
      } else {
        out.push(...nested);
      }
      continue;
    }

    // HowToStep (default) — prefer `text`, fallback to `name`
    if (typeof obj.text === 'string' && obj.text.trim()) {
      out.push(obj.text.trim());
    } else if (typeof obj.name === 'string' && obj.name.trim()) {
      out.push(obj.name.trim());
    }
  }

  return out;
}

// ─── Nutrition parsing ─────────────────────────────────────────────────────────

/**
 * Parse schema.org/NutritionInformation block.
 * Fields are typically strings like "420 kcal", "12 g", "350 mg".
 * We strip the unit and parse the number; outputs normalized minutes/grams/mg.
 */
export function parseNutrition(raw: unknown): ParsedNutrition | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const n = raw as Record<string, unknown>;

  const parseWithUnit = (v: unknown, expectedUnit?: 'g' | 'mg' | 'kcal'): number | undefined => {
    if (v == null) return undefined;
    const num = toNumberOrUndef(v);
    if (num == null) return undefined;
    if (typeof v === 'string' && expectedUnit) {
      // Unit conversion: mg ↔ g for sodium/cholesterol
      const lower = v.toLowerCase();
      if (expectedUnit === 'mg' && /\bg\b/.test(lower) && !/mg/.test(lower)) {
        return num * 1000; // "1.2 g" sodium → 1200 mg
      }
      if (expectedUnit === 'g' && /\bmg\b/.test(lower)) {
        return num / 1000;
      }
    }
    return num;
  };

  const out: ParsedNutrition = {
    calories: parseWithUnit(n.calories, 'kcal'),
    protein: parseWithUnit(n.proteinContent, 'g'),
    fat: parseWithUnit(n.fatContent, 'g'),
    saturatedFat: parseWithUnit(n.saturatedFatContent, 'g'),
    carbs: parseWithUnit(n.carbohydrateContent, 'g'),
    fiber: parseWithUnit(n.fiberContent, 'g'),
    sugar: parseWithUnit(n.sugarContent, 'g'),
    sodium: parseWithUnit(n.sodiumContent, 'mg'),
    cholesterol: parseWithUnit(n.cholesterolContent, 'mg'),
  };

  // Drop undefined keys so callers can detect "no nutrition data"
  const filtered: ParsedNutrition = {};
  for (const [k, v] of Object.entries(out)) {
    if (v != null) (filtered as Record<string, number>)[k] = v;
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

// ─── Type resolution helpers ───────────────────────────────────────────────────

function isRecipeType(raw: unknown): boolean {
  if (typeof raw === 'string') return raw === 'Recipe';
  if (Array.isArray(raw)) return raw.includes('Recipe');
  return false;
}

/**
 * From a single JSON-LD blob (one `<script>`), return the first Recipe-typed
 * object found. Traverses: single object, array root, and `@graph`.
 */
function findRecipeInJson(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInJson(item);
      if (found) return found;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;
  if (isRecipeType(obj['@type'])) return obj;

  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph'] as unknown[]) {
      const found = findRecipeInJson(item);
      if (found) return found;
    }
  }

  return null;
}

// ─── Public extraction ─────────────────────────────────────────────────────────

/**
 * Extract the first Recipe-typed object from all `<script type="application/ld+json">`
 * tags on the page. Returns null if none found or JSON is invalid.
 */
export function extractRecipeJsonLd($: CheerioAPI): Record<string, unknown> | null {
  let found: Record<string, unknown> | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    const raw = $(el).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const recipe = findRecipeInJson(parsed);
      if (recipe) found = recipe;
    } catch {
      // Some sites double-escape or have trailing commas — try a lenient pass by
      // stripping obvious trailing commas before retry.
      try {
        const cleaned = raw.replace(/,(\s*[}\]])/g, '$1');
        const parsed = JSON.parse(cleaned);
        const recipe = findRecipeInJson(parsed);
        if (recipe) found = recipe;
      } catch {
        /* ignore */
      }
    }
  });

  return found;
}

/**
 * Parse a Recipe-shaped JSON-LD object into ParsedRecipeJsonLd.
 * No IO; safe to call on any candidate object.
 */
export function parseRecipeJsonLd(data: Record<string, unknown>): ParsedRecipeJsonLd | null {
  const title = typeof data.name === 'string' ? data.name.trim() : '';
  if (!title) return null;

  const rawIngredients: string[] = Array.isArray(data.recipeIngredient)
    ? (data.recipeIngredient as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .map(s => s.trim())
        .filter(Boolean)
    : [];

  const steps = parseInstructions(data.recipeInstructions);

  const prepTimeMinutes = parseIsoDuration(data.prepTime);
  const cookTimeMinutes = parseIsoDuration(data.cookTime);
  let totalTimeMinutes = parseIsoDuration(data.totalTime);
  if (totalTimeMinutes == null && prepTimeMinutes != null && cookTimeMinutes != null) {
    totalTimeMinutes = prepTimeMinutes + cookTimeMinutes;
  }

  const servings = parseYield(data.recipeYield);
  const imageUrl = parseImage(data.image);
  const { rating, ratingCount } = parseRating(data.aggregateRating);
  const nutrition = parseNutrition(data.nutrition);

  const category = firstStringField(data.recipeCategory);
  const cuisineType = firstStringField(data.recipeCuisine);

  const tags: string[] = [];
  if (typeof data.keywords === 'string') {
    tags.push(
      ...data.keywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)
    );
  } else if (Array.isArray(data.keywords)) {
    tags.push(
      ...(data.keywords as unknown[])
        .filter((k): k is string => typeof k === 'string')
        .map(k => k.trim())
        .filter(Boolean)
    );
  }

  const description = typeof data.description === 'string' ? data.description.trim() : undefined;

  let author: string | undefined;
  if (typeof data.author === 'string') author = data.author.trim();
  else if (data.author && typeof data.author === 'object') {
    const a = data.author as { name?: unknown };
    if (typeof a.name === 'string') author = a.name.trim();
    else if (Array.isArray(data.author) && data.author.length > 0) {
      const first = data.author[0] as { name?: unknown };
      if (first && typeof first === 'object' && typeof first.name === 'string') author = first.name.trim();
    }
  }

  const datePublished = typeof data.datePublished === 'string' ? data.datePublished : undefined;

  return {
    title,
    description,
    rawIngredients,
    steps,
    prepTimeMinutes,
    cookTimeMinutes,
    totalTimeMinutes,
    servings,
    rating,
    ratingCount,
    imageUrl,
    category,
    cuisineType,
    tags,
    nutrition,
    author,
    datePublished,
  };
}

function firstStringField(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t || undefined;
  }
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const s = firstStringField(v);
      if (s) return s;
    }
  }
  return undefined;
}

/**
 * Convenience: extract + parse in one call.
 */
export function extractAndParseRecipe($: CheerioAPI): ParsedRecipeJsonLd | null {
  const raw = extractRecipeJsonLd($);
  if (!raw) return null;
  return parseRecipeJsonLd(raw);
}
