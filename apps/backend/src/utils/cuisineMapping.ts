/**
 * Cuisine code translation between interview answers (EN) and Recipe.cuisineType (PL).
 *
 * Background: The interview form ([InterviewForm.tsx]) emits 17 English codes
 * (`polish`, `mediterranean`, `mexican`, `asian_general`, `thai`, ...). The
 * Recipe.cuisineType column in DB carries 9 Polish values (`polska`, `włoska`,
 * `azjatycka`, `śródziemnomorska`, `meksykańska`, `indyjska`, `amerykańska`,
 * `francuska`, `inna`) plus a few legacy typos.
 *
 * Without translation the cuisine soft-constraint never matches anything,
 * which is why Faza D's cuisinePreferences hard filter wiped every candidate
 * pool to zero (root cause of solver INFEASIBLE for any patient who picked
 * a specific cuisine in the interview).
 *
 * Mapping strategy:
 *   • Direct codes (polish→polska, mexican→meksykańska, …) — exact PL counterpart.
 *   • Asian sub-cuisines (thai, japanese, vietnamese) collapse to `azjatycka`
 *     since the DB does not break them out.
 *   • Levantine / Eastern Mediterranean (greek, turkish, lebanese,
 *     middle_eastern) collapse to `śródziemnomorska` — the closest cluster.
 *     Greek is *part of* Mediterranean cuisine so this is a clinical/culinary
 *     reasonable widening.
 *   • `scandinavian` was offered in the interview before Z5 (2026-04-28)
 *     but dropped because `inna` is a true catch-all (1 161 recipes, none
 *     actually Scandinavian) and the patient signal was effectively lost.
 *     The mapping is **kept** here for backward compatibility with old
 *     Interview.answers that still carry the value — they continue to
 *     resolve to `inna` so existing plans don't error. New patients can
 *     no longer pick the option.
 *   • `any` returns `[]` — caller treats this as "no preference active".
 */

const BASE_MAP: Record<string, string[]> = {
  polish: ['polska'],
  italian: ['włoska', 'wloska'], // include legacy typo
  mediterranean: ['śródziemnomorska', 'srodziemnomorska'],
  greek: ['śródziemnomorska'],
  french: ['francuska'],
  scandinavian: ['inna'], // Legacy — option dropped from interview in Z5 (2026-04-28); kept here for back-compat with stored answers.
  middle_eastern: ['śródziemnomorska'],
  turkish: ['śródziemnomorska'],
  lebanese: ['śródziemnomorska'],
  indian: ['indyjska'],
  thai: ['azjatycka'],
  japanese: ['azjatycka'],
  vietnamese: ['azjatycka'],
  asian_general: ['azjatycka'],
  mexican: ['meksykańska'],
  american: ['amerykańska'],
};

/**
 * Map interview EN cuisine codes to the set of DB cuisineType values that
 * count as a "match" for the solver soft constraint.
 *
 * - `[]` (empty) or `undefined` input → `[]` (no preference).
 * - `["any"]` (case-insensitive) → `[]` (patient explicitly opted out).
 * - Otherwise: union of mapped PL codes (deduped, lowercased).
 */
export function mapCuisinePrefsToDb(prefs: string[] | undefined | null): string[] {
  if (!prefs || prefs.length === 0) return [];
  const lowered = prefs.map((p) => p.toLowerCase().trim()).filter((p) => p.length > 0);
  if (lowered.some((p) => p === 'any')) return [];
  const mapped = lowered.flatMap((p) => BASE_MAP[p] ?? []);
  return [...new Set(mapped.map((m) => m.toLowerCase()))];
}

export type CuisineMatchKind = 'match' | 'neutral' | 'mismatch';

/**
 * Decide how a candidate's cuisineType compares to the patient's preferred
 * cuisines. Used by the soft-constraint scoring path:
 *
 *   • `match`     — recipe cuisine is in the patient's preferred set
 *   • `neutral`   — patient has no preference, OR recipe is universal/null
 *   • `mismatch`  — patient HAS preferences, recipe cuisine is something else
 *
 * Recipes with cuisineType=null pass as `neutral` so they don't drag the
 * score down. The legacy 'uniwersalna' value was dropped in P0.3 (Recipe
 * Overhaul Master Plan 2026-04-29) — a CHECK constraint on Recipe.cuisineType
 * blocks reintroduction.
 */
export function classifyCuisineMatch(
  recipeCuisine: string | null | undefined,
  patientPrefs: string[] | undefined | null,
): CuisineMatchKind {
  const dbCodes = mapCuisinePrefsToDb(patientPrefs);
  if (dbCodes.length === 0) return 'neutral';

  if (recipeCuisine == null || recipeCuisine === '') return 'neutral';
  const normalized = recipeCuisine.toLowerCase().trim();

  return dbCodes.includes(normalized) ? 'match' : 'mismatch';
}
