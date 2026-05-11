-- CreateTable
CREATE TABLE "DietTemplate" (
    "id" TEXT NOT NULL,
    "segmentHash" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "kcalBucket" INTEGER NOT NULL,
    "dietType" TEXT NOT NULL,
    "allergies" TEXT[],
    "diseases" TEXT[],
    "mealCount" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "kcal" INTEGER NOT NULL,
    "proteinG" INTEGER NOT NULL,
    "fatG" INTEGER NOT NULL,
    "carbsG" INTEGER NOT NULL,
    "sourceAiModel" TEXT,
    "sourceDietPlanId" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DietTemplate_segmentHash_key" ON "DietTemplate"("segmentHash");

-- CreateIndex
CREATE INDEX "DietTemplate_goal_idx" ON "DietTemplate"("goal");

-- CreateIndex
CREATE INDEX "DietTemplate_kcalBucket_idx" ON "DietTemplate"("kcalBucket");

-- CreateIndex
CREATE INDEX "DietTemplate_dietType_idx" ON "DietTemplate"("dietType");

-- CreateIndex
CREATE INDEX "DietTemplate_isActive_idx" ON "DietTemplate"("isActive");

-- CreateIndex
CREATE INDEX "DietTemplate_usageCount_idx" ON "DietTemplate"("usageCount");
