-- Professional Food Database Migration
-- Replaces basic FoodItem/FoodNutrients/FoodAllergen with comprehensive models

-- ═══════════════════════════════════════════════════════════════════════════════
-- NEW ENUMS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE "FoodState" AS ENUM ('RAW', 'COOKED', 'BAKED', 'FRIED', 'GRILLED', 'STEAMED', 'DRIED', 'FROZEN', 'CANNED', 'SMOKED', 'FERMENTED', 'PICKLED', 'PROCESSED', 'RECONSTITUTED');
CREATE TYPE "FodmapLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'UNKNOWN');
CREATE TYPE "ProcessingLevel" AS ENUM ('UNPROCESSED', 'MINIMALLY_PROCESSED', 'PROCESSED_INGREDIENT', 'PROCESSED', 'ULTRA_PROCESSED');
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'AUTO_VERIFIED', 'MANUALLY_VERIFIED', 'REJECTED');
CREATE TYPE "AllergenPresence" AS ENUM ('CONTAINS', 'MAY_CONTAIN', 'FREE', 'UNKNOWN');
CREATE TYPE "DietFlagSource" AS ENUM ('AUTO_RULE', 'MANUAL', 'HEURISTIC', 'SOURCE_DATA');
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "DataQualitySeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');
CREATE TYPE "ReviewItemType" AS ENUM ('FOOD_PRODUCT', 'RECIPE');
CREATE TYPE "ReviewItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');
CREATE TYPE "RecipeDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "RecipeMealType" AS ENUM ('BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'DINNER', 'SUPPER', 'SNACK', 'DESSERT', 'DRINK', 'SAUCE', 'SIDE_DISH');

-- ═══════════════════════════════════════════════════════════════════════════════
-- DROP OLD TABLES (order matters for foreign keys)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Disconnect Meal from old Recipe (preserve Meal rows)
ALTER TABLE "Meal" DROP CONSTRAINT IF EXISTS "Meal_recipeId_fkey";

-- Drop old food tables
DROP TABLE IF EXISTS "RecipeItem" CASCADE;
DROP TABLE IF EXISTS "FoodAllergen" CASCADE;
DROP TABLE IF EXISTS "FoodNutrients" CASCADE;
DROP TABLE IF EXISTS "HouseholdMeasure" CASCADE;

-- Drop old Recipe (Meal.recipeId becomes orphaned but nullable, will be re-linked)
DROP TABLE IF EXISTS "Recipe" CASCADE;

-- Drop old FoodItem
DROP TABLE IF EXISTS "FoodItem" CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOOD CATEGORIES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "FoodCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "iconName" TEXT,
    CONSTRAINT "FoodCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodCategory_slug_key" ON "FoodCategory"("slug");
CREATE INDEX "FoodCategory_parentId_idx" ON "FoodCategory"("parentId");
CREATE INDEX "FoodCategory_slug_idx" ON "FoodCategory"("slug");

ALTER TABLE "FoodCategory" ADD CONSTRAINT "FoodCategory_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "FoodCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOOD BRANDS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "FoodBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoodBrand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodBrand_slug_key" ON "FoodBrand"("slug");
CREATE INDEX "FoodBrand_slug_idx" ON "FoodBrand"("slug");

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOOD PRODUCTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "FoodProduct" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "slug" TEXT NOT NULL,
    "brandId" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "state" "FoodState" NOT NULL DEFAULT 'RAW',
    "ediblePortionPercent" DECIMAL(5,2),
    "density_g_per_ml" DECIMAL(6,3),
    "defaultServingGrams" DECIMAL(7,2),
    "searchableSynonyms" TEXT[],
    "languageCode" TEXT NOT NULL DEFAULT 'pl',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "glycemicIndex" INTEGER,
    "glycemicLoadPer100g" DECIMAL(6,2),
    "fodmapLevel" "FodmapLevel",
    "processingLevel" "ProcessingLevel",
    "isBabySafe" BOOLEAN,
    "isPregnancySafe" BOOLEAN,
    "isBreastfeedingSafe" BOOLEAN,
    "notesClinical" TEXT,
    "notesDietitian" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FoodProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodProduct_slug_key" ON "FoodProduct"("slug");
