/*
  Warnings:

  - You are about to drop the column `tenantId` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the `Tenant` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Tenant" DROP CONSTRAINT "Tenant_ownerId_fkey";

-- DropIndex
DROP INDEX "Patient_tenantId_idx";

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "tenantId";

-- DropTable
DROP TABLE "Tenant";
