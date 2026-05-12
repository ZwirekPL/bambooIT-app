/*
  Warnings:

  - You are about to drop the `ClinicalRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ClinicalRuleHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DietitianProtocolAccess` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailCampaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailSend` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NutritionProtocol` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProtocolConflict` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProtocolTrigger` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClinicalRuleHistory" DROP CONSTRAINT "ClinicalRuleHistory_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "DietitianProtocolAccess" DROP CONSTRAINT "DietitianProtocolAccess_assignedBy_fkey";

-- DropForeignKey
ALTER TABLE "DietitianProtocolAccess" DROP CONSTRAINT "DietitianProtocolAccess_dietitianId_fkey";

-- DropForeignKey
ALTER TABLE "DietitianProtocolAccess" DROP CONSTRAINT "DietitianProtocolAccess_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "EmailSend" DROP CONSTRAINT "EmailSend_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "NutritionProtocol" DROP CONSTRAINT "NutritionProtocol_dietitianId_fkey";

-- DropForeignKey
ALTER TABLE "ProtocolTrigger" DROP CONSTRAINT "ProtocolTrigger_protocolId_fkey";

-- DropTable
DROP TABLE "ClinicalRule";

-- DropTable
DROP TABLE "ClinicalRuleHistory";

-- DropTable
DROP TABLE "DietitianProtocolAccess";

-- DropTable
DROP TABLE "EmailCampaign";

-- DropTable
DROP TABLE "EmailSend";

-- DropTable
DROP TABLE "NutritionProtocol";

-- DropTable
DROP TABLE "ProtocolConflict";

-- DropTable
DROP TABLE "ProtocolTrigger";

-- DropEnum
DROP TYPE "BmrFormula";

-- DropEnum
DROP TYPE "ClinicalRuleType";

-- DropEnum
DROP TYPE "ProtocolScope";

-- DropEnum
DROP TYPE "RecipeComplexity";

-- DropEnum
DROP TYPE "RuleSeverity";
