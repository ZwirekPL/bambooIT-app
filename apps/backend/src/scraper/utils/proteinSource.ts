/**
 * Recipe protein-source auto-detection (S-11).
 *
 * Current production code (weekSolver.service.ts getProteinSource) looks at
 * recipe title + tags with regex — and falls back to null/OTHER for 63% of
 * LUNCH+DINNER recipes when the protein isn't named in the title. This
 * module derives the source from the ingredient list instead, using:
 *
 *     argmax over ingredients of (protein_per_100g × grams)
 *
 * then mapping the winning ingredient's canonical name to a source category.
 *
 * Categories match the solver's PROTEIN_SOURCE_MAP (used for the 3-day
 * rotation constraint): poultry, beef, pork, lamb, fish, seafood, egg,
 * dairy, legume, tofu, nuts, grain, vegetable, other.
 */

import { normalizeProductName } from './productMatcher';

// ─── Categories ────────────────────────────────────────────────────────────────

export type ProteinSource =
  | 'poultry'
  | 'beef'
  | 'pork'
  | 'lamb'
  | 'fish'
  | 'seafood'
  | 'egg'
  | 'dairy'
  | 'legume'
  | 'tofu'
  | 'nuts'
  | 'grain'
  | 'vegetable'
  | 'other';

/**
 * Canonical-form (see productMatcher.canonicalize) substring patterns for each
 * source. Keys after canonicalize have diacritics stripped + per-word stems,
 * so patterns are diacritic-free as well.
 *
 * Ordering matters — categories higher on the list win for ambiguous names:
 * "kurczak" (chicken) beats "pierś" which could match grain (pieczywo) in
 * other contexts.
 */
// Patterns use stems of common Polish forms. Each alternative is allowed to
// continue into any inflected ending via \w*, so "wolowin" matches "wolowina"
// and "kurczak" matches "kurczaka". Order matters — longer / more specific
// stems should appear before generic ones within a group.
const PATTERNS: Array<{ source: ProteinSource; match: (name: string) => boolean }> = [
  // Poultry
  { source: 'poultry', match: (n) => /\b(kurczak|kurcz|indyk|indycz|kacz|gesi|gesin|kura|drob|drobiow|pier(s|sc)|skrzydl|udko|udka)\w*/.test(n) },
  // Beef
  { source: 'beef', match: (n) => /\b(wolowin|wolow|befsztyk|rumszt|rostbef|stek|antryk|polkreski)\w*/.test(n) },
  // Pork
  { source: 'pork', match: (n) => /\b(wieprzow|schab|karkow|boczek|boczku|szynk|kielbas|salami|kabanos|parowk|serdeln)\w*/.test(n) },
  // Lamb
  { source: 'lamb', match: (n) => /\b(jagniec|jagnie|baranin|owcy)\w*/.test(n) },
  // Fish
  { source: 'fish', match: (n) => /\b(losos|dorsz|tunczyk|sledz|sled|makrel|pstrag|mintaj|karp|sandacz|halibut|ryb[ayę])\w*/.test(n) },
  // Seafood
  { source: 'seafood', match: (n) => /\b(krewetk|malze|kalmary|ostryg|krab|homar|omulek)\w*/.test(n) },
  // Egg
  { source: 'egg', match: (n) => /\b(jajk|jajec|jajo|jaja|jaj\b|bialk|zoltk)\w*/.test(n) },
  // Tofu / soy protein
  { source: 'tofu', match: (n) => /\b(tofu|tempeh|tempe|seitan|soja|soji|sojow)\w*/.test(n) },
  // Legume
  { source: 'legume', match: (n) => /\b(ciecierzyc|soczewic|fasol|groch|bob\b|bobu|lentil|chickpea|kidney|edamam)\w*/.test(n) },
  // Dairy — high-protein
  { source: 'dairy', match: (n) => /\b(twarog|twaroz|ser\b|serek|serka|mozzarell|feta|parmezan|grana|cheddar|gouda|bryndz|skyr|jogurt|kefir|mleko|mleka|masl|smietan|creme|ricott)\w*/.test(n) },
  // Nuts / seeds
  { source: 'nuts', match: (n) => /\b(migdal|orzech|orzeszk|pistacj|nerkowc|laskow|wlosk|pekan|pestka|siemie|sezam|chia|nasiona)\w*/.test(n) },
  // Grain protein
  { source: 'grain', match: (n) => /\b(komos|quinoa|kasza|gryka|jaglan|ryz|makaron|chleb|pieczyw|bulk)\w*/.test(n) },
];

// ─── Ingredient-level classification ───────────────────────────────────────────

export function classifyIngredient(ingredientName: string): ProteinSource {
  const canon = normalizeProductName(ingredientName);
  if (!canon) return 'other';
  for (const { source, match } of PATTERNS) {
    if (match(canon)) return source;
  }
  return 'vegetable'; // default for produce-like items (cebula, marchew, szpinak)
}

// ─── Recipe-level argmax ───────────────────────────────────────────────────────

export interface RecipeIngredientInput {
  name: string;            // canonical or display name
  grams: number;
  /** Protein grams per 100 g of this ingredient (from CleanProduct nutrients). */
  proteinPer100g: number | null | undefined;
}

export interface ProteinSourceReport {
  source: ProteinSource;
  totalProteinG: number;
  topIngredient: { name: string; proteinG: number } | null;
  /** Per-ingredient breakdown sorted by protein contribution desc. */
  contributions: Array<{ name: string; grams: number; proteinG: number; source: ProteinSource }>;
}

/**
 * Determine the recipe's dominant protein source from its ingredients.
 *
 *   1. For each ingredient, compute proteinG = proteinPer100g * grams / 100.
 *   2. Group by classified source and sum.
 *   3. Dominant source = argmax of group sums.
 *
 * Ties are broken by the highest single-ingredient contribution (stable).
 *
 * Edge cases:
 *   - All ingredients with unknown protein → 'other'
 *   - Recipes with only vegetables that total > 5g protein → 'vegetable' wins
 *     (legitimate for vegetable dishes)
 */
export function computeRecipeProteinSource(
  ingredients: RecipeIngredientInput[],
): ProteinSourceReport {
  const byIngredient = ingredients.map((ing) => {
    const per100 = typeof ing.proteinPer100g === 'number' ? ing.proteinPer100g : 0;
    const proteinG = per100 > 0 && ing.grams > 0 ? (per100 * ing.grams) / 100 : 0;
    const source = classifyIngredient(ing.name);
    return { name: ing.name, grams: ing.grams, proteinG, source };
  }).sort((a, b) => b.proteinG - a.proteinG);

  const totals = new Map<ProteinSource, number>();
  for (const c of byIngredient) {
    totals.set(c.source, (totals.get(c.source) ?? 0) + c.proteinG);
  }

  let winner: ProteinSource = 'other';
  let winnerScore = 0;
  for (const [src, sum] of totals) {
    if (sum > winnerScore) {
      winnerScore = sum;
      winner = src;
    }
  }

  const totalProteinG = byIngredient.reduce((a, c) => a + c.proteinG, 0);
  const topIngredient = byIngredient[0] && byIngredient[0].proteinG > 0
    ? { name: byIngredient[0].name, proteinG: byIngredient[0].proteinG }
    : null;

  // If no meaningful protein in the whole recipe, fall back to 'other'
  if (totalProteinG < 2) {
    return { source: 'other', totalProteinG, topIngredient, contributions: byIngredient };
  }

  return { source: winner, totalProteinG, topIngredient, contributions: byIngredient };
}
