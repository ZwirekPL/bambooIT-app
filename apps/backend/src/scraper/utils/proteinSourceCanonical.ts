/**
 * Recipe → canonical protein bucket projection (P1.3 — Recipe Overhaul Master
 * Plan 2026-04-29).
 *
 * Maps a recipe to one of eight buckets used by the SC30 weekly-cap engine:
 *
 *   fish_fatty | fish_white | seafood | poultry |
 *   red_meat   | eggs       | legumes | tofu
 *
 * The fish split (fatty vs white) is the new piece — it doesn't exist in the
 * `proteinSource.ts` argmax classifier, which collapses both into 'fish'. We
 * derive it from the leading fish-ingredient name. If no recognised fatty fish
 * stem appears, we fall back to `fish_white` (the safer / more common bucket).
 *
 * `null` return = recipe carries no protein bucket relevant to SC30 (e.g. a
 * dairy-only or grain-only side, or `proteinSource ∈ {dairy, nuts, grain,
 * vegetable, other}`). Such recipes still show up in plans but don't draw
 * from any cap.
 */

import { computeRecipeProteinSource, type ProteinSource, type RecipeIngredientInput } from './proteinSource';
import { normalizeProductName } from './productMatcher';

export type ProteinCanonicalBucket =
  | 'fish_fatty'
  | 'fish_white'
  | 'seafood'
  | 'poultry'
  | 'red_meat'
  | 'eggs'
  | 'legumes'
  | 'tofu';

/**
 * Stems for fatty-fish names (canonical-form, diacritics already stripped).
 * EFSA / AHA classify these as ω-3-rich and methylmercury-aware species.
 * Anything fish-classified that doesn't match → fish_white.
 */
const FATTY_FISH_STEMS = [
  'losos',     // łosoś
  'makrel',    // makrela
  'sled',      // śledź
  'sardynk',   // sardynka
  'tunczyk',   // tuńczyk — borderline, but EFSA lumps with fatty
  'pstrag',    // pstrąg
  'wegorz',    // węgorz
];

function isFattyFishName(name: string): boolean {
  const canon = normalizeProductName(name);
  return FATTY_FISH_STEMS.some((stem) => canon.includes(stem));
}

/**
 * Project a `ProteinSource` (from the existing argmax classifier) onto a
 * canonical bucket. For `fish` we need the dominant ingredient name to
 * decide fatty vs white — pass it via `topFishIngredientName`.
 */
export function projectProteinSourceToBucket(
  src: ProteinSource,
  topFishIngredientName?: string | null,
): ProteinCanonicalBucket | null {
  switch (src) {
    case 'poultry':
      return 'poultry';
    case 'beef':
    case 'pork':
    case 'lamb':
      return 'red_meat';
    case 'fish':
      if (topFishIngredientName && isFattyFishName(topFishIngredientName)) return 'fish_fatty';
      return 'fish_white';
    case 'seafood':
      return 'seafood';
    case 'egg':
      return 'eggs';
    case 'legume':
      return 'legumes';
    case 'tofu':
      return 'tofu';
    case 'dairy':
    case 'nuts':
    case 'grain':
    case 'vegetable':
    case 'other':
    default:
      return null;
  }
}

export interface CanonicalBucketReport {
  bucket: ProteinCanonicalBucket | null;
  /** Underlying `ProteinSource` from the argmax classifier (for traceability). */
  proteinSource: ProteinSource;
  /** Top fish ingredient by protein contribution (only when bucket starts with `fish_`). */
  topFishIngredient: string | null;
  /** Total protein grams in the recipe (sanity threshold: <2g → bucket = null). */
  totalProteinG: number;
}

/**
 * Compute the canonical protein bucket for a recipe. Combines the existing
 * argmax classifier (`proteinSource.ts`) with the fatty/white fish split.
 *
 * Edge: very-low-protein recipes (<2 g per portion) return `bucket=null` so
 * the cap engine doesn't treat them as protein contributors.
 */
export function computeCanonicalProteinBucket(
  ingredients: RecipeIngredientInput[],
): CanonicalBucketReport {
  const report = computeRecipeProteinSource(ingredients);

  // Pull the highest-protein fish-classified ingredient name (used for the
  // fatty/white decision). Falls back to the report's overall top contributor
  // if no fish ingredient stands out — that path is only reached when
  // proteinSource === 'fish' anyway, so the top contributor is fish-typed.
  let topFishIngredient: string | null = null;
  if (report.source === 'fish') {
    const fishContribs = report.contributions.filter((c) => c.source === 'fish');
    topFishIngredient = fishContribs[0]?.name ?? report.topIngredient?.name ?? null;
  }

  const bucket = projectProteinSourceToBucket(report.source, topFishIngredient);

  return {
    bucket,
    proteinSource: report.source,
    topFishIngredient,
    totalProteinG: report.totalProteinG,
  };
}
