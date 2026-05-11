-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dietPlanId" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "source" TEXT,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "n8nTriggered" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "validationStatus" TEXT,
    "autoAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "policyRulesCount" INTEGER NOT NULL DEFAULT 0,
    "redFlagsCount" INTEGER NOT NULL DEFAULT 0,
    "redFlagSeverity" TEXT,
    "stepTimings" JSONB,
    "error" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(10,6),

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageLog_patientId_idx" ON "AiUsageLog"("patientId");

-- CreateIndex
CREATE INDEX "AiUsageLog_triggeredAt_idx" ON "AiUsageLog"("triggeredAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_source_idx" ON "AiUsageLog"("source");

-- CreateIndex
CREATE INDEX "AiUsageLog_success_idx" ON "AiUsageLog"("success");

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
