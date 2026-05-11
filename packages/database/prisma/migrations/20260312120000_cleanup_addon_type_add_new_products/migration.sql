-- 29.1: Cleanup — remove AddonType enum and addonTypes field from Order,
-- add OPIEKA_ROCZNA and CONSULTATION to ProductType enum.

-- Step 1: Remove addonTypes column from Order table
ALTER TABLE "Order" DROP COLUMN IF EXISTS "addonTypes";

-- Step 2: Drop AddonType enum
DROP TYPE IF EXISTS "AddonType";

-- Step 3: Add new ProductType values
ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'OPIEKA_ROCZNA';
ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'CONSULTATION';
