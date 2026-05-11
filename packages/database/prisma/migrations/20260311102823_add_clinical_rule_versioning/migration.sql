-- AlterTable
ALTER TABLE "ClinicalRule" ADD COLUMN     "category" VARCHAR(50),
ADD COLUMN     "conflictsWith" TEXT[],
ADD COLUMN     "sources" JSONB,
ADD COLUMN     "version" VARCHAR(20) NOT NULL DEFAULT '1.0';

-- CreateIndex
CREATE INDEX "ClinicalRule_category_idx" ON "ClinicalRule"("category");
