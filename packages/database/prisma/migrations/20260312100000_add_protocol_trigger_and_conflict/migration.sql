-- CreateTable
CREATE TABLE "ProtocolTrigger" (
    "id" TEXT NOT NULL,
    "interviewField" TEXT NOT NULL,
    "interviewValue" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolConflict" (
    "id" TEXT NOT NULL,
    "triggerAField" TEXT NOT NULL,
    "triggerAValue" TEXT NOT NULL,
    "triggerBField" TEXT NOT NULL,
    "triggerBValue" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "messageKey" TEXT NOT NULL,
    "winnerSide" TEXT NOT NULL DEFAULT 'B',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProtocolTrigger_interviewField_interviewValue_idx" ON "ProtocolTrigger"("interviewField", "interviewValue");

-- CreateIndex
CREATE INDEX "ProtocolTrigger_protocolId_idx" ON "ProtocolTrigger"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolTrigger_interviewField_interviewValue_protocolId_key" ON "ProtocolTrigger"("interviewField", "interviewValue", "protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolConflict_triggerAField_triggerAValue_triggerBField_tr_key" ON "ProtocolConflict"("triggerAField", "triggerAValue", "triggerBField", "triggerBValue");

-- AddForeignKey
ALTER TABLE "ProtocolTrigger" ADD CONSTRAINT "ProtocolTrigger_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "NutritionProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
