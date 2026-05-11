-- AlterTable
ALTER TABLE "RecipeIngredient" ADD COLUMN     "cleanProductId" TEXT,
ALTER COLUMN "foodProductId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "RecipeIngredient_cleanProductId_idx" ON "RecipeIngredient"("cleanProductId");

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_cleanProductId_fkey" FOREIGN KEY ("cleanProductId") REFERENCES "CleanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
