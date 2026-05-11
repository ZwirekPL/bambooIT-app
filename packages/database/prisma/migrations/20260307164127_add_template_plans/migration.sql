-- CreateTable
CREATE TABLE "TemplatePlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetKcal" INTEGER NOT NULL,
    "targetProteinG" INTEGER NOT NULL,
    "targetFatG" INTEGER NOT NULL,
    "targetCarbsG" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "dietType" "DietType" NOT NULL DEFAULT 'STANDARD',
    "mealCount" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateMeal" (
    "id" TEXT NOT NULL,
    "templatePlanId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "TemplateMeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplatePlan_goal_idx" ON "TemplatePlan"("goal");

-- CreateIndex
CREATE INDEX "TemplatePlan_targetKcal_idx" ON "TemplatePlan"("targetKcal");

-- CreateIndex
CREATE INDEX "TemplatePlan_dietType_idx" ON "TemplatePlan"("dietType");

-- CreateIndex
CREATE INDEX "TemplatePlan_isActive_idx" ON "TemplatePlan"("isActive");

-- CreateIndex
CREATE INDEX "TemplateMeal_templatePlanId_idx" ON "TemplateMeal"("templatePlanId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateMeal_templatePlanId_mealId_dayNumber_key" ON "TemplateMeal"("templatePlanId", "mealId", "dayNumber");

-- AddForeignKey
ALTER TABLE "TemplateMeal" ADD CONSTRAINT "TemplateMeal_templatePlanId_fkey" FOREIGN KEY ("templatePlanId") REFERENCES "TemplatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateMeal" ADD CONSTRAINT "TemplateMeal_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
