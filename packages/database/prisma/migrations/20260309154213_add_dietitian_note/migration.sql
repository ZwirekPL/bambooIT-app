-- CreateTable
CREATE TABLE "DietitianNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dietitianId" TEXT NOT NULL,
    "dietPlanId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DietitianNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DietitianNote_patientId_idx" ON "DietitianNote"("patientId");

-- CreateIndex
CREATE INDEX "DietitianNote_dietitianId_idx" ON "DietitianNote"("dietitianId");

-- AddForeignKey
ALTER TABLE "DietitianNote" ADD CONSTRAINT "DietitianNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietitianNote" ADD CONSTRAINT "DietitianNote_dietitianId_fkey" FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietitianNote" ADD CONSTRAINT "DietitianNote_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