CREATE UNIQUE INDEX "FoodProduct_source_sourceId_key" ON "FoodProduct"("source", "sourceId");
CREATE INDEX "FoodProduct_name_idx" ON "FoodProduct"("name");
CREATE INDEX "FoodProduct_slug_idx" ON "FoodProduct"("slug");
CREATE INDEX "FoodProduct_categoryId_idx" ON "FoodProduct"("categoryId");
CREATE INDEX "FoodProduct_brandId_idx" ON "FoodProduct"("brandId");
CREATE INDEX "FoodProduct_languageCode_idx" ON "FoodProduct"("languageCode");
CREATE INDEX "FoodProduct_isActive_idx" ON "FoodProduct"("isActive");
CREATE INDEX "FoodProduct_verificationStatus_idx" ON "FoodProduct"("verificationStatus");
CREATE INDEX "FoodProduct_qualityScore_idx" ON "FoodProduct"("qualityScore");

ALTER TABLE "FoodProduct" ADD CONSTRAINT "FoodProduct_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "FoodBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FoodProduct" ADD CONSTRAINT "FoodProduct_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOOD PRODUCT NUTRIENTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "FoodProductNutrients" (
    "id" TEXT NOT NULL,
    "foodProductId" TEXT NOT NULL,
    -- Macronutrients
    "kcal" DECIMAL(8,2) NOT NULL,
    "protein_g" DECIMAL(7,3) NOT NULL,
    "fat_g" DECIMAL(7,3) NOT NULL,
    "saturatedFat_g" DECIMAL(7,3),
    "monounsaturatedFat_g" DECIMAL(7,3),
    "polyunsaturatedFat_g" DECIMAL(7,3),
    "transFat_g" DECIMAL(7,3),
    "carbs_g" DECIMAL(7,3) NOT NULL,
    "sugars_g" DECIMAL(7,3),
    "addedSugars_g" DECIMAL(7,3),
    "fiber_g" DECIMAL(7,3),
    "starch_g" DECIMAL(7,3),
    "salt_g" DECIMAL(7,3),
    -- Minerals
    "sodium_mg" DECIMAL(8,3),
    "potassium_mg" DECIMAL(8,3),
    "calcium_mg" DECIMAL(8,3),
    "magnesium_mg" DECIMAL(8,3),
    "phosphorus_mg" DECIMAL(8,3),
    "iron_mg" DECIMAL(7,3),
    "zinc_mg" DECIMAL(7,3),
    "copper_mg" DECIMAL(7,4),
    "manganese_mg" DECIMAL(7,4),
    "iodine_ug" DECIMAL(7,3),
    "selenium_ug" DECIMAL(7,3),
    "chromium_ug" DECIMAL(7,3),
    "molybdenum_ug" DECIMAL(7,3),
    -- Fat-soluble vitamins
    "vitaminA_ug" DECIMAL(8,3),
    "betaCarotene_ug" DECIMAL(8,3),
    "vitaminD_ug" DECIMAL(7,3),
    "vitaminE_mg" DECIMAL(7,3),
    "vitaminK_ug" DECIMAL(7,3),
    -- Water-soluble vitamins
    "vitaminC_mg" DECIMAL(7,3),
    "vitaminB1_mg" DECIMAL(7,4),
    "vitaminB2_mg" DECIMAL(7,4),
    "vitaminB3_mg" DECIMAL(7,3),
    "vitaminB5_mg" DECIMAL(7,3),
    "vitaminB6_mg" DECIMAL(7,4),
    "folate_ug" DECIMAL(7,3),
    "vitaminB12_ug" DECIMAL(7,4),
    "biotin_ug" DECIMAL(7,3),
    "choline_mg" DECIMAL(7,3),
    -- Other
    "cholesterol_mg" DECIMAL(7,3),
    "water_g" DECIMAL(7,3),
    "alcohol_g" DECIMAL(7,3),
    "caffeine_mg" DECIMAL(7,3),
    "ash_g" DECIMAL(7,3),
    -- Amino acids
    "tryptophan_g" DECIMAL(6,4),
    "threonine_g" DECIMAL(6,4),
    "isoleucine_g" DECIMAL(6,4),
    "leucine_g" DECIMAL(6,4),
    "lysine_g" DECIMAL(6,4),
    "methionine_g" DECIMAL(6,4),
    "phenylalanine_g" DECIMAL(6,4),
    "valine_g" DECIMAL(6,4),
    "histidine_g" DECIMAL(6,4),
    -- Fatty acids detail
    "omega3_g" DECIMAL(7,4),
    "omega6_g" DECIMAL(7,4),
    "epa_g" DECIMAL(6,4),
    "dha_g" DECIMAL(6,4),
    "ala_g" DECIMAL(6,4),
    -- Purines & Oxalates
    "purines_mg" DECIMAL(7,3),
    "oxalate_mg" DECIMAL(7,3),
    CONSTRAINT "FoodProductNutrients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodProductNutrients_foodProductId_key" ON "FoodProductNutrients"("foodProductId");

ALTER TABLE "FoodProductNutrients" ADD CONSTRAINT "FoodProductNutrients_foodProductId_fkey"
    FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOOD PRODUCT ALLERGENS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "FoodProductAllergen" (
    "id" TEXT NOT NULL,
    "foodProductId" TEXT NOT NULL,
    "allergenCode" TEXT NOT NULL,
    "presence" "AllergenPresence" NOT NULL DEFAULT 'UNKNOWN',
    "source" "DietFlagSource" NOT NULL DEFAULT 'AUTO_RULE',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "FoodProductAllergen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodProductAllergen_foodProductId_allergenCode_key" ON "FoodProductAllergen"("foodProductId", "allergenCode");
CREATE INDEX "FoodProductAllergen_foodProductId_idx" ON "FoodProductAllergen"("foodProductId");
CREATE INDEX "FoodProductAllergen_allergenCode_idx" ON "FoodProductAllergen"("allergenCode");

ALTER TABLE "FoodProductAllergen" ADD CONSTRAINT "FoodProductAllergen_foodProductId_fkey"
    FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOOD PRODUCT DIET FLAGS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "FoodProductDietFlag" (
    "id" TEXT NOT NULL,
    "foodProductId" TEXT NOT NULL,
    "flagCode" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT true,
    "source" "DietFlagSource" NOT NULL DEFAULT 'AUTO_RULE',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoodProductDietFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodProductDietFlag_foodProductId_flagCode_key" ON "FoodProductDietFlag"("foodProductId", "flagCode");
CREATE INDEX "FoodProductDietFlag_foodProductId_idx" ON "FoodProductDietFlag"("foodProductId");
CREATE INDEX "FoodProductDietFlag_flagCode_idx" ON "FoodProductDietFlag"("flagCode");
CREATE INDEX "FoodProductDietFlag_value_idx" ON "FoodProductDietFlag"("value");

ALTER TABLE "FoodProductDietFlag" ADD CONSTRAINT "FoodProductDietFlag_foodProductId_fkey"
    FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOOD PRODUCT ALIASES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "FoodProductAlias" (
    "id" TEXT NOT NULL,
    "foodProductId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'pl',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "FoodProductAlias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FoodProductAlias_foodProductId_idx" ON "FoodProductAlias"("foodProductId");
CREATE INDEX "FoodProductAlias_alias_idx" ON "FoodProductAlias"("alias");
CREATE INDEX "FoodProductAlias_languageCode_idx" ON "FoodProductAlias"("languageCode");

ALTER TABLE "FoodProductAlias" ADD CONSTRAINT "FoodProductAlias_foodProductId_fkey"
    FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOOD PRODUCT SOURCE META
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "FoodProductSourceMeta" (
    "id" TEXT NOT NULL,
    "foodProductId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "sourceLicense" TEXT,
    "sourceVersion" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawData" JSONB,
    CONSTRAINT "FoodProductSourceMeta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FoodProductSourceMeta_foodProductId_idx" ON "FoodProductSourceMeta"("foodProductId");
CREATE INDEX "FoodProductSourceMeta_source_sourceId_idx" ON "FoodProductSourceMeta"("source", "sourceId");

ALTER TABLE "FoodProductSourceMeta" ADD CONSTRAINT "FoodProductSourceMeta_foodProductId_fkey"
    FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- HOUSEHOLD MEASURES (recreated for new FoodProduct)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "HouseholdMeasure" (
    "id" TEXT NOT NULL,
    "foodProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "grams" DECIMAL(7,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "HouseholdMeasure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HouseholdMeasure_foodProductId_idx" ON "HouseholdMeasure"("foodProductId");

ALTER TABLE "HouseholdMeasure" ADD CONSTRAINT "HouseholdMeasure_foodProductId_fkey"
    FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RECIPES (recreated with full professional model)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "cuisineType" TEXT,
    "mealType" "RecipeMealType" NOT NULL DEFAULT 'LUNCH',
    "difficulty" "RecipeDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "prepTimeMinutes" INTEGER,
    "cookTimeMinutes" INTEGER,
    "totalTimeMinutes" INTEGER,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "servingWeightG" DECIMAL(7,2),
    "yieldWeightG" DECIMAL(8,2),
    "yieldFactor" DECIMAL(4,3),
    "tips" TEXT,
    "notesDietitian" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "tags" TEXT[],
    "languageCode" TEXT NOT NULL DEFAULT 'pl',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");
CREATE UNIQUE INDEX "Recipe_source_sourceId_key" ON "Recipe"("source", "sourceId");
CREATE INDEX "Recipe_slug_idx" ON "Recipe"("slug");
CREATE INDEX "Recipe_title_idx" ON "Recipe"("title");
CREATE INDEX "Recipe_category_idx" ON "Recipe"("category");
CREATE INDEX "Recipe_mealType_idx" ON "Recipe"("mealType");
CREATE INDEX "Recipe_isActive_idx" ON "Recipe"("isActive");
CREATE INDEX "Recipe_qualityScore_idx" ON "Recipe"("qualityScore");

-- Re-add Meal -> Recipe FK (Meal.recipeId is nullable, orphaned values will be set to null)
UPDATE "Meal" SET "recipeId" = NULL WHERE "recipeId" IS NOT NULL;
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RECIPE INGREDIENTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "foodProductId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(8,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "grams" DECIMAL(7,2) NOT NULL,
    "displayName" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "groupName" TEXT,
    "notes" TEXT,
    "retentionFactor" DECIMAL(4,3),
    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");
CREATE INDEX "RecipeIngredient_foodProductId_idx" ON "RecipeIngredient"("foodProductId");

ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_foodProductId_fkey"
    FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RECIPE INSTRUCTION STEPS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "RecipeInstructionStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "imageUrl" TEXT,
    CONSTRAINT "RecipeInstructionStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeInstructionStep_recipeId_stepNumber_key" ON "RecipeInstructionStep"("recipeId", "stepNumber");
CREATE INDEX "RecipeInstructionStep_recipeId_idx" ON "RecipeInstructionStep"("recipeId");

ALTER TABLE "RecipeInstructionStep" ADD CONSTRAINT "RecipeInstructionStep_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RECIPE NUTRITION SNAPSHOT
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "RecipeNutritionSnapshot" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Per serving
    "kcal" DECIMAL(8,2) NOT NULL,
    "protein_g" DECIMAL(7,3) NOT NULL,
    "fat_g" DECIMAL(7,3) NOT NULL,
    "saturatedFat_g" DECIMAL(7,3),
    "carbs_g" DECIMAL(7,3) NOT NULL,
    "sugars_g" DECIMAL(7,3),
    "fiber_g" DECIMAL(7,3),
    "salt_g" DECIMAL(7,3),
    "sodium_mg" DECIMAL(8,3),
    "potassium_mg" DECIMAL(8,3),
    "calcium_mg" DECIMAL(8,3),
    "magnesium_mg" DECIMAL(8,3),
    "iron_mg" DECIMAL(7,3),
    "zinc_mg" DECIMAL(7,3),
    "vitaminA_ug" DECIMAL(8,3),
    "vitaminC_mg" DECIMAL(7,3),
    "vitaminD_ug" DECIMAL(7,3),
    "vitaminE_mg" DECIMAL(7,3),
    "vitaminB12_ug" DECIMAL(7,4),
    "folate_ug" DECIMAL(7,3),
    "cholesterol_mg" DECIMAL(7,3),
    -- Totals
    "totalKcal" DECIMAL(9,2) NOT NULL,
    "totalProtein_g" DECIMAL(8,3) NOT NULL,
    "totalFat_g" DECIMAL(8,3) NOT NULL,
    "totalCarbs_g" DECIMAL(8,3) NOT NULL,
    CONSTRAINT "RecipeNutritionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeNutritionSnapshot_recipeId_key" ON "RecipeNutritionSnapshot"("recipeId");

ALTER TABLE "RecipeNutritionSnapshot" ADD CONSTRAINT "RecipeNutritionSnapshot_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RECIPE ALLERGENS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "RecipeAllergen" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "allergenCode" TEXT NOT NULL,
    "presence" "AllergenPresence" NOT NULL DEFAULT 'UNKNOWN',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeAllergen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeAllergen_recipeId_allergenCode_key" ON "RecipeAllergen"("recipeId", "allergenCode");
CREATE INDEX "RecipeAllergen_recipeId_idx" ON "RecipeAllergen"("recipeId");

ALTER TABLE "RecipeAllergen" ADD CONSTRAINT "RecipeAllergen_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RECIPE DIET FLAGS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "RecipeDietFlag" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "flagCode" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT true,
    "source" "DietFlagSource" NOT NULL DEFAULT 'AUTO_RULE',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeDietFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeDietFlag_recipeId_flagCode_key" ON "RecipeDietFlag"("recipeId", "flagCode");
CREATE INDEX "RecipeDietFlag_recipeId_idx" ON "RecipeDietFlag"("recipeId");
CREATE INDEX "RecipeDietFlag_flagCode_idx" ON "RecipeDietFlag"("flagCode");

ALTER TABLE "RecipeDietFlag" ADD CONSTRAINT "RecipeDietFlag_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- INGREDIENT SUBSTITUTION RULES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "IngredientSubstitutionRule" (
    "id" TEXT NOT NULL,
    "fromProductId" TEXT NOT NULL,
    "toProductId" TEXT NOT NULL,
    "conversionFactor" DECIMAL(5,3) NOT NULL,
    "notes" TEXT,
    "dietContext" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "IngredientSubstitutionRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IngredientSubstitutionRule_fromProductId_toProductId_dietCont_key" ON "IngredientSubstitutionRule"("fromProductId", "toProductId", "dietContext");
CREATE INDEX "IngredientSubstitutionRule_fromProductId_idx" ON "IngredientSubstitutionRule"("fromProductId");
CREATE INDEX "IngredientSubstitutionRule_toProductId_idx" ON "IngredientSubstitutionRule"("toProductId");

ALTER TABLE "IngredientSubstitutionRule" ADD CONSTRAINT "IngredientSubstitutionRule_fromProductId_fkey"
    FOREIGN KEY ("fromProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IngredientSubstitutionRule" ADD CONSTRAINT "IngredientSubstitutionRule_toProductId_fkey"
    FOREIGN KEY ("toProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- IMPORT JOBS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "errorLog" JSONB,
    "summary" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportJob_source_idx" ON "ImportJob"("source");
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- ═══════════════════════════════════════════════════════════════════════════════
-- DATA QUALITY ISSUES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT,
    "severity" "DataQualitySeverity" NOT NULL DEFAULT 'WARNING',
    "issueCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedFix" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "importJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DataQualityIssue_entityType_entityId_idx" ON "DataQualityIssue"("entityType", "entityId");
CREATE INDEX "DataQualityIssue_severity_idx" ON "DataQualityIssue"("severity");
CREATE INDEX "DataQualityIssue_isResolved_idx" ON "DataQualityIssue"("isResolved");
CREATE INDEX "DataQualityIssue_issueCode_idx" ON "DataQualityIssue"("issueCode");
CREATE INDEX "DataQualityIssue_importJobId_idx" ON "DataQualityIssue"("importJobId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- MANUAL REVIEW QUEUE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "ManualReviewQueue" (
    "id" TEXT NOT NULL,
    "itemType" "ReviewItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "status" "ReviewItemStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "assignedTo" TEXT,
    "reviewNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManualReviewQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualReviewQueue_itemType_status_idx" ON "ManualReviewQueue"("itemType", "status");
CREATE INDEX "ManualReviewQueue_status_idx" ON "ManualReviewQueue"("status");
CREATE INDEX "ManualReviewQueue_priority_idx" ON "ManualReviewQueue"("priority");
CREATE INDEX "ManualReviewQueue_assignedTo_idx" ON "ManualReviewQueue"("assignedTo");
