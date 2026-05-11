-- 79.6: Supplement Prescription tracking

-- CreateTable SupplementPrescription
CREATE TABLE "SupplementPrescription" (
    "id"          TEXT NOT NULL,
    "patientId"   TEXT NOT NULL,
    "dietitianId" TEXT,
    "nutrientKey" VARCHAR(50) NOT NULL,
    "label"       VARCHAR(200) NOT NULL,
    "dose"        VARCHAR(50) NOT NULL,
    "unit"        VARCHAR(20) NOT NULL,
    "frequency"   VARCHAR(50) NOT NULL,
    "startDate"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate"     TIMESTAMP(3),
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplementPrescription_patientId_idx" ON "SupplementPrescription"("patientId");
CREATE INDEX "SupplementPrescription_patientId_active_idx" ON "SupplementPrescription"("patientId", "active");

-- AddForeignKey
ALTER TABLE "SupplementPrescription" ADD CONSTRAINT "SupplementPrescription_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplementPrescription" ADD CONSTRAINT "SupplementPrescription_dietitianId_fkey"
    FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable CheckIn: add supplementsTaken field
ALTER TABLE "CheckIn" ADD COLUMN IF NOT EXISTS "supplementsTaken" JSONB;
