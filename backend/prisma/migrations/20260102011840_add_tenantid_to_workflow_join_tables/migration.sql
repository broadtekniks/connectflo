-- AlterTable
ALTER TABLE "WorkflowDocument" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowIntegration" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowPhoneNumber" ADD COLUMN     "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "WorkflowDocument_tenantId_idx" ON "WorkflowDocument"("tenantId");

-- CreateIndex
CREATE INDEX "WorkflowIntegration_tenantId_idx" ON "WorkflowIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "WorkflowPhoneNumber_tenantId_idx" ON "WorkflowPhoneNumber"("tenantId");
