-- AddColumn: Recipe.origin (manual | scraped | ai_generated)
-- AddColumn: Recipe.aiApproved (admin approval flag for AI-generated recipes)
-- Applied via db push on 2026-04-13; migration file created retroactively.

ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "aiApproved" BOOLEAN NOT NULL DEFAULT false;