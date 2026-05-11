-- AlterEnum
ALTER TYPE "DietPlanStatus" ADD VALUE 'MANUAL_REVIEW_REQUIRED';

-- AlterTable
ALTER TABLE "DietPlan" ADD COLUMN     "policyMetadata" JSONB;

-- RenameIndex
ALTER INDEX "IngredientSubstitutionRule_fromProductId_toProductId_dietCont_k" RENAME TO "IngredientSubstitutionRule_fromProductId_toProductId_dietCo_key";
