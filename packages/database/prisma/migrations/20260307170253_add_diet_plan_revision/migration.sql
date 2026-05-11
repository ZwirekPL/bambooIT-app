-- CreateEnum
CREATE TYPE "DietPlanRevisionReason" AS ENUM ('AI_GENERATED', 'AUTO_ADJUST', 'DIETITIAN_EDIT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "DietPlanRevision" (
    "id" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "createdBy" TEXT,
    "reason" "DietPlanRevisionReason" NOT NULL,
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DietPlanRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DietPlanRevision_dietPlanId_idx" ON "DietPlanRevision"("dietPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "DietPlanRevision_dietPlanId_revisionNumber_key" ON "DietPlanRevision"("dietPlanId", "revisionNumber");

-- AddForeignKey
ALTER TABLE "DietPlanRevision" ADD CONSTRAINT "DietPlanRevision_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
