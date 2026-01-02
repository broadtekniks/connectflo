-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "DocumentChunk_tenantId_idx" ON "DocumentChunk"("tenantId");

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- CreateIndex
CREATE INDEX "Message_tenantId_createdAt_idx" ON "Message"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
