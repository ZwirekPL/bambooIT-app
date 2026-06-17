-- Purge e-dietetyk leftovers: drop the referral program entirely and remove the
-- diet-specific consent types (HEALTH_DATA_PROCESSING, AI_DISCLAIMER) that do not
-- apply to bambooIT's B2B IT services. bambooIT keeps TERMS_ACCEPTANCE + PRIVACY_POLICY
-- (required) and EMAIL_NOTIFICATIONS (optional).

-- Remove any existing consent rows of the dropped types so the enum cast below
-- cannot fail on legacy data (registrations made before this purge).
DELETE FROM "UserConsent" WHERE "consentType" IN ('HEALTH_DATA_PROCESSING', 'AI_DISCLAIMER');

-- AlterEnum
BEGIN;
CREATE TYPE "ConsentType_new" AS ENUM ('EMAIL_NOTIFICATIONS', 'TERMS_ACCEPTANCE', 'PRIVACY_POLICY', 'COOKIE_FUNCTIONAL', 'COOKIE_ANALYTICS', 'COOKIE_MARKETING');
ALTER TABLE "UserConsent" ALTER COLUMN "consentType" TYPE "ConsentType_new" USING ("consentType"::text::"ConsentType_new");
ALTER TYPE "ConsentType" RENAME TO "ConsentType_old";
ALTER TYPE "ConsentType_new" RENAME TO "ConsentType";
DROP TYPE "public"."ConsentType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ReferralCode" DROP CONSTRAINT "ReferralCode_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralUsage" DROP CONSTRAINT "ReferralUsage_referralCodeId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralUsage" DROP CONSTRAINT "ReferralUsage_referredUserId_fkey";

-- DropTable
DROP TABLE "ReferralCode";

-- DropTable
DROP TABLE "ReferralUsage";
