/**
 * Recipe auto-tagger (P0.5 — Recipe Overhaul Master Plan 2026-04-29).
 *
 * Produces a sorted, deduped list of `Recipe.tags` from a normalized recipe
 * input. Tags are consumed by:
 *   • weekSolver disliked-food keyword search (broadens title-only matches)
 *   • weekSolver category caps (regex on title+tags)
 *   • weekSolver `WHOLE_GRAINS_BONUS` (matches /pełnoziarnist/ in tags)
 *   • mealSwap/slotRepair (pass-through to solver)
 *
 * Taxonomy (target: 3-8 tags per active recipe):
 *   1. cuisine echo                  ← Recipe.cuisineType
 *   2. mealType echo                 ← Recipe.mealType (lowercased)
 *   3. cookingMethod                 ← Recipe.cookingMethod (PL labels)
 *   4. time class                    ← Recipe.totalTimeMinutes
 *   5. curated diet flags (≤6)      ← RecipeDietFlag.value=true & conf≥70
 *   6. pełnoziarniste                ← ingredient regex
 *   7. bogate-w-warzywa              ← veg-share thresholds
 *
 * The output is intentionally lowercase, ASCII-folding-friendly Polish so
 * downstream regex matching (e.g. WHOLE_GRAINS_BONUS) keeps working.
 */

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AutotagInput {
  cuisineType?: string | null;
  mealType?: string | null;
  cookingMethod?: string | null;
  totalTimeMinutes?: number | null;
  containsVegetableServing?: boolean | null;
  vegetableWeightG?: number | null;
  ingredientNames?: string[] | null;
  dietFlags?: Array<{ flagCode: string; value: boolean; confidence: number }> | null;
  /** Tags already on the recipe — preserved (deduped, lowercased). */
  existingTags?: string[] | null;
}

// ─── Static dictionaries (exported for validators) ────────────────────────────

/** Cuisine tags the autotagger may emit (mirrors P0.3 canonical set). */
export const CUISINE_TAGS = new Set<string>([
  'polska', 'włoska', 'azjatycka', 'śródziemnomorska', 'meksykańska',
  'indyjska', 'amerykańska', 'francuska', 'inna',
]);

/** mealType tags (lowercased Recipe.mealType enum values). */
export const MEAL_TYPE_TAGS = new Set<string>([
  'breakfast', 'second_breakfast', 'lunch', 'dinner', 'supper', 'snack',
  'dessert', 'drink', 'sauce', 'side_dish',
]);

/** Cooking-method tags (Recipe.cookingMethod → PL label). */
export const COOKING_METHOD_TAGS = new Set<string>([
  'pieczone', 'gotowane', 'smażone', 'grillowane', 'na-parze', 'surowe', 'duszone',
]);

const COOKING_METHOD_MAP: Record<string, string> = {
  BAKED: 'pieczone',
  BOILED: 'gotowane',
  FRIED: 'smażone',
  GRILLED: 'grillowane',
  STEAMED: 'na-parze',
  RAW: 'surowe',
  STEWED: 'duszone',
};

export const TIME_TAGS = new Set<string>(['szybkie', 'wymaga-czasu']);

/**
 * Curated diet-flag tags. Other RecipeDietFlag codes (lowSugar, lowCarb, lowFat,
 * ketoCompatible, ibsFriendly, renalFriendly, goutFriendly, liverFriendly) are
 * intentionally omitted — they're either redundant with macro filters or too
 * niche to broaden the solver's lexical disliked-foods match.
 */
export const DIET_FLAG_TAGS = new Set<string>([
  'vegan', 'vegetarian', 'pescatarian',
  'glutenFree', 'lactoseFree',
  'highProtein', 'highFiber',
  'diabeticFriendly', 'heartFriendly', 'pregnancyFriendly',
]);

export const INGREDIENT_SIGNAL_TAGS = new Set<string>([
  'pełnoziarniste', 'bogate-w-warzywa',
]);

/** All tags the autotagger can produce. Used by validators to spot drift. */
export const KNOWN_TAGS: ReadonlySet<string> = new Set<string>([
  ...CUISINE_TAGS, ...MEAL_TYPE_TAGS, ...COOKING_METHOD_TAGS,
  ...TIME_TAGS, ...DIET_FLAG_TAGS, ...INGREDIENT_SIGNAL_TAGS,
]);

