-- AlterEnum: Add new ConsentType values
ALTER TYPE "ConsentType" ADD VALUE 'TERMS_ACCEPTANCE';
ALTER TYPE "ConsentType" ADD VALUE 'PRIVACY_POLICY';
ALTER TYPE "ConsentType" ADD VALUE 'COOKIE_FUNCTIONAL';

-- Drop the unique constraint (we want history, multiple entries per type)
ALTER TABLE "UserConsent" DROP CONSTRAINT IF EXISTS "UserConsent_userId_consentType_key";

-- Add new columns
ALTER TABLE "UserConsent" ADD COLUMN "granted" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserConsent" ADD COLUMN "documentVersion" VARCHAR(20) NOT NULL DEFAULT '1.0';
ALTER TABLE "UserConsent" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- Add composite index on userId + consentType
CREATE INDEX "UserConsent_userId_consentType_idx" ON "UserConsent"("userId", "consentType");
