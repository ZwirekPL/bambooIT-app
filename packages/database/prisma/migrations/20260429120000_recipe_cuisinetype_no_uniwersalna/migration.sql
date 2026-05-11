-- P0.3 (Recipe Overhaul Master Plan 2026-04-29): drop the 'uniwersalna' value
-- from Recipe.cuisineType. After this migration the column accepts the 9
-- canonical Polish values OR NULL — the legacy neutral-catch-all marker is
-- gone and any attempt to write 'uniwersalna' fails at the DB level.
--
-- Pre-condition (verified before authoring): P0.2 reclassified all 14 active
-- recipes that carried cuisineType='uniwersalna' on 2026-04-29. Inactive
-- recipes (if any) are left untouched — they're not visible to the solver.
--
-- Note: this is a *negative* CHECK ('not equal to uniwersalna') rather than a
-- positive whitelist. P0.4 (frontend cuisine collapse: drop 7 sub-cuisines
-- from UI) will tighten this into a positive list once the scraper
-- classifier (`cuisineClassifier.ts`) stops emitting 'bliskowschodnia' /
-- 'grecka'.

-- Idempotent: drop any existing variant of the constraint first.
ALTER TABLE "Recipe" DROP CONSTRAINT IF EXISTS "Recipe_cuisineType_no_uniwersalna";

ALTER TABLE "Recipe"
  ADD CONSTRAINT "Recipe_cuisineType_no_uniwersalna"
  CHECK ("cuisineType" IS NULL OR "cuisineType" <> 'uniwersalna');
