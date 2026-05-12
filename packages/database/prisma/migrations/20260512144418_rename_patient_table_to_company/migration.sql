-- Manual edit (K6a Phase 2 Opcja B): non-destructive ALTER TABLE RENAME
-- Prisma migrate auto-generated DROP TABLE + CREATE TABLE because schema
-- diff detection treats `model Company` as a new model. Manually rewritten
-- to preserve data + historical audit trail intent ("table renamed", not
-- "dropped and recreated"). Patient table was empty at apply time so the
-- generated DROP+CREATE would have been functionally equivalent, but the
-- RENAME form documents the actual intent for future devs.

-- Rename table Patient → Company (preserves data + identity)
ALTER TABLE "Patient" RENAME TO "Company";

-- Rename primary key constraint
ALTER TABLE "Company" RENAME CONSTRAINT "Patient_pkey" TO "Company_pkey";

-- Rename indexes
ALTER INDEX "Patient_userId_key" RENAME TO "Company_userId_key";
ALTER INDEX "Patient_dietitianId_idx" RENAME TO "Company_dietitianId_idx";

-- Rename foreign key constraints on Company side (Patient → Company prefix)
ALTER TABLE "Company" RENAME CONSTRAINT "Patient_userId_fkey" TO "Company_userId_fkey";
ALTER TABLE "Company" RENAME CONSTRAINT "Patient_dietitianId_fkey" TO "Company_dietitianId_fkey";

-- Note: Order_patientId_fkey constraint references Company.id automatically
-- after the table rename above (Postgres updates FK target on RENAME TABLE).
-- The constraint *name* still contains "patientId" — Phase 3 will rename
-- the Order.patientId column to Order.companyId, at which point Prisma will
-- regenerate the FK constraint with the new "companyId" name.
