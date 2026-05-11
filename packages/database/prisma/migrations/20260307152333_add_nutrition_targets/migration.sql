-- CreateTable
CREATE TABLE "NutritionTargets" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "bmr" INTEGER NOT NULL,
    "tdee" INTEGER NOT NULL,
    "targetKcal" INTEGER NOT NULL,
    "targetProteinG" INTEGER NOT NULL,
    "targetFatG" INTEGER NOT NULL,
    "targetCarbsG" INTEGER NOT NULL,
    "activityLevel" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "ageYears" INTEGER,
    "weightKg" DECIMAL(6,2),
    "heightCm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionTargets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NutritionTargets_patientId_key" ON "NutritionTargets"("patientId");

-- AddForeignKey
ALTER TABLE "NutritionTargets" ADD CONSTRAINT "NutritionTargets_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
