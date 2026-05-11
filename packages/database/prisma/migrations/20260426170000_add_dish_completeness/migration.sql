-- Faza C — Recipe.dishCompleteness enum + warzywny audit fields.
-- Solver po backfillu rozróżnia czy przepis to samodzielny posiłek
-- (COMPLETE_MEAL), czy element wymagający uzupełnienia (MAIN_DISH/CARB_SIDE/
-- VEG_SIDE/COMPONENT). containsVegetableServing + vegetableWeightG dostarczają
-- danych dla Faza D (compose meals: main + carb + veg).
-- Idempotent style — schemat może być już częściowo zsynchronizowany.

DO $$ BEGIN
  CREATE TYPE "DishCompleteness" AS ENUM ('COMPLETE_MEAL', 'MAIN_DISH', 'CARB_SIDE', 'VEG_SIDE', 'COMPONENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "dishCompleteness" "DishCompleteness";
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "containsVegetableServing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "vegetableWeightG" INTEGER;

CREATE INDEX IF NOT EXISTS "Recipe_dishCompleteness_idx" ON "Recipe"("dishCompleteness");
