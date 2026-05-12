/*
  Warnings:

  - You are about to drop the column `recipeId` on the `Meal` table. All the data in the column will be lost.
  - You are about to drop the `CleanProduct` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CleanProductAllergen` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CleanProductAminoAcids` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CleanProductBioactives` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CleanProductDietFlag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CleanProductNutrients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CleanProductPortion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DataQualityIssue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FavoriteMeal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FoodBrand` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FoodCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FoodProduct` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FoodProductAlias` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FoodProductAllergen` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FoodProductDietFlag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FoodProductNutrients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FoodProductSourceMeta` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HouseholdMeasure` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ImportJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IngredientRepairLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IngredientSubstitutionRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ManualReviewQueue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Recipe` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeAllergen` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeDietFlag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeIngredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeInstructionStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeNutritionSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeRating` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShoppingListCheck` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CleanProductAllergen" DROP CONSTRAINT "CleanProductAllergen_cleanProductId_fkey";

-- DropForeignKey
ALTER TABLE "CleanProductAminoAcids" DROP CONSTRAINT "CleanProductAminoAcids_cleanProductId_fkey";

-- DropForeignKey
ALTER TABLE "CleanProductBioactives" DROP CONSTRAINT "CleanProductBioactives_cleanProductId_fkey";

-- DropForeignKey
ALTER TABLE "CleanProductDietFlag" DROP CONSTRAINT "CleanProductDietFlag_cleanProductId_fkey";

-- DropForeignKey
ALTER TABLE "CleanProductNutrients" DROP CONSTRAINT "CleanProductNutrients_cleanProductId_fkey";

-- DropForeignKey
ALTER TABLE "CleanProductPortion" DROP CONSTRAINT "CleanProductPortion_cleanProductId_fkey";

-- DropForeignKey
ALTER TABLE "FavoriteMeal" DROP CONSTRAINT "FavoriteMeal_patientId_fkey";

-- DropForeignKey
ALTER TABLE "FoodCategory" DROP CONSTRAINT "FoodCategory_parentId_fkey";

-- DropForeignKey
ALTER TABLE "FoodProduct" DROP CONSTRAINT "FoodProduct_brandId_fkey";

-- DropForeignKey
ALTER TABLE "FoodProduct" DROP CONSTRAINT "FoodProduct_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "FoodProductAlias" DROP CONSTRAINT "FoodProductAlias_foodProductId_fkey";

-- DropForeignKey
ALTER TABLE "FoodProductAllergen" DROP CONSTRAINT "FoodProductAllergen_foodProductId_fkey";

-- DropForeignKey
ALTER TABLE "FoodProductDietFlag" DROP CONSTRAINT "FoodProductDietFlag_foodProductId_fkey";

-- DropForeignKey
ALTER TABLE "FoodProductNutrients" DROP CONSTRAINT "FoodProductNutrients_foodProductId_fkey";

-- DropForeignKey
ALTER TABLE "FoodProductSourceMeta" DROP CONSTRAINT "FoodProductSourceMeta_foodProductId_fkey";

-- DropForeignKey
ALTER TABLE "HouseholdMeasure" DROP CONSTRAINT "HouseholdMeasure_foodProductId_fkey";

-- DropForeignKey
ALTER TABLE "IngredientSubstitutionRule" DROP CONSTRAINT "IngredientSubstitutionRule_fromProductId_fkey";

-- DropForeignKey
ALTER TABLE "IngredientSubstitutionRule" DROP CONSTRAINT "IngredientSubstitutionRule_toProductId_fkey";

-- DropForeignKey
ALTER TABLE "Meal" DROP CONSTRAINT "Meal_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeAllergen" DROP CONSTRAINT "RecipeAllergen_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeDietFlag" DROP CONSTRAINT "RecipeDietFlag_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeIngredient" DROP CONSTRAINT "RecipeIngredient_cleanProductId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeIngredient" DROP CONSTRAINT "RecipeIngredient_foodProductId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeIngredient" DROP CONSTRAINT "RecipeIngredient_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeInstructionStep" DROP CONSTRAINT "RecipeInstructionStep_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeNutritionSnapshot" DROP CONSTRAINT "RecipeNutritionSnapshot_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeRating" DROP CONSTRAINT "RecipeRating_patientId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeRating" DROP CONSTRAINT "RecipeRating_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "ShoppingListCheck" DROP CONSTRAINT "ShoppingListCheck_dietPlanId_fkey";

-- DropForeignKey
ALTER TABLE "ShoppingListCheck" DROP CONSTRAINT "ShoppingListCheck_patientId_fkey";

-- AlterTable
ALTER TABLE "Meal" DROP COLUMN "recipeId";

-- DropTable
DROP TABLE "CleanProduct";

-- DropTable
DROP TABLE "CleanProductAllergen";

-- DropTable
DROP TABLE "CleanProductAminoAcids";

-- DropTable
DROP TABLE "CleanProductBioactives";

-- DropTable
DROP TABLE "CleanProductDietFlag";

-- DropTable
DROP TABLE "CleanProductNutrients";

-- DropTable
DROP TABLE "CleanProductPortion";

-- DropTable
DROP TABLE "DataQualityIssue";

-- DropTable
DROP TABLE "FavoriteMeal";

-- DropTable
DROP TABLE "FoodBrand";

-- DropTable
DROP TABLE "FoodCategory";

-- DropTable
DROP TABLE "FoodProduct";

-- DropTable
DROP TABLE "FoodProductAlias";

-- DropTable
DROP TABLE "FoodProductAllergen";

-- DropTable
DROP TABLE "FoodProductDietFlag";

-- DropTable
DROP TABLE "FoodProductNutrients";

-- DropTable
DROP TABLE "FoodProductSourceMeta";

-- DropTable
DROP TABLE "HouseholdMeasure";

-- DropTable
DROP TABLE "ImportJob";

-- DropTable
DROP TABLE "IngredientRepairLog";

-- DropTable
DROP TABLE "IngredientSubstitutionRule";

-- DropTable
DROP TABLE "ManualReviewQueue";

-- DropTable
DROP TABLE "Recipe";

-- DropTable
DROP TABLE "RecipeAllergen";

-- DropTable
DROP TABLE "RecipeDietFlag";

-- DropTable
DROP TABLE "RecipeIngredient";

-- DropTable
DROP TABLE "RecipeInstructionStep";

-- DropTable
DROP TABLE "RecipeNutritionSnapshot";

-- DropTable
DROP TABLE "RecipeRating";

-- DropTable
DROP TABLE "ShoppingListCheck";

-- DropEnum
DROP TYPE "AllergenPresence";

-- DropEnum
DROP TYPE "CleanProductSource";

-- DropEnum
DROP TYPE "CleanProductType";

-- DropEnum
DROP TYPE "CleanVerificationStatus";

-- DropEnum
DROP TYPE "DataQualitySeverity";

-- DropEnum
DROP TYPE "DietFlagSource";

-- DropEnum
DROP TYPE "DishCompleteness";

-- DropEnum
DROP TYPE "FodmapLevel";

-- DropEnum
DROP TYPE "FoodRestrictionLevel";

-- DropEnum
DROP TYPE "FoodState";

-- DropEnum
DROP TYPE "ImportJobStatus";

-- DropEnum
DROP TYPE "PriceCategory";

-- DropEnum
DROP TYPE "ProcessingLevel";

-- DropEnum
DROP TYPE "RecipeDifficulty";

-- DropEnum
DROP TYPE "RecipeMealType";

-- DropEnum
DROP TYPE "ReviewItemStatus";

-- DropEnum
DROP TYPE "ReviewItemType";

-- DropEnum
DROP TYPE "ServingType";

-- DropEnum
DROP TYPE "VerificationStatus";
