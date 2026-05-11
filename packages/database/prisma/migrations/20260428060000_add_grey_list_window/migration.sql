-- Z1 (grey list): per-dietitian window (1-4) controlling how many previous
-- DietPlans contribute their recipeIds to the regeneration grey list
-- soft-penalty pool. 0 disables the feature for that dietitian.
-- Idempotent style — matches the rest of this project's migration set.

ALTER TABLE "DietitianProfile"
  ADD COLUMN IF NOT EXISTS "greyListWindow" INTEGER NOT NULL DEFAULT 1;
