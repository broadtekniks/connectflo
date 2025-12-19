-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('VOICE_INBOUND', 'VOICE_OUTBOUND', 'SMS_INBOUND', 'SMS_OUTBOUND', 'MMS_INBOUND', 'MMS_OUTBOUND', 'AI_TOKENS_INPUT', 'AI_TOKENS_OUTPUT', 'AI_EMBEDDING', 'STORAGE_GB');

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "UsageType" NOT NULL,
    "phoneNumberId" TEXT,
    "callSid" TEXT,
    "durationSeconds" INTEGER,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "messageCount" INTEGER,
    "messageId" TEXT,
    "wholesaleCost" DOUBLE PRECISION NOT NULL,
    "retailCost" DOUBLE PRECISION NOT NULL,
    "markup" DOUBLE PRECISION NOT NULL,
    "conversationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageRecord_tenantId_createdAt_idx" ON "UsageRecord"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageRecord_userId_createdAt_idx" ON "UsageRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageRecord_type_createdAt_idx" ON "UsageRecord"("type", "createdAt");

-- CreateIndex
CREATE INDEX "UsageRecord_conversationId_idx" ON "UsageRecord"("conversationId");

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
