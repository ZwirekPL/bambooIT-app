-- CreateTable
CREATE TABLE "FoodItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "density" DECIMAL(5,3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodNutrients" (
    "id" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "kcal" DECIMAL(8,2) NOT NULL,
    "protein" DECIMAL(6,2) NOT NULL,
    "fat" DECIMAL(6,2) NOT NULL,
    "carbs" DECIMAL(6,2) NOT NULL,
    "fiber" DECIMAL(6,2),
    "sugar" DECIMAL(6,2),
    "salt" DECIMAL(6,2),

    CONSTRAINT "FoodNutrients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMeasure" (
    "id" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grams" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "HouseholdMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodAllergen" (
    "id" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "gluten" BOOLEAN NOT NULL DEFAULT false,
    "lactose" BOOLEAN NOT NULL DEFAULT false,
    "nuts" BOOLEAN NOT NULL DEFAULT false,
    "soy" BOOLEAN NOT NULL DEFAULT false,
    "eggs" BOOLEAN NOT NULL DEFAULT false,
    "fish" BOOLEAN NOT NULL DEFAULT false,
    "celery" BOOLEAN NOT NULL DEFAULT false,
    "mustard" BOOLEAN NOT NULL DEFAULT false,
    "sesame" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FoodAllergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "servings" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "grams" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodItem_name_idx" ON "FoodItem"("name");

-- CreateIndex
CREATE INDEX "FoodItem_category_idx" ON "FoodItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "FoodNutrients_foodItemId_key" ON "FoodNutrients"("foodItemId");

-- CreateIndex
CREATE INDEX "HouseholdMeasure_foodItemId_idx" ON "HouseholdMeasure"("foodItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodAllergen_foodItemId_key" ON "FoodAllergen"("foodItemId");

-- CreateIndex
CREATE INDEX "Recipe_name_idx" ON "Recipe"("name");

-- CreateIndex
CREATE INDEX "RecipeItem_recipeId_idx" ON "RecipeItem"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeItem_foodItemId_idx" ON "RecipeItem"("foodItemId");

-- AddForeignKey
ALTER TABLE "FoodNutrients" ADD CONSTRAINT "FoodNutrients_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMeasure" ADD CONSTRAINT "HouseholdMeasure_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodAllergen" ADD CONSTRAINT "FoodAllergen_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