/**
 * Tag pairs that must never co-occur. Detected by the validator as a hard
 * conflict — typically signals upstream data inconsistency (e.g. a recipe
 * with `vegan` tag but a fish ingredient).
 */
export const TAG_CONFLICTS: ReadonlyArray<readonly [string, string]> = [
  ['vegan', 'pescatarian'],          // pescatarian eats fish, vegan doesn't
  ['szybkie', 'wymaga-czasu'],       // mutually exclusive time buckets
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WHOLEGRAIN_RE = /(pełnoziarni|wholegr|whole\s*grain|razow(?:y|a|e|ej|ego|ych)|graham)/i;

const MIN_DIET_TAG_CONFIDENCE = 70; // confidence is stored 0-100 in DB

function pickStrictestVeggie(flags: AutotagInput['dietFlags']): string | null {
  if (!flags) return null;
  const codes = new Set(
    flags.filter((f) => f.value && f.confidence >= MIN_DIET_TAG_CONFIDENCE).map((f) => f.flagCode),
  );
  // Strictest wins: vegan ⊃ vegetarian ⊃ pescatarian.
  if (codes.has('vegan')) return 'vegan';
  if (codes.has('vegetarian')) return 'vegetarian';
  if (codes.has('pescatarian')) return 'pescatarian';
  return null;
}

function timeTag(totalMinutes: number | null | undefined): string | null {
  if (totalMinutes == null) return null;
  if (totalMinutes <= 20) return 'szybkie';
  if (totalMinutes >= 60) return 'wymaga-czasu';
  return null;
}

function vegetableRich(input: AutotagInput): boolean {
  if (input.containsVegetableServing) return true;
  if (input.vegetableWeightG != null && input.vegetableWeightG >= 100) return true;
  return false;
}

function hasWholeGrainIngredient(names: string[] | null | undefined): boolean {
  if (!names || names.length === 0) return false;
  return names.some((n) => WHOLEGRAIN_RE.test(n));
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function computeRecipeTags(input: AutotagInput): string[] {
  const out = new Set<string>();

  // 1. cuisine echo (already lowercased PL canonical)
  if (input.cuisineType && CUISINE_TAGS.has(input.cuisineType)) {
    out.add(input.cuisineType);
  }

  // 2. mealType echo (lowercase the enum value)
  if (input.mealType) {
    const mt = input.mealType.toLowerCase();
    if (MEAL_TYPE_TAGS.has(mt)) out.add(mt);
  }

  // 3. cookingMethod
  if (input.cookingMethod) {
    const mapped = COOKING_METHOD_MAP[input.cookingMethod.toUpperCase()];
    if (mapped) out.add(mapped);
  }

  // 4. time class
  const tt = timeTag(input.totalTimeMinutes);
  if (tt) out.add(tt);

  // 5. curated diet flags (vegan/vegetarian/pescatarian: strictest winner only)
  const veggieTag = pickStrictestVeggie(input.dietFlags);
  if (veggieTag) out.add(veggieTag);

  if (input.dietFlags) {
    for (const flag of input.dietFlags) {
      if (!flag.value) continue;
      if (flag.confidence < MIN_DIET_TAG_CONFIDENCE) continue;
      if (flag.flagCode === 'vegan' || flag.flagCode === 'vegetarian' || flag.flagCode === 'pescatarian') {
        // already handled above
        continue;
      }
      if (DIET_FLAG_TAGS.has(flag.flagCode)) out.add(flag.flagCode);
    }
  }

  // 6. whole-grain signal
  if (hasWholeGrainIngredient(input.ingredientNames)) out.add('pełnoziarniste');

  // 7. vegetable-rich signal
  if (vegetableRich(input)) out.add('bogate-w-warzywa');

  // Preserve only existing tags that are OUTSIDE the autotagger's own
  // vocabulary (e.g. 'ai-generated', 'side', 'basic' legacy markers).
  // Tags inside KNOWN_TAGS are recomputed on every run — passthrough would
  // let stale output leak (e.g. keeping 'pieczone' after cookingMethod
  // gets corrected upstream).
  if (input.existingTags) {
    for (const t of input.existingTags) {
      const trimmed = t.trim();
      if (!trimmed) continue;
      if (KNOWN_TAGS.has(trimmed)) continue;
      out.add(trimmed);
    }
  }

  return [...out].sort();
}
