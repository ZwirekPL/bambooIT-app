-- Create IngredientRepairLog (BUG-3 audit trail)
-- Applied via `prisma db push` on 2026-04-17 (shadow DB blocked by pre-existing
-- migration P3006 for NutritionProtocol); migration file created retroactively
-- so that `migrate:deploy` on PROD can apply it from SQL.

CREATE TABLE IF NOT EXISTS "IngredientRepairLog" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "recipeIngredientId" TEXT,
    "recipeId" TEXT NOT NULL,
    "oldDisplayName" TEXT,
    "newDisplayName" TEXT,
    "oldGrams" DECIMAL(10,2),
    "newGrams" DECIMAL(10,2),
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngredientRepairLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IngredientRepairLog_batchId_idx" ON "IngredientRepairLog"("batchId");
CREATE INDEX IF NOT EXISTS "IngredientRepairLog_recipeId_idx" ON "IngredientRepairLog"("recipeId");
CREATE INDEX IF NOT EXISTS "IngredientRepairLog_createdAt_idx" ON "IngredientRepairLog"("createdAt");
