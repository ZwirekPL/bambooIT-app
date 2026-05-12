-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DIETITIAN', 'PATIENT');

-- CreateEnum
CREATE TYPE "DietPlanSource" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "DietPlanStatus" AS ENUM ('AI_DRAFT', 'GENERATED', 'REVIEWED', 'SENT', 'PUBLISHED', 'MANUAL_REVIEW_REQUIRED', 'GENERATION_FAILED');

-- CreateEnum
CREATE TYPE "DayRegenReason" AS ENUM ('DONT_LIKE', 'TOO_COMPLEX', 'NO_INGREDIENTS');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('FREE_7', 'OPIEKA_MIESIECZNA', 'OPIEKA_ROCZNA', 'PLAN_2W', 'PLAN_4W', 'CONSULTATION', 'PREMIUM', 'CONSULTATION_1W', 'AI_2W', 'AI_4W', 'SUBSCRIPTION_1M', 'CONSULTATION_2W', 'CONSULTATION_4W');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO_MONTHLY', 'PRO_YEARLY');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('VALID', 'NEEDS_ADJUST', 'NEEDS_REPAIR_AI');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'SUPPER');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('STANDARD', 'VEGE', 'VEGAN', 'GLUTEN_FREE', 'LACTOSE_FREE');

-- CreateEnum
CREATE TYPE "FoodState" AS ENUM ('RAW', 'COOKED', 'BAKED', 'FRIED', 'GRILLED', 'STEAMED', 'DRIED', 'FROZEN', 'CANNED', 'SMOKED', 'FERMENTED', 'PICKLED', 'PROCESSED', 'RECONSTITUTED');

