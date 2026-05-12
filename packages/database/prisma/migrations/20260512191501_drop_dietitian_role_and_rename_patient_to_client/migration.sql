-- K7: Drop DIETITIAN role + DietitianProfile + Company.dietitianId,
-- rename UserRole PATIENT → CLIENT (per ADR D-024: bambooIT uses only
-- ADMIN + CLIENT roles).
--
-- Manual edit (K7 Opcja 2): rename PATIENT → CLIENT value BEFORE enum recreate.
-- Prisma generates USING cast which would fail on existing PATIENT/
-- DIETITIAN values in production (cast fails because those values
-- don't exist in new enum {ADMIN, CLIENT}). ALTER TYPE RENAME VALUE
-- preserves data; subsequent recreate then handles DIETITIAN drop only.
--
-- After this rename, USING cast in enum recreate succeeds for all
-- remaining values (ADMIN → ADMIN, CLIENT → CLIENT). Production
-- deploy still requires pre-migration DELETE/UPDATE for any users
-- with role = 'DIETITIAN' (no auto-conversion path). For dev with
-- 0 users, this is trivial.

-- Step 1: Rename PATIENT → CLIENT in-place (preserves data)
ALTER TYPE "UserRole" RENAME VALUE 'PATIENT' TO 'CLIENT';

-- Step 2: AlterEnum — drop DIETITIAN via standard Postgres recreate
-- workaround (no DROP VALUE support). USING cast now safe because
-- only ADMIN and CLIENT values exist after step 1 (for dev: 0 rows).
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'CLIENT');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_dietitianId_fkey";

-- DropForeignKey
ALTER TABLE "DietitianProfile" DROP CONSTRAINT "DietitianProfile_userId_fkey";

-- DropIndex
DROP INDEX "Company_dietitianId_idx";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "dietitianId";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';

-- DropTable
DROP TABLE "DietitianProfile";
