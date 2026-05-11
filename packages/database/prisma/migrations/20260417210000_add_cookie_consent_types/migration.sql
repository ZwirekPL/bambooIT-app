-- Add COOKIE_ANALYTICS and COOKIE_MARKETING to ConsentType enum (RODO Phase 1.1).
-- ALTER TYPE ... ADD VALUE is idempotent-safe via IF NOT EXISTS and cannot run inside a transaction,
-- but Prisma runs each statement separately so this is fine.

ALTER TYPE "ConsentType" ADD VALUE IF NOT EXISTS 'COOKIE_ANALYTICS';
ALTER TYPE "ConsentType" ADD VALUE IF NOT EXISTS 'COOKIE_MARKETING';
