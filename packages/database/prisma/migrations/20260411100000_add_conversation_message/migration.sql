-- 79.1: Patient ↔ Dietitian async chat

-- CreateTable Conversation
CREATE TABLE "Conversation" (
    "id"                  TEXT NOT NULL,
    "patientId"           TEXT NOT NULL,
    "dietitianId"         TEXT NOT NULL,
    "lastMessageAt"       TIMESTAMP(3),
    "unreadCountPatient"  INTEGER NOT NULL DEFAULT 0,
    "unreadCountDietitian" INTEGER NOT NULL DEFAULT 0,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable Message
CREATE TABLE "Message" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId"       TEXT NOT NULL,
    "senderRole"     VARCHAR(20) NOT NULL,
    "content"        TEXT NOT NULL,
    "readAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique pair + query indexes)
CREATE UNIQUE INDEX "Conversation_patientId_dietitianId_key" ON "Conversation"("patientId", "dietitianId");
CREATE INDEX "Conversation_patientId_idx"      ON "Conversation"("patientId");
CREATE INDEX "Conversation_dietitianId_idx"    ON "Conversation"("dietitianId");
CREATE INDEX "Conversation_lastMessageAt_idx"  ON "Conversation"("lastMessageAt");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dietitianId_fkey"
    FOREIGN KEY ("dietitianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
