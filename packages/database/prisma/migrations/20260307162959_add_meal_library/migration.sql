-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'SUPPER');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('STANDARD', 'VEGE', 'VEGAN', 'GLUTEN_FREE', 'LACTOSE_FREE');

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mealType" "MealType" NOT NULL,
    "dietType" "DietType" NOT NULL DEFAULT 'STANDARD',
    "kcal" INTEGER NOT NULL,
    "proteinG" DECIMAL(6,2) NOT NULL,
    "fatG" DECIMAL(6,2) NOT NULL,
    "carbsG" DECIMAL(6,2) NOT NULL,
    "hasGluten" BOOLEAN NOT NULL DEFAULT false,
    "hasLactose" BOOLEAN NOT NULL DEFAULT false,
    "hasNuts" BOOLEAN NOT NULL DEFAULT false,
    "hasSoy" BOOLEAN NOT NULL DEFAULT false,
    "hasEggs" BOOLEAN NOT NULL DEFAULT false,
    "hasFish" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "recipeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meal_mealType_idx" ON "Meal"("mealType");

-- CreateIndex
CREATE INDEX "Meal_dietType_idx" ON "Meal"("dietType");

-- CreateIndex
CREATE INDEX "Meal_isActive_idx" ON "Meal"("isActive");

-- CreateIndex
CREATE INDEX "Meal_kcal_idx" ON "Meal"("kcal");

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
