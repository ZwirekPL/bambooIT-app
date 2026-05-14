-- AlterTable
ALTER TABLE "Company" ADD COLUMN "nip" TEXT,
ADD COLUMN "companyName" TEXT,
ADD COLUMN "industry" TEXT,
ADD COLUMN "employeesCount" INTEGER,
ADD COLUMN "city" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "website" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_nip_key" ON "Company"("nip");

-- CreateIndex
CREATE INDEX "Company_nip_idx" ON "Company"("nip");
