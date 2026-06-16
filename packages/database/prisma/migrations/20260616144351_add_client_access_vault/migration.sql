-- CreateEnum
CREATE TYPE "AccessKind" AS ENUM ('REMOTE', 'SYSTEM', 'NETWORK', 'OTHER');

-- CreateTable
CREATE TABLE "ClientAccessEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "AccessKind" NOT NULL DEFAULT 'SYSTEM',
    "label" TEXT NOT NULL,
    "identifier" TEXT,
    "secret" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAccessEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientAccessEntry_companyId_idx" ON "ClientAccessEntry"("companyId");

-- AddForeignKey
ALTER TABLE "ClientAccessEntry" ADD CONSTRAINT "ClientAccessEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
