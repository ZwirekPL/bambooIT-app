-- K8: Replace ProductType + SubscriptionPlan enums with bambooIT packages
-- (START, FIRMA, FIRMA_PLUS) per D-007 + D-018. Drop Order.consultationPhone
-- column (diet-specific). Drop Subscription.plan @default(FREE).
--
-- Manual edit: USING clauses changed from text-cast (Prisma default,
-- "plan"::text::"NewEnum") to forced 'START' cast. Text-cast would FAIL in
-- production with existing rows holding old enum values (FREE_7/OPIEKA_*/
-- PLAN_*/CONSULTATION on Order; FREE/PRO_MONTHLY/PRO_YEARLY on Subscription)
-- — those values are not present in new enum, so the cast errors out.
-- Forced 'START' cast is dev-safe (0 rows trivially pass) and produces a
-- cleaner migration log. Production deployment requires pre-migration data
-- review — see TODO(K8-deploy) marker in subscription.service.ts.

-- Phase 1: ProductType enum reform
BEGIN;
CREATE TYPE "ProductType_new" AS ENUM ('START', 'FIRMA', 'FIRMA_PLUS');
ALTER TABLE "Order" ALTER COLUMN "productType" TYPE "ProductType_new" USING ('START'::"ProductType_new");
ALTER TYPE "ProductType" RENAME TO "ProductType_old";
ALTER TYPE "ProductType_new" RENAME TO "ProductType";
DROP TYPE "public"."ProductType_old";
COMMIT;

-- Phase 2: SubscriptionPlan enum reform
BEGIN;
CREATE TYPE "SubscriptionPlan_new" AS ENUM ('START', 'FIRMA', 'FIRMA_PLUS');
ALTER TABLE "public"."Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "SubscriptionPlan_new" USING ('START'::"SubscriptionPlan_new");
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
DROP TYPE "public"."SubscriptionPlan_old";
COMMIT;

-- Phase 3: Drop diet-specific Order column
ALTER TABLE "Order" DROP COLUMN "consultationPhone";
