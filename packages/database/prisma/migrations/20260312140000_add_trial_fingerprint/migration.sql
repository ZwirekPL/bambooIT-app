-- CreateTable
CREATE TABLE "TrialFingerprint" (
    "id" TEXT NOT NULL,
    "cardFingerprint" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialFingerprint_cardFingerprint_key" ON "TrialFingerprint"("cardFingerprint");

-- CreateIndex
CREATE INDEX "TrialFingerprint_userId_idx" ON "TrialFingerprint"("userId");

-- AddForeignKey
ALTER TABLE "TrialFingerprint" ADD CONSTRAINT "TrialFingerprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
