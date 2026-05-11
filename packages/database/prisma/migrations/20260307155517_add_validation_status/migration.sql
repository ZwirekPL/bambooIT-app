-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('VALID', 'NEEDS_ADJUST', 'NEEDS_REPAIR_AI');

-- AlterTable
ALTER TABLE "DietPlan" ADD COLUMN     "validationErrors" JSONB,
ADD COLUMN     "validationStatus" "ValidationStatus";
