/*
  Warnings:

  - You are about to drop the column `carryoverInHours` on the `ServicePeriod` table. All the data in the column will be lost.
  - You are about to drop the column `carryoverOutHours` on the `ServicePeriod` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ServicePeriod" DROP COLUMN "carryoverInHours",
DROP COLUMN "carryoverOutHours",
ADD COLUMN     "carryoverInMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "carryoverOutMinutes" INTEGER NOT NULL DEFAULT 0;
