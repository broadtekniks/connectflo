-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "maxDocumentsPerWorkflow" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "maxIntegrationsPerWorkflow" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "maxPhoneNumbersPerWorkflow" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "maxWorkflows" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "aiConfigId" TEXT;

-- CreateTable
CREATE TABLE "WorkflowPhoneNumber" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowPhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDocument" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowIntegration" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowPhoneNumber_workflowId_idx" ON "WorkflowPhoneNumber"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowPhoneNumber_phoneNumberId_idx" ON "WorkflowPhoneNumber"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowPhoneNumber_workflowId_phoneNumberId_key" ON "WorkflowPhoneNumber"("workflowId", "phoneNumberId");

-- CreateIndex
CREATE INDEX "WorkflowDocument_workflowId_idx" ON "WorkflowDocument"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowDocument_documentId_idx" ON "WorkflowDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDocument_workflowId_documentId_key" ON "WorkflowDocument"("workflowId", "documentId");

-- CreateIndex
CREATE INDEX "WorkflowIntegration_workflowId_idx" ON "WorkflowIntegration"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowIntegration_integrationId_idx" ON "WorkflowIntegration"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowIntegration_workflowId_integrationId_key" ON "WorkflowIntegration"("workflowId", "integrationId");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_aiConfigId_fkey" FOREIGN KEY ("aiConfigId") REFERENCES "AiConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowPhoneNumber" ADD CONSTRAINT "WorkflowPhoneNumber_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowPhoneNumber" ADD CONSTRAINT "WorkflowPhoneNumber_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDocument" ADD CONSTRAINT "WorkflowDocument_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDocument" ADD CONSTRAINT "WorkflowDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowIntegration" ADD CONSTRAINT "WorkflowIntegration_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowIntegration" ADD CONSTRAINT "WorkflowIntegration_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
