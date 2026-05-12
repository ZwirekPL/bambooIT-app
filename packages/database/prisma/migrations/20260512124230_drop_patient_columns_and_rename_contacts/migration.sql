/*
  Warnings:

  - You are about to drop the column `birthDate` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `birthYear` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `heightCm` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `sex` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `weightKg` on the `Patient` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "birthDate",
DROP COLUMN "birthYear",
DROP COLUMN "firstName",
DROP COLUMN "heightCm",
DROP COLUMN "lastName",
DROP COLUMN "sex",
DROP COLUMN "weightKg",
ADD COLUMN     "contactFirstName" TEXT,
ADD COLUMN     "contactLastName" TEXT;
