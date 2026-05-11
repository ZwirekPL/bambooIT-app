-- CreateEnum
CREATE TYPE "ClinicalRuleType" AS ENUM ('POLICY', 'RED_FLAG');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MODERATE', 'LOW');

-- CreateTable
CREATE TABLE "ClinicalRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ClinicalRuleType" NOT NULL,
    "severity" "RuleSeverity" NOT NULL DEFAULT 'LOW',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "conditions" JSONB NOT NULL,
    "effects" JSONB NOT NULL,
    "source" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalRuleHistory" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "changedBy" TEXT,
    "changeSummary" TEXT NOT NULL,
    "previousData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalRuleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalRule_type_isActive_idx" ON "ClinicalRule"("type", "isActive");

-- CreateIndex
CREATE INDEX "ClinicalRule_isActive_idx" ON "ClinicalRule"("isActive");

-- CreateIndex
CREATE INDEX "ClinicalRuleHistory_ruleId_idx" ON "ClinicalRuleHistory"("ruleId");

-- CreateIndex
CREATE INDEX "ClinicalRuleHistory_createdAt_idx" ON "ClinicalRuleHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "ClinicalRuleHistory" ADD CONSTRAINT "ClinicalRuleHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ClinicalRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
