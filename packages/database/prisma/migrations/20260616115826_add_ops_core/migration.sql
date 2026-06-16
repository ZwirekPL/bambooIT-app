-- CreateEnum
CREATE TYPE "ServicePeriodStatus" AS ENUM ('OPEN', 'TO_SETTLE', 'SETTLED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "servicePlan" "SubscriptionPlan",
ADD COLUMN     "serviceSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "plan" "SubscriptionPlan" NOT NULL,
    "monthlyPriceNet" DECIMAL(10,2) NOT NULL,
    "hoursIncluded" INTEGER NOT NULL,
    "overageRatePerHour" DECIMAL(10,2) NOT NULL,
    "reactionTimeHours" INTEGER NOT NULL,
    "carryoverCapHours" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("plan")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "hoursIncluded" INTEGER NOT NULL,
    "carryoverInHours" INTEGER NOT NULL DEFAULT 0,
    "carryoverOutHours" INTEGER NOT NULL DEFAULT 0,
    "overageRatePerHour" DECIMAL(10,2) NOT NULL,
    "consumedMinutes" INTEGER NOT NULL DEFAULT 0,
    "overageHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overageAmountNet" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "ServicePeriodStatus" NOT NULL DEFAULT 'OPEN',
    "settledAt" TIMESTAMP(3),
    "reportSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyOnboarding" (
    "companyId" TEXT NOT NULL,
    "accessCollected" TIMESTAMP(3),
    "remoteToolReady" TIMESTAMP(3),
    "monitoringSet" TIMESTAMP(3),
    "backupSet" TIMESTAMP(3),
    "docsCreated" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyOnboarding_pkey" PRIMARY KEY ("companyId")
);

-- CreateIndex
CREATE INDEX "TimeEntry_companyId_date_idx" ON "TimeEntry"("companyId", "date");

-- CreateIndex
CREATE INDEX "TimeEntry_periodId_idx" ON "TimeEntry"("periodId");

-- CreateIndex
CREATE INDEX "ServicePeriod_companyId_idx" ON "ServicePeriod"("companyId");

-- CreateIndex
CREATE INDEX "ServicePeriod_status_idx" ON "ServicePeriod"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePeriod_companyId_year_month_key" ON "ServicePeriod"("companyId", "year", "month");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ServicePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePeriod" ADD CONSTRAINT "ServicePeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOnboarding" ADD CONSTRAINT "CompanyOnboarding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