-- CreateEnum
CREATE TYPE "FodmapLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PriceCategory" AS ENUM ('BUDGET', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ProcessingLevel" AS ENUM ('UNPROCESSED', 'MINIMALLY_PROCESSED', 'PROCESSED_INGREDIENT', 'PROCESSED', 'ULTRA_PROCESSED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'AUTO_VERIFIED', 'MANUALLY_VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AllergenPresence" AS ENUM ('CONTAINS', 'MAY_CONTAIN', 'FREE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DietFlagSource" AS ENUM ('AUTO_RULE', 'MANUAL', 'HEURISTIC', 'SOURCE_DATA');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DataQualitySeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReviewItemType" AS ENUM ('FOOD_PRODUCT', 'RECIPE');

-- CreateEnum
CREATE TYPE "ReviewItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "RecipeMealType" AS ENUM ('BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'DINNER', 'SUPPER', 'SNACK', 'DESSERT', 'DRINK', 'SAUCE', 'SIDE_DISH');

-- CreateEnum
CREATE TYPE "DishCompleteness" AS ENUM ('COMPLETE_MEAL', 'MAIN_DISH', 'CARB_SIDE', 'VEG_SIDE', 'COMPONENT');

-- CreateEnum
CREATE TYPE "ServingType" AS ENUM ('PER_PORTION', 'PER_PIECE', 'PER_100G');

-- CreateEnum
CREATE TYPE "ProtocolScope" AS ENUM ('GLOBAL', 'DIETITIAN');

-- CreateEnum
CREATE TYPE "FoodRestrictionLevel" AS ENUM ('HARD_BLOCK', 'STRONG', 'SOFT');

-- CreateEnum
CREATE TYPE "RecipeComplexity" AS ENUM ('SIMPLE', 'MODERATE', 'COMPLEX');

-- CreateEnum
CREATE TYPE "BmrFormula" AS ENUM ('MIFFLIN', 'HARRIS_BENEDICT');

-- CreateEnum
CREATE TYPE "DietPlanRevisionReason" AS ENUM ('AI_GENERATED', 'AUTO_ADJUST', 'DIETITIAN_EDIT', 'PUBLISHED', 'CHECKIN_ADJUSTMENT', 'SLOT_REPAIR');

-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClinicalRuleType" AS ENUM ('POLICY', 'RED_FLAG');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MODERATE', 'LOW');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('HEALTH_DATA_PROCESSING', 'AI_DISCLAIMER', 'EMAIL_NOTIFICATIONS', 'TERMS_ACCEPTANCE', 'PRIVACY_POLICY', 'COOKIE_FUNCTIONAL', 'COOKIE_ANALYTICS', 'COOKIE_MARKETING');

-- CreateEnum
CREATE TYPE "CleanProductType" AS ENUM ('BASE', 'RETAIL', 'MANUAL');

-- CreateEnum
CREATE TYPE "CleanProductSource" AS ENUM ('ILEWAZY', 'USDA', 'OPENFOODFACTS', 'MANUAL');

-- CreateEnum
CREATE TYPE "CleanVerificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "DayRegenStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "ownerId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietitianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "scoringWeightsOverride" JSONB,
    "greyListWindow" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DietitianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "emailVerified" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "grantedAccessUntil" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "dietitianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "sex" TEXT,
    "birthYear" INTEGER,
    "birthDate" TIMESTAMP(3),
    "heightCm" INTEGER,
    "weightKg" DECIMAL(6,2),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "tenantId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answers" JSONB NOT NULL,
    "medicalFlags" JSONB,
    "profileSnapshot" JSONB,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientRepairLog" (
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

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "tenantId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "DietPlanSource" NOT NULL DEFAULT 'AI',
    "status" "DietPlanStatus" NOT NULL DEFAULT 'GENERATED',
    "kcal" INTEGER,
    "proteinG" INTEGER,
    "fatG" INTEGER,
    "carbsG" INTEGER,
    "content" JSONB NOT NULL,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "rawResponse" JSONB,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "validationStatus" "ValidationStatus",
    "validationErrors" JSONB,
    "policyMetadata" JSONB,
    "templateId" TEXT,
    "repairCount" INTEGER NOT NULL DEFAULT 0,
    "dayRegenLimit" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "DietPlan_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "consultationPhone" VARCHAR(20),
    "stripeInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabPanel" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "LabPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "excerpt" TEXT NOT NULL,
    "excerptEn" TEXT,
    "content" TEXT NOT NULL,
    "contentEn" TEXT,
    "category" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "imageSrc" TEXT,
    "imageAlt" TEXT,
    "imageAltEn" TEXT,
    "readTime" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "faq" JSONB,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogCategoryConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogCategoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "FoodProductNutrients" (
    "id" TEXT NOT NULL,
    "foodProductId" TEXT NOT NULL,
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
    "vitaminA_ug" DECIMAL(8,3),
    "betaCarotene_ug" DECIMAL(8,3),
    "vitaminD_ug" DECIMAL(7,3),
    "vitaminE_mg" DECIMAL(7,3),
    "vitaminK_ug" DECIMAL(7,3),
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
    "cholesterol_mg" DECIMAL(7,3),
    "water_g" DECIMAL(7,3),
    "alcohol_g" DECIMAL(7,3),
    "caffeine_mg" DECIMAL(7,3),
    "ash_g" DECIMAL(7,3),
    "tryptophan_g" DECIMAL(6,4),
    "threonine_g" DECIMAL(6,4),
    "isoleucine_g" DECIMAL(6,4),
    "leucine_g" DECIMAL(6,4),
    "lysine_g" DECIMAL(6,4),
    "methionine_g" DECIMAL(6,4),
    "phenylalanine_g" DECIMAL(6,4),
    "valine_g" DECIMAL(6,4),
    "histidine_g" DECIMAL(6,4),
    "omega3_g" DECIMAL(7,4),
    "omega6_g" DECIMAL(7,4),
    "epa_g" DECIMAL(6,4),
    "dha_g" DECIMAL(6,4),
    "ala_g" DECIMAL(6,4),
    "purines_mg" DECIMAL(7,3),
    "oxalate_mg" DECIMAL(7,3),

    CONSTRAINT "FoodProductNutrients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "FoodProductAlias" (
    "id" TEXT NOT NULL,
    "foodProductId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'pl',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FoodProductAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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
    "sourceUrl" TEXT,
    "estimatedCost" "PriceCategory" NOT NULL DEFAULT 'STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "mealPrepFriendly" BOOLEAN NOT NULL DEFAULT false,
    "cookingMethod" TEXT,
    "seasons" INTEGER[],
    "tags" TEXT[],
    "languageCode" TEXT NOT NULL DEFAULT 'pl',
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "aiApproved" BOOLEAN NOT NULL DEFAULT false,
    "dishCompleteness" "DishCompleteness",
    "containsVegetableServing" BOOLEAN NOT NULL DEFAULT false,
    "vegetableWeightG" INTEGER,
    "servingType" "ServingType" NOT NULL DEFAULT 'PER_PORTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "foodProductId" TEXT,
    "cleanProductId" TEXT,
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

-- CreateTable
CREATE TABLE "RecipeInstructionStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "phase" TEXT NOT NULL DEFAULT 'prep',
    "imageUrl" TEXT,

    CONSTRAINT "RecipeInstructionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeNutritionSnapshot" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kcal" DECIMAL(8,2) NOT NULL,
    "protein_g" DECIMAL(7,3) NOT NULL,
    "fat_g" DECIMAL(7,3) NOT NULL,
    "saturatedFat_g" DECIMAL(7,3),
    "carbs_g" DECIMAL(7,3) NOT NULL,
    "sugars_g" DECIMAL(7,3),
    "fiber_g" DECIMAL(7,3),
    "salt_g" DECIMAL(7,3),
    "monounsaturatedFat_g" DECIMAL(7,3),
    "polyunsaturatedFat_g" DECIMAL(7,3),
    "transFat_g" DECIMAL(7,3),
    "omega3_g" DECIMAL(7,4),
    "omega6_g" DECIMAL(7,4),
    "epa_g" DECIMAL(6,4),
    "dha_g" DECIMAL(6,4),
    "ala_g" DECIMAL(6,4),
    "starch_g" DECIMAL(7,3),
    "addedSugars_g" DECIMAL(7,3),
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
    "fluoride_ug" DECIMAL(7,3),
    "chloride_mg" DECIMAL(8,3),
    "vitaminA_ug" DECIMAL(8,3),
    "vitaminD_ug" DECIMAL(7,3),
    "vitaminE_mg" DECIMAL(7,3),
    "vitaminK_ug" DECIMAL(7,3),
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
    "cholesterol_mg" DECIMAL(7,3),
    "totalKcal" DECIMAL(9,2) NOT NULL,
    "totalProtein_g" DECIMAL(8,3) NOT NULL,
    "totalFat_g" DECIMAL(8,3) NOT NULL,
    "totalCarbs_g" DECIMAL(8,3) NOT NULL,

    CONSTRAINT "RecipeNutritionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeAllergen" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "allergenCode" TEXT NOT NULL,
    "presence" "AllergenPresence" NOT NULL DEFAULT 'UNKNOWN',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeAllergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "RecipeRating" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'inline',
    "dietPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingListCheck" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "itemName" VARCHAR(300) NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingListCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteMeal" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recipeName" VARCHAR(300) NOT NULL,
    "recipeId" TEXT,
    "dietPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionTargets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrequentInput" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrequentInput_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "DietPlanRevision" (
    "id" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "createdBy" TEXT,
    "reason" "DietPlanRevisionReason" NOT NULL,
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DietPlanRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DECIMAL(6,2),
    "compliance" INTEGER,
    "hunger" INTEGER,
    "energy" INTEGER,
    "sleep" INTEGER,
    "activity" INTEGER,
    "mood" SMALLINT,
    "waistCm" DECIMAL(5,1),
    "hipsCm" DECIMAL(5,1),
    "thighCm" DECIMAL(5,1),
    "chestCm" DECIMAL(5,1),
    "notes" TEXT,
    "digestion" SMALLINT,
    "bloating" BOOLEAN,
    "stoolBristol" SMALLINT,
    "supplementsTaken" JSONB,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementPrescription" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dietitianId" TEXT,
    "nutrientKey" VARCHAR(50) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "dose" VARCHAR(50) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "frequency" VARCHAR(50) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dietPlanId" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "source" TEXT,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "n8nTriggered" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "validationStatus" TEXT,
    "autoAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "policyRulesCount" INTEGER NOT NULL DEFAULT 0,
    "redFlagsCount" INTEGER NOT NULL DEFAULT 0,
    "redFlagSeverity" TEXT,
    "stepTimings" JSONB,
    "error" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(10,6),

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "conditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "status" "TestimonialStatus" NOT NULL DEFAULT 'PENDING',
    "adminReply" TEXT,
    "adminReplyAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailReminders" BOOLEAN NOT NULL DEFAULT false,
    "breakfastTime" TEXT,
    "lunchTime" TEXT,
    "dinnerTime" TEXT,
    "snackTime" TEXT,
    "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 30,
    "weeklySummary" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Warsaw',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietitianNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dietitianId" TEXT NOT NULL,
    "dietPlanId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DietitianNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTemplate" (
    "id" TEXT NOT NULL,
    "dietitianId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "category" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralUsage" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ClinicalRuleType" NOT NULL,
    "severity" "RuleSeverity" NOT NULL DEFAULT 'LOW',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "conditions" JSONB NOT NULL,
    "effects" JSONB NOT NULL,
    "source" VARCHAR(200),
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "sources" JSONB,
    "conflictsWith" TEXT[],
    "category" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalRuleHistory" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "changedBy" TEXT,
    "changeSummary" TEXT NOT NULL,
    "previousData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalRuleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "documentVersion" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(45),

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "slug" TEXT NOT NULL,
    "type" "CleanProductType" NOT NULL,
    "brand" TEXT,
    "barcode" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "sourcePrimary" "CleanProductSource" NOT NULL,
    "sourceSecondary" "CleanProductSource",
    "sourceUrl" TEXT,
    "sourceId" TEXT,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" "CleanVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "hasMicronutrients" BOOLEAN NOT NULL DEFAULT false,
    "glycemicIndex" INTEGER,
    "glycemicLoadPer100g" DECIMAL(6,2),
    "fodmapLevel" "FodmapLevel",
    "priceCategory" "PriceCategory" NOT NULL DEFAULT 'STANDARD',
    "estimatedPricePer100g" DECIMAL(6,2),
    "packageWeightG" INTEGER,
    "servingWeightG" INTEGER,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleanProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanProductNutrients" (
    "id" TEXT NOT NULL,
    "cleanProductId" TEXT NOT NULL,
    "kcalPer100g" DECIMAL(8,2) NOT NULL,
    "proteinPer100g" DECIMAL(7,3) NOT NULL,
    "fatPer100g" DECIMAL(7,3) NOT NULL,
    "carbsPer100g" DECIMAL(7,3) NOT NULL,
    "fiberPer100g" DECIMAL(7,3),
    "sugarsPer100g" DECIMAL(7,3),
    "saltPer100g" DECIMAL(7,3),
    "saturatedFatPer100g" DECIMAL(7,3),
    "monounsaturatedFatPer100g" DECIMAL(7,3),
    "polyunsaturatedFatPer100g" DECIMAL(7,3),
    "transFatPer100g" DECIMAL(7,3),
    "omega3Per100g" DECIMAL(7,4),
    "omega6Per100g" DECIMAL(7,4),
    "epaPer100g" DECIMAL(6,4),
    "dhaPer100g" DECIMAL(6,4),
    "alaPer100g" DECIMAL(6,4),
    "starchPer100g" DECIMAL(7,3),
    "addedSugarsPer100g" DECIMAL(7,3),
    "sodiumMg" DECIMAL(8,3),
    "potassiumMg" DECIMAL(8,3),
    "calciumMg" DECIMAL(8,3),
    "magnesiumMg" DECIMAL(8,3),
    "phosphorusMg" DECIMAL(8,3),
    "ironMg" DECIMAL(7,3),
    "zincMg" DECIMAL(7,3),
    "copperMg" DECIMAL(7,4),
    "manganeseMg" DECIMAL(7,4),
    "iodineUg" DECIMAL(7,3),
    "seleniumUg" DECIMAL(7,3),
    "chromiumUg" DECIMAL(7,3),
    "molybdenumUg" DECIMAL(7,3),
    "fluorideUg" DECIMAL(7,3),
    "chlorideMg" DECIMAL(8,3),
    "vitaminAUg" DECIMAL(8,3),
    "vitaminDUg" DECIMAL(7,3),
    "vitaminEMg" DECIMAL(7,3),
    "vitaminKUg" DECIMAL(7,3),
    "vitaminCMg" DECIMAL(7,3),
    "vitaminB1Mg" DECIMAL(7,4),
    "vitaminB2Mg" DECIMAL(7,4),
    "vitaminB3Mg" DECIMAL(7,3),
    "vitaminB5Mg" DECIMAL(7,3),
    "vitaminB6Mg" DECIMAL(7,4),
    "folateUg" DECIMAL(7,3),
    "vitaminB12Ug" DECIMAL(7,4),
    "biotinUg" DECIMAL(7,3),
    "cholineMg" DECIMAL(7,3),
    "cholesterolMg" DECIMAL(7,3),

    CONSTRAINT "CleanProductNutrients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanProductPortion" (
    "id" TEXT NOT NULL,
    "cleanProductId" TEXT NOT NULL,
    "portionName" TEXT NOT NULL,
    "weightG" DECIMAL(7,2) NOT NULL,
    "source" "CleanProductSource" NOT NULL,

    CONSTRAINT "CleanProductPortion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanProductAllergen" (
    "id" TEXT NOT NULL,
    "cleanProductId" TEXT NOT NULL,
    "allergenCode" TEXT NOT NULL,
    "presence" "AllergenPresence" NOT NULL DEFAULT 'UNKNOWN',
    "source" "DietFlagSource" NOT NULL DEFAULT 'AUTO_RULE',
    "confidence" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "CleanProductAllergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanProductDietFlag" (
    "id" TEXT NOT NULL,
    "cleanProductId" TEXT NOT NULL,
    "flagCode" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT true,
    "source" "DietFlagSource" NOT NULL DEFAULT 'AUTO_RULE',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleanProductDietFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanProductAminoAcids" (
    "id" TEXT NOT NULL,
    "cleanProductId" TEXT NOT NULL,
    "tryptophanPer100g" DECIMAL(6,4),
    "threoninePer100g" DECIMAL(6,4),
    "isoleucinePer100g" DECIMAL(6,4),
    "leucinePer100g" DECIMAL(6,4),
    "lysinePer100g" DECIMAL(6,4),
    "methioninePer100g" DECIMAL(6,4),
    "phenylalaninePer100g" DECIMAL(6,4),
    "valinePer100g" DECIMAL(6,4),
    "histidinePer100g" DECIMAL(6,4),

    CONSTRAINT "CleanProductAminoAcids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanProductBioactives" (
    "id" TEXT NOT NULL,
    "cleanProductId" TEXT NOT NULL,
    "purinesMg" DECIMAL(7,3),
    "oxalateMg" DECIMAL(7,3),
    "caffeineMg" DECIMAL(7,3),
    "polyphenolsMg" DECIMAL(7,3),
    "betaCaroteneUg" DECIMAL(8,3),
    "lycopeneUg" DECIMAL(8,3),
    "luteinZeaxanthinUg" DECIMAL(8,3),

    CONSTRAINT "CleanProductBioactives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionProtocol" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "scope" "ProtocolScope" NOT NULL DEFAULT 'GLOBAL',
    "dietitianId" TEXT,
    "macroRatios" JSONB NOT NULL,
    "bmrFormula" "BmrFormula" NOT NULL DEFAULT 'MIFFLIN',
    "caloricAdjustments" JSONB NOT NULL,
    "minProteinPerKg" DECIMAL(4,2) NOT NULL DEFAULT 0.8,
    "maxProteinPerKg" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "defaultMealCount" INTEGER NOT NULL DEFAULT 5,
    "mealDistribution" JSONB NOT NULL,
    "foodRestrictions" JSONB NOT NULL DEFAULT '[]',
    "systemPromptAdditions" TEXT,
    "preferredCuisines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recipeComplexity" "RecipeComplexity" NOT NULL DEFAULT 'MODERATE',
    "avoidFoodCategories" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietitianProtocolAccess" (
    "id" TEXT NOT NULL,
    "dietitianId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "DietitianProtocolAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProtocolTrigger" (
    "id" TEXT NOT NULL,
    "interviewField" TEXT NOT NULL,
    "interviewValue" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolConflict" (
    "id" TEXT NOT NULL,
    "triggerAField" TEXT NOT NULL,
    "triggerAValue" TEXT NOT NULL,
    "triggerBField" TEXT NOT NULL,
    "triggerBValue" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "messageKey" TEXT NOT NULL,
    "description" TEXT,
    "winnerSide" TEXT NOT NULL DEFAULT 'B',
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCostLog" (
    "id" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
    "jobType" TEXT NOT NULL,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCostLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialFingerprint" (
    "id" TEXT NOT NULL,
    "cardFingerprint" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceFingerprint" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityBan" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayRegeneration" (
    "id" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "dayName" TEXT NOT NULL,
    "reason" "DayRegenReason" NOT NULL,
    "keepSimilar" BOOLEAN NOT NULL DEFAULT false,
    "originalDay" JSONB NOT NULL,
    "newDay" JSONB,
    "status" "DayRegenStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayRegeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waistCm" DECIMAL(5,1),
    "hipCm" DECIMAL(5,1),
    "chestCm" DECIMAL(5,1),
    "thighCm" DECIMAL(5,1),
    "armCm" DECIMAL(5,1),
    "bodyFatPct" DECIMAL(4,1),
    "notes" TEXT,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dietitianId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "unreadCountPatient" INTEGER NOT NULL DEFAULT 0,
    "unreadCountDietitian" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectVariantB" TEXT,
    "bodyTemplate" TEXT,
    "schedule" TEXT,
    "segmentation" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "variantASent" INTEGER NOT NULL DEFAULT 0,
    "variantAOpened" INTEGER NOT NULL DEFAULT 0,
    "variantBSent" INTEGER NOT NULL DEFAULT 0,
    "variantBOpened" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'A',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "personalData" JSONB,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_ownerId_key" ON "Tenant"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "DietitianProfile_userId_key" ON "DietitianProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DietitianProfile_code_key" ON "DietitianProfile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE INDEX "Patient_tenantId_idx" ON "Patient"("tenantId");

-- CreateIndex
CREATE INDEX "Patient_dietitianId_idx" ON "Patient"("dietitianId");

-- CreateIndex
CREATE INDEX "Interview_patientId_idx" ON "Interview"("patientId");

-- CreateIndex
CREATE INDEX "Interview_tenantId_idx" ON "Interview"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "IngredientRepairLog_batchId_idx" ON "IngredientRepairLog"("batchId");

-- CreateIndex
CREATE INDEX "IngredientRepairLog_recipeId_idx" ON "IngredientRepairLog"("recipeId");

-- CreateIndex
CREATE INDEX "IngredientRepairLog_createdAt_idx" ON "IngredientRepairLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "DietPlan_patientId_idx" ON "DietPlan"("patientId");

-- CreateIndex
CREATE INDEX "DietPlan_tenantId_idx" ON "DietPlan"("tenantId");

-- CreateIndex
CREATE INDEX "DietPlan_templateId_idx" ON "DietPlan"("templateId");

-- CreateIndex
CREATE INDEX "MealSwap_dietPlanId_idx" ON "MealSwap"("dietPlanId");

-- CreateIndex
CREATE INDEX "MealSwap_dietPlanId_createdAt_idx" ON "MealSwap"("dietPlanId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_patientId_idx" ON "Order"("patientId");

-- CreateIndex
CREATE INDEX "LabPanel_patientId_idx" ON "LabPanel"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_slug_idx" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_category_idx" ON "Post"("category");

-- CreateIndex
CREATE INDEX "Post_published_idx" ON "Post"("published");

-- CreateIndex
CREATE INDEX "Post_scheduledAt_idx" ON "Post"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlogCategoryConfig_slug_key" ON "BlogCategoryConfig"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FoodCategory_slug_key" ON "FoodCategory"("slug");

-- CreateIndex
CREATE INDEX "FoodCategory_parentId_idx" ON "FoodCategory"("parentId");

-- CreateIndex
CREATE INDEX "FoodCategory_slug_idx" ON "FoodCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FoodProduct_slug_key" ON "FoodProduct"("slug");

-- CreateIndex
CREATE INDEX "FoodProduct_name_idx" ON "FoodProduct"("name");

-- CreateIndex
CREATE INDEX "FoodProduct_slug_idx" ON "FoodProduct"("slug");

-- CreateIndex
CREATE INDEX "FoodProduct_categoryId_idx" ON "FoodProduct"("categoryId");

-- CreateIndex
CREATE INDEX "FoodProduct_brandId_idx" ON "FoodProduct"("brandId");

-- CreateIndex
CREATE INDEX "FoodProduct_languageCode_idx" ON "FoodProduct"("languageCode");

-- CreateIndex
CREATE INDEX "FoodProduct_isActive_idx" ON "FoodProduct"("isActive");

-- CreateIndex
CREATE INDEX "FoodProduct_verificationStatus_idx" ON "FoodProduct"("verificationStatus");

-- CreateIndex
CREATE INDEX "FoodProduct_qualityScore_idx" ON "FoodProduct"("qualityScore");

-- CreateIndex
CREATE UNIQUE INDEX "FoodProduct_source_sourceId_key" ON "FoodProduct"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodBrand_slug_key" ON "FoodBrand"("slug");

-- CreateIndex
CREATE INDEX "FoodBrand_slug_idx" ON "FoodBrand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FoodProductNutrients_foodProductId_key" ON "FoodProductNutrients"("foodProductId");

-- CreateIndex
CREATE INDEX "FoodProductAllergen_foodProductId_idx" ON "FoodProductAllergen"("foodProductId");

-- CreateIndex
CREATE INDEX "FoodProductAllergen_allergenCode_idx" ON "FoodProductAllergen"("allergenCode");

-- CreateIndex
CREATE UNIQUE INDEX "FoodProductAllergen_foodProductId_allergenCode_key" ON "FoodProductAllergen"("foodProductId", "allergenCode");

-- CreateIndex
CREATE INDEX "FoodProductDietFlag_foodProductId_idx" ON "FoodProductDietFlag"("foodProductId");

-- CreateIndex
CREATE INDEX "FoodProductDietFlag_flagCode_idx" ON "FoodProductDietFlag"("flagCode");

-- CreateIndex
CREATE INDEX "FoodProductDietFlag_value_idx" ON "FoodProductDietFlag"("value");

-- CreateIndex
CREATE UNIQUE INDEX "FoodProductDietFlag_foodProductId_flagCode_key" ON "FoodProductDietFlag"("foodProductId", "flagCode");

-- CreateIndex
CREATE INDEX "FoodProductAlias_foodProductId_idx" ON "FoodProductAlias"("foodProductId");

-- CreateIndex
CREATE INDEX "FoodProductAlias_alias_idx" ON "FoodProductAlias"("alias");

-- CreateIndex
CREATE INDEX "FoodProductAlias_languageCode_idx" ON "FoodProductAlias"("languageCode");

-- CreateIndex
CREATE INDEX "FoodProductSourceMeta_foodProductId_idx" ON "FoodProductSourceMeta"("foodProductId");

-- CreateIndex
CREATE INDEX "FoodProductSourceMeta_source_sourceId_idx" ON "FoodProductSourceMeta"("source", "sourceId");

-- CreateIndex
CREATE INDEX "HouseholdMeasure_foodProductId_idx" ON "HouseholdMeasure"("foodProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "Recipe_slug_idx" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "Recipe_title_idx" ON "Recipe"("title");

-- CreateIndex
CREATE INDEX "Recipe_category_idx" ON "Recipe"("category");

-- CreateIndex
CREATE INDEX "Recipe_mealType_idx" ON "Recipe"("mealType");

-- CreateIndex
CREATE INDEX "Recipe_isActive_idx" ON "Recipe"("isActive");

-- CreateIndex
CREATE INDEX "Recipe_qualityScore_idx" ON "Recipe"("qualityScore");

-- CreateIndex
CREATE INDEX "Recipe_averageRating_idx" ON "Recipe"("averageRating");

-- CreateIndex
CREATE INDEX "Recipe_dishCompleteness_idx" ON "Recipe"("dishCompleteness");

-- CreateIndex
CREATE INDEX "Recipe_servingType_idx" ON "Recipe"("servingType");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_source_sourceId_key" ON "Recipe"("source", "sourceId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_foodProductId_idx" ON "RecipeIngredient"("foodProductId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_cleanProductId_idx" ON "RecipeIngredient"("cleanProductId");

-- CreateIndex
CREATE INDEX "RecipeInstructionStep_recipeId_idx" ON "RecipeInstructionStep"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeInstructionStep_recipeId_stepNumber_key" ON "RecipeInstructionStep"("recipeId", "stepNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeNutritionSnapshot_recipeId_key" ON "RecipeNutritionSnapshot"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeAllergen_recipeId_idx" ON "RecipeAllergen"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeAllergen_recipeId_allergenCode_key" ON "RecipeAllergen"("recipeId", "allergenCode");

-- CreateIndex
CREATE INDEX "RecipeDietFlag_recipeId_idx" ON "RecipeDietFlag"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeDietFlag_flagCode_idx" ON "RecipeDietFlag"("flagCode");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeDietFlag_recipeId_flagCode_key" ON "RecipeDietFlag"("recipeId", "flagCode");

-- CreateIndex
CREATE INDEX "RecipeRating_recipeId_idx" ON "RecipeRating"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeRating_patientId_idx" ON "RecipeRating"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeRating_recipeId_patientId_key" ON "RecipeRating"("recipeId", "patientId");

-- CreateIndex
CREATE INDEX "ShoppingListCheck_patientId_dietPlanId_idx" ON "ShoppingListCheck"("patientId", "dietPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingListCheck_patientId_dietPlanId_itemName_key" ON "ShoppingListCheck"("patientId", "dietPlanId", "itemName");

-- CreateIndex
CREATE INDEX "FavoriteMeal_patientId_idx" ON "FavoriteMeal"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteMeal_patientId_recipeName_key" ON "FavoriteMeal"("patientId", "recipeName");

-- CreateIndex
CREATE INDEX "IngredientSubstitutionRule_fromProductId_idx" ON "IngredientSubstitutionRule"("fromProductId");

-- CreateIndex
CREATE INDEX "IngredientSubstitutionRule_toProductId_idx" ON "IngredientSubstitutionRule"("toProductId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientSubstitutionRule_fromProductId_toProductId_dietCo_key" ON "IngredientSubstitutionRule"("fromProductId", "toProductId", "dietContext");

-- CreateIndex
CREATE INDEX "ImportJob_source_idx" ON "ImportJob"("source");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "DataQualityIssue_entityType_entityId_idx" ON "DataQualityIssue"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataQualityIssue_severity_idx" ON "DataQualityIssue"("severity");

-- CreateIndex
CREATE INDEX "DataQualityIssue_isResolved_idx" ON "DataQualityIssue"("isResolved");

-- CreateIndex
CREATE INDEX "DataQualityIssue_issueCode_idx" ON "DataQualityIssue"("issueCode");

-- CreateIndex
CREATE INDEX "DataQualityIssue_importJobId_idx" ON "DataQualityIssue"("importJobId");

-- CreateIndex
CREATE INDEX "ManualReviewQueue_itemType_status_idx" ON "ManualReviewQueue"("itemType", "status");

-- CreateIndex
CREATE INDEX "ManualReviewQueue_status_idx" ON "ManualReviewQueue"("status");

-- CreateIndex
CREATE INDEX "ManualReviewQueue_priority_idx" ON "ManualReviewQueue"("priority");

-- CreateIndex
CREATE INDEX "ManualReviewQueue_assignedTo_idx" ON "ManualReviewQueue"("assignedTo");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionTargets_patientId_key" ON "NutritionTargets"("patientId");

-- CreateIndex
CREATE INDEX "FrequentInput_field_count_idx" ON "FrequentInput"("field", "count");

-- CreateIndex
CREATE UNIQUE INDEX "FrequentInput_field_value_key" ON "FrequentInput"("field", "value");

-- CreateIndex
CREATE INDEX "Meal_mealType_idx" ON "Meal"("mealType");

-- CreateIndex
CREATE INDEX "Meal_dietType_idx" ON "Meal"("dietType");

-- CreateIndex
CREATE INDEX "Meal_isActive_idx" ON "Meal"("isActive");

-- CreateIndex
CREATE INDEX "Meal_kcal_idx" ON "Meal"("kcal");

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

-- CreateIndex
CREATE INDEX "DietPlanRevision_dietPlanId_idx" ON "DietPlanRevision"("dietPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "DietPlanRevision_dietPlanId_revisionNumber_key" ON "DietPlanRevision"("dietPlanId", "revisionNumber");

-- CreateIndex
CREATE INDEX "CheckIn_patientId_idx" ON "CheckIn"("patientId");

-- CreateIndex
CREATE INDEX "CheckIn_createdAt_idx" ON "CheckIn"("createdAt");

-- CreateIndex
CREATE INDEX "SupplementPrescription_patientId_idx" ON "SupplementPrescription"("patientId");

-- CreateIndex
CREATE INDEX "SupplementPrescription_patientId_active_idx" ON "SupplementPrescription"("patientId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

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

-- CreateIndex
CREATE INDEX "AiUsageLog_patientId_idx" ON "AiUsageLog"("patientId");

-- CreateIndex
CREATE INDEX "AiUsageLog_triggeredAt_idx" ON "AiUsageLog"("triggeredAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_source_idx" ON "AiUsageLog"("source");

-- CreateIndex
CREATE INDEX "AiUsageLog_success_idx" ON "AiUsageLog"("success");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_enabled_idx" ON "FeatureFlag"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_userId_key" ON "Testimonial"("userId");

-- CreateIndex
CREATE INDEX "Testimonial_status_idx" ON "Testimonial"("status");

-- CreateIndex
CREATE INDEX "Testimonial_isPinned_idx" ON "Testimonial"("isPinned");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreferences_userId_key" ON "NotificationPreferences"("userId");

-- CreateIndex
CREATE INDEX "DietitianNote_patientId_idx" ON "DietitianNote"("patientId");

-- CreateIndex
CREATE INDEX "DietitianNote_dietitianId_idx" ON "DietitianNote"("dietitianId");

-- CreateIndex
CREATE INDEX "NoteTemplate_dietitianId_idx" ON "NoteTemplate"("dietitianId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_userId_key" ON "ReferralCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralUsage_referralCodeId_idx" ON "ReferralUsage"("referralCodeId");

-- CreateIndex
CREATE INDEX "ReferralUsage_referredUserId_idx" ON "ReferralUsage"("referredUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralUsage_referralCodeId_referredUserId_key" ON "ReferralUsage"("referralCodeId", "referredUserId");

-- CreateIndex
CREATE INDEX "ClinicalRule_type_isActive_idx" ON "ClinicalRule"("type", "isActive");

-- CreateIndex
CREATE INDEX "ClinicalRule_isActive_idx" ON "ClinicalRule"("isActive");

-- CreateIndex
CREATE INDEX "ClinicalRule_category_idx" ON "ClinicalRule"("category");

-- CreateIndex
CREATE INDEX "ClinicalRuleHistory_ruleId_idx" ON "ClinicalRuleHistory"("ruleId");

-- CreateIndex
CREATE INDEX "ClinicalRuleHistory_createdAt_idx" ON "ClinicalRuleHistory"("createdAt");

-- CreateIndex
CREATE INDEX "UserConsent_userId_idx" ON "UserConsent"("userId");

-- CreateIndex
CREATE INDEX "UserConsent_userId_consentType_idx" ON "UserConsent"("userId", "consentType");

-- CreateIndex
CREATE UNIQUE INDEX "CleanProduct_slug_key" ON "CleanProduct"("slug");

-- CreateIndex
CREATE INDEX "CleanProduct_name_idx" ON "CleanProduct"("name");

-- CreateIndex
CREATE INDEX "CleanProduct_category_idx" ON "CleanProduct"("category");

-- CreateIndex
CREATE INDEX "CleanProduct_type_idx" ON "CleanProduct"("type");

-- CreateIndex
CREATE INDEX "CleanProduct_verificationStatus_idx" ON "CleanProduct"("verificationStatus");

-- CreateIndex
CREATE INDEX "CleanProduct_qualityScore_idx" ON "CleanProduct"("qualityScore");

-- CreateIndex
CREATE UNIQUE INDEX "CleanProductNutrients_cleanProductId_key" ON "CleanProductNutrients"("cleanProductId");

-- CreateIndex
CREATE INDEX "CleanProductPortion_cleanProductId_idx" ON "CleanProductPortion"("cleanProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CleanProductPortion_cleanProductId_portionName_key" ON "CleanProductPortion"("cleanProductId", "portionName");

-- CreateIndex
CREATE INDEX "CleanProductAllergen_cleanProductId_idx" ON "CleanProductAllergen"("cleanProductId");

-- CreateIndex
CREATE INDEX "CleanProductAllergen_allergenCode_idx" ON "CleanProductAllergen"("allergenCode");

-- CreateIndex
CREATE UNIQUE INDEX "CleanProductAllergen_cleanProductId_allergenCode_key" ON "CleanProductAllergen"("cleanProductId", "allergenCode");

-- CreateIndex
CREATE INDEX "CleanProductDietFlag_cleanProductId_idx" ON "CleanProductDietFlag"("cleanProductId");

-- CreateIndex
CREATE INDEX "CleanProductDietFlag_flagCode_idx" ON "CleanProductDietFlag"("flagCode");

-- CreateIndex
CREATE UNIQUE INDEX "CleanProductDietFlag_cleanProductId_flagCode_key" ON "CleanProductDietFlag"("cleanProductId", "flagCode");

-- CreateIndex
CREATE UNIQUE INDEX "CleanProductAminoAcids_cleanProductId_key" ON "CleanProductAminoAcids"("cleanProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CleanProductBioactives_cleanProductId_key" ON "CleanProductBioactives"("cleanProductId");

-- CreateIndex
CREATE INDEX "NutritionProtocol_scope_idx" ON "NutritionProtocol"("scope");

-- CreateIndex
CREATE INDEX "NutritionProtocol_dietitianId_idx" ON "NutritionProtocol"("dietitianId");

-- CreateIndex
CREATE INDEX "NutritionProtocol_isDefault_idx" ON "NutritionProtocol"("isDefault");

-- CreateIndex
CREATE INDEX "NutritionProtocol_isActive_idx" ON "NutritionProtocol"("isActive");

-- CreateIndex
CREATE INDEX "DietitianProtocolAccess_dietitianId_idx" ON "DietitianProtocolAccess"("dietitianId");

-- CreateIndex
CREATE INDEX "DietitianProtocolAccess_protocolId_idx" ON "DietitianProtocolAccess"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "DietitianProtocolAccess_dietitianId_protocolId_key" ON "DietitianProtocolAccess"("dietitianId", "protocolId");

-- CreateIndex
CREATE INDEX "ProtocolTrigger_interviewField_interviewValue_idx" ON "ProtocolTrigger"("interviewField", "interviewValue");

-- CreateIndex
CREATE INDEX "ProtocolTrigger_protocolId_idx" ON "ProtocolTrigger"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolTrigger_interviewField_interviewValue_protocolId_key" ON "ProtocolTrigger"("interviewField", "interviewValue", "protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolConflict_triggerAField_triggerAValue_triggerBField__key" ON "ProtocolConflict"("triggerAField", "triggerAValue", "triggerBField", "triggerBValue");

-- CreateIndex
CREATE INDEX "AiCostLog_dietPlanId_idx" ON "AiCostLog"("dietPlanId");

-- CreateIndex
CREATE INDEX "AiCostLog_createdAt_idx" ON "AiCostLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrialFingerprint_cardFingerprint_key" ON "TrialFingerprint"("cardFingerprint");

-- CreateIndex
CREATE INDEX "TrialFingerprint_userId_idx" ON "TrialFingerprint"("userId");

-- CreateIndex
CREATE INDEX "DeviceFingerprint_fingerprint_idx" ON "DeviceFingerprint"("fingerprint");

-- CreateIndex
CREATE INDEX "DeviceFingerprint_userId_idx" ON "DeviceFingerprint"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceFingerprint_fingerprint_userId_key" ON "DeviceFingerprint"("fingerprint", "userId");

-- CreateIndex
CREATE INDEX "SecurityBan_type_value_active_idx" ON "SecurityBan"("type", "value", "active");

-- CreateIndex
CREATE INDEX "SecurityBan_active_idx" ON "SecurityBan"("active");

-- CreateIndex
CREATE INDEX "DayRegeneration_dietPlanId_idx" ON "DayRegeneration"("dietPlanId");

-- CreateIndex
CREATE INDEX "DayRegeneration_dietPlanId_status_idx" ON "DayRegeneration"("dietPlanId", "status");

-- CreateIndex
CREATE INDEX "BodyMeasurement_patientId_date_idx" ON "BodyMeasurement"("patientId", "date");

-- CreateIndex
CREATE INDEX "Conversation_patientId_idx" ON "Conversation"("patientId");

-- CreateIndex
CREATE INDEX "Conversation_dietitianId_idx" ON "Conversation"("dietitianId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_patientId_dietitianId_key" ON "Conversation"("patientId", "dietitianId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "EmailSend_campaignId_sentAt_idx" ON "EmailSend"("campaignId", "sentAt");

-- CreateIndex
CREATE INDEX "EmailSend_recipientId_idx" ON "EmailSend"("recipientId");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietitianProfile" ADD CONSTRAINT "DietitianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NutritionProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSwap" ADD CONSTRAINT "MealSwap_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabPanel" ADD CONSTRAINT "LabPanel_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodCategory" ADD CONSTRAINT "FoodCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FoodCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProduct" ADD CONSTRAINT "FoodProduct_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "FoodBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProduct" ADD CONSTRAINT "FoodProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProductNutrients" ADD CONSTRAINT "FoodProductNutrients_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProductAllergen" ADD CONSTRAINT "FoodProductAllergen_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProductDietFlag" ADD CONSTRAINT "FoodProductDietFlag_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProductAlias" ADD CONSTRAINT "FoodProductAlias_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProductSourceMeta" ADD CONSTRAINT "FoodProductSourceMeta_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMeasure" ADD CONSTRAINT "HouseholdMeasure_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_foodProductId_fkey" FOREIGN KEY ("foodProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeInstructionStep" ADD CONSTRAINT "RecipeInstructionStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeNutritionSnapshot" ADD CONSTRAINT "RecipeNutritionSnapshot_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeAllergen" ADD CONSTRAINT "RecipeAllergen_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeDietFlag" ADD CONSTRAINT "RecipeDietFlag_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListCheck" ADD CONSTRAINT "ShoppingListCheck_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListCheck" ADD CONSTRAINT "ShoppingListCheck_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteMeal" ADD CONSTRAINT "FavoriteMeal_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientSubstitutionRule" ADD CONSTRAINT "IngredientSubstitutionRule_fromProductId_fkey" FOREIGN KEY ("fromProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientSubstitutionRule" ADD CONSTRAINT "IngredientSubstitutionRule_toProductId_fkey" FOREIGN KEY ("toProductId") REFERENCES "FoodProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionTargets" ADD CONSTRAINT "NutritionTargets_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateMeal" ADD CONSTRAINT "TemplateMeal_templatePlanId_fkey" FOREIGN KEY ("templatePlanId") REFERENCES "TemplatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateMeal" ADD CONSTRAINT "TemplateMeal_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietPlanRevision" ADD CONSTRAINT "DietPlanRevision_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementPrescription" ADD CONSTRAINT "SupplementPrescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementPrescription" ADD CONSTRAINT "SupplementPrescription_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietitianNote" ADD CONSTRAINT "DietitianNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietitianNote" ADD CONSTRAINT "DietitianNote_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietitianNote" ADD CONSTRAINT "DietitianNote_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTemplate" ADD CONSTRAINT "NoteTemplate_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralUsage" ADD CONSTRAINT "ReferralUsage_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralUsage" ADD CONSTRAINT "ReferralUsage_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalRuleHistory" ADD CONSTRAINT "ClinicalRuleHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ClinicalRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanProductNutrients" ADD CONSTRAINT "CleanProductNutrients_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanProductPortion" ADD CONSTRAINT "CleanProductPortion_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanProductAllergen" ADD CONSTRAINT "CleanProductAllergen_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanProductDietFlag" ADD CONSTRAINT "CleanProductDietFlag_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanProductAminoAcids" ADD CONSTRAINT "CleanProductAminoAcids_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanProductBioactives" ADD CONSTRAINT "CleanProductBioactives_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionProtocol" ADD CONSTRAINT "NutritionProtocol_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietitianProtocolAccess" ADD CONSTRAINT "DietitianProtocolAccess_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietitianProtocolAccess" ADD CONSTRAINT "DietitianProtocolAccess_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "NutritionProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietitianProtocolAccess" ADD CONSTRAINT "DietitianProtocolAccess_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolTrigger" ADD CONSTRAINT "ProtocolTrigger_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "NutritionProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCostLog" ADD CONSTRAINT "AiCostLog_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialFingerprint" ADD CONSTRAINT "TrialFingerprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceFingerprint" ADD CONSTRAINT "DeviceFingerprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayRegeneration" ADD CONSTRAINT "DayRegeneration_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
