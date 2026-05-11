/**
 * Faza D Phase 2 prep — per-patient `composeMeals` gating.
 *
 * Resolves whether the 3-tuple meal composition path should fire for a
 * given patient based on env config. Used by `planPipeline.service.ts`
 * + `dbPipeline.service.ts` when building AssemblyInput.
 *
 * Resolution order:
 *   1. `ENABLE_3_TUPLE_COMPOSITION=true`  → global ON (Phase 4 default-on path)
 *   2. `COMPOSE_MEALS_PATIENT_IDS` includes patientId → per-patient opt-in
 *      (Phase 2 shadow / Phase 3 beta — curated list of test patients)
 *   3. else → OFF (legacy single-element path, gold-standard bit-equal)
 *
 * Env-based allowlist deliberately avoids a DB migration during phased
 * rollout. When Phase 2 needs to onboard a patient: edit env, restart
 * backend container. When Phase 4 default-on lands, replace
 * COMPOSE_MEALS_PATIENT_IDS use with `ENABLE_3_TUPLE_COMPOSITION=true`.
 */

let cachedAllowList: Set<string> | null = null;
let cachedAllowListSource: string | undefined;

function getAllowList(): Set<string> {
  const raw = process.env.COMPOSE_MEALS_PATIENT_IDS;
  if (raw === cachedAllowListSource && cachedAllowList) {
    return cachedAllowList;
  }
  const ids = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  cachedAllowList = new Set(ids);
  cachedAllowListSource = raw;
  return cachedAllowList;
}

/**
 * Returns true when this patient should generate plans through the
 * 3-tuple compose path. Tests can rely on this being a pure read of
 * `process.env` at call time — there is no internal state beyond a
 * tiny env-string-keyed cache (which auto-invalidates).
 */
export function isComposeMealsEnabledFor(patientId: string): boolean {
  if (process.env.ENABLE_3_TUPLE_COMPOSITION === 'true') return true;
  if (!patientId) return false;
  return getAllowList().has(patientId);
}

/** Test-only helper to bypass the cache when env vars change mid-run. */
export function _resetComposeMealsFlagCache(): void {
  cachedAllowList = null;
  cachedAllowListSource = undefined;
}
