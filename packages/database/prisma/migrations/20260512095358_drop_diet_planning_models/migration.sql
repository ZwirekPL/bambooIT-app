/*
  Warnings:

  - You are about to drop the `AiCostLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AiUsageLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BodyMeasurement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CheckIn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DayRegeneration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DietPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DietPlanRevision` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DietTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DietitianNote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FrequentInput` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Interview` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LabPanel` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Meal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MealSwap` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NoteTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NutritionTargets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SupplementPrescription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TemplateMeal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TemplatePlan` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AiCostLog" DROP CONSTRAINT "AiCostLog_dietPlanId_fkey";

-- DropForeignKey
ALTER TABLE "AiUsageLog" DROP CONSTRAINT "AiUsageLog_patientId_fkey";

-- DropForeignKey
ALTER TABLE "BodyMeasurement" DROP CONSTRAINT "BodyMeasurement_patientId_fkey";

-- DropForeignKey
ALTER TABLE "CheckIn" DROP CONSTRAINT "CheckIn_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_dietitianId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_patientId_fkey";

-- DropForeignKey
ALTER TABLE "DayRegeneration" DROP CONSTRAINT "DayRegeneration_dietPlanId_fkey";

-- DropForeignKey
ALTER TABLE "DietPlan" DROP CONSTRAINT "DietPlan_patientId_fkey";

-- DropForeignKey
ALTER TABLE "DietPlan" DROP CONSTRAINT "DietPlan_templateId_fkey";

-- DropForeignKey
ALTER TABLE "DietPlanRevision" DROP CONSTRAINT "DietPlanRevision_dietPlanId_fkey";

-- DropForeignKey
ALTER TABLE "DietitianNote" DROP CONSTRAINT "DietitianNote_dietPlanId_fkey";

-- DropForeignKey
ALTER TABLE "DietitianNote" DROP CONSTRAINT "DietitianNote_dietitianId_fkey";

-- DropForeignKey
ALTER TABLE "DietitianNote" DROP CONSTRAINT "DietitianNote_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_patientId_fkey";

-- DropForeignKey
ALTER TABLE "LabPanel" DROP CONSTRAINT "LabPanel_patientId_fkey";

-- DropForeignKey
ALTER TABLE "MealSwap" DROP CONSTRAINT "MealSwap_dietPlanId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropForeignKey
ALTER TABLE "NoteTemplate" DROP CONSTRAINT "NoteTemplate_dietitianId_fkey";

-- DropForeignKey
ALTER TABLE "NutritionTargets" DROP CONSTRAINT "NutritionTargets_patientId_fkey";

-- DropForeignKey
ALTER TABLE "SupplementPrescription" DROP CONSTRAINT "SupplementPrescription_dietitianId_fkey";

-- DropForeignKey
ALTER TABLE "SupplementPrescription" DROP CONSTRAINT "SupplementPrescription_patientId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateMeal" DROP CONSTRAINT "TemplateMeal_mealId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateMeal" DROP CONSTRAINT "TemplateMeal_templatePlanId_fkey";

-- DropTable
DROP TABLE "AiCostLog";

-- DropTable
DROP TABLE "AiUsageLog";

-- DropTable
DROP TABLE "BodyMeasurement";

-- DropTable
DROP TABLE "CheckIn";

-- DropTable
DROP TABLE "Conversation";

-- DropTable
DROP TABLE "DayRegeneration";

-- DropTable
DROP TABLE "DietPlan";

-- DropTable
DROP TABLE "DietPlanRevision";

-- DropTable
DROP TABLE "DietTemplate";

-- DropTable
DROP TABLE "DietitianNote";

-- DropTable
DROP TABLE "FrequentInput";

-- DropTable
DROP TABLE "Interview";

-- DropTable
DROP TABLE "LabPanel";

-- DropTable
DROP TABLE "Meal";

-- DropTable
DROP TABLE "MealSwap";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "NoteTemplate";

-- DropTable
DROP TABLE "NutritionTargets";

-- DropTable
DROP TABLE "SupplementPrescription";

-- DropTable
DROP TABLE "TemplateMeal";

-- DropTable
DROP TABLE "TemplatePlan";

-- DropEnum
DROP TYPE "DayRegenReason";

-- DropEnum
DROP TYPE "DayRegenStatus";

-- DropEnum
DROP TYPE "DietPlanRevisionReason";

-- DropEnum
DROP TYPE "DietPlanSource";

-- DropEnum
DROP TYPE "DietPlanStatus";

-- DropEnum
DROP TYPE "DietType";

-- DropEnum
DROP TYPE "MealType";

-- DropEnum
DROP TYPE "ValidationStatus";
