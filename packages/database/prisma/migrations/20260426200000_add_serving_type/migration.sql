-- Faza E — Recipe.servingType enum.
-- Tells the solver how to interpret nutritionSnapshot.kcal:
--   PER_PORTION (default) — kcal per realistic 1-plate portion
--   PER_PIECE             — kcal per single piece (1 naleśnik, 1 placek)
--   PER_100G              — kcal per 100g (soups, sauces, beverages)
-- Without this signal the solver scales naleśniki by ×17 to hit a 350-kcal
-- breakfast slot ("zjedz 17 naleśników"). Idempotent style.

DO $$ BEGIN
  CREATE TYPE "ServingType" AS ENUM ('PER_PORTION', 'PER_PIECE', 'PER_100G');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "servingType" "ServingType" NOT NULL DEFAULT 'PER_PORTION';

CREATE INDEX IF NOT EXISTS "Recipe_servingType_idx" ON "Recipe"("servingType");
