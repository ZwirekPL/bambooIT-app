-- Manual edit (K6a Phase 3 Opcja B): non-destructive RENAME COLUMN.
-- Prisma migrate generated DROP COLUMN + ADD COLUMN (destructive) because
-- without @map("patientId") decorator it cannot detect the rename intent.
-- Manually rewritten to ALTER TABLE RENAME COLUMN for consistency with
-- Phase 2 audit trail and to preserve FK + data semantics (constraint
-- just renamed, not dropped + recreated).

-- Rename Order FK column patientId → companyId
ALTER TABLE "Order" RENAME COLUMN "patientId" TO "companyId";

-- Rename index that was implicitly tied to patientId
ALTER INDEX "Order_patientId_idx" RENAME TO "Order_companyId_idx";

-- Rename FK constraint (Postgres preserves the underlying FK after the
-- column rename above, but the constraint name still contains "patientId"
-- — explicit rename keeps audit trail consistent with the new column name).
ALTER TABLE "Order" RENAME CONSTRAINT "Order_patientId_fkey" TO "Order_companyId_fkey";
