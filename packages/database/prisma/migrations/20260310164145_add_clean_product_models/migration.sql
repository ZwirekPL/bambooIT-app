-- CreateEnum
CREATE TYPE "CleanProductType" AS ENUM ('BASE', 'RETAIL', 'MANUAL');

-- CreateEnum
CREATE TYPE "CleanProductSource" AS ENUM ('ILEWAZY', 'USDA', 'OPENFOODFACTS', 'MANUAL');

-- CreateEnum
CREATE TYPE "CleanVerificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'FLAGGED');

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
    "potassiumMg" DECIMAL(8,3),
    "calciumMg" DECIMAL(8,3),
    "magnesiumMg" DECIMAL(8,3),
    "ironMg" DECIMAL(7,3),
    "zincMg" DECIMAL(7,3),
    "vitaminAUg" DECIMAL(8,3),
    "vitaminCMg" DECIMAL(7,3),
    "vitaminDUg" DECIMAL(7,3),
    "vitaminEMg" DECIMAL(7,3),
    "vitaminB12Ug" DECIMAL(7,4),
    "folateMg" DECIMAL(7,3),
    "cholesterolMg" DECIMAL(7,3),
    "sodiumMg" DECIMAL(8,3),

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

-- AddForeignKey
ALTER TABLE "CleanProductNutrients" ADD CONSTRAINT "CleanProductNutrients_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanProductPortion" ADD CONSTRAINT "CleanProductPortion_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanProductAllergen" ADD CONSTRAINT "CleanProductAllergen_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanProductDietFlag" ADD CONSTRAINT "CleanProductDietFlag_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
