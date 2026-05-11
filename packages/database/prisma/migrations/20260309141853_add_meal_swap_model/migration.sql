-- CreateTable
CREATE TABLE "MealSwap" (
    "id" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "mealIndex" INTEGER NOT NULL,
    "originalMeal" JSONB NOT NULL,
    "alternatives" JSONB NOT NULL,
    "chosenIndex" INTEGER,
    "newMeal" JSONB,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealSwap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealSwap_dietPlanId_idx" ON "MealSwap"("dietPlanId");

-- CreateIndex
CREATE INDEX "MealSwap_dietPlanId_createdAt_idx" ON "MealSwap"("dietPlanId", "createdAt");

-- AddForeignKey
ALTER TABLE "MealSwap" ADD CONSTRAINT "MealSwap_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
