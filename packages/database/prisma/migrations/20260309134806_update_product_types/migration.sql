-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductType" ADD VALUE 'OPIEKA_MIESIECZNA';
ALTER TYPE "ProductType" ADD VALUE 'PREMIUM';
ALTER TYPE "ProductType" ADD VALUE 'PLAN_2W';
ALTER TYPE "ProductType" ADD VALUE 'PLAN_4W';
