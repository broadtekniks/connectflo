-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Integration" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PhoneNumber" ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Workflow" ALTER COLUMN "tenantId" DROP DEFAULT;

-- Ensure a real "default" tenant exists so legacy rows remain valid.
-- (Tenant.id is stored as TEXT, so 'default' is a valid key.)
INSERT INTO "Tenant" ("id", "name", "slug", "plan", "status", "createdAt", "updatedAt")
VALUES ('default', 'Default', 'default', 'STARTER', 'ACTIVE', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Normalize any orphan tenantId values to 'default' before adding FKs.
UPDATE "Conversation" c
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = c."tenantId");

UPDATE "Message" m
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = m."tenantId");

UPDATE "Document" d
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = d."tenantId");

UPDATE "DocumentChunk" dc
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = dc."tenantId");

UPDATE "Integration" i
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = i."tenantId");

UPDATE "Workflow" w
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = w."tenantId");

UPDATE "PhoneNumber" pn
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = pn."tenantId");

UPDATE "UsageRecord" ur
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = ur."tenantId");

UPDATE "WorkflowPhoneNumber" wpn
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = wpn."tenantId");

UPDATE "WorkflowDocument" wd
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = wd."tenantId");

UPDATE "WorkflowIntegration" wi
SET "tenantId" = 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id" = wi."tenantId");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_idx" ON "Conversation"("tenantId");

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "PhoneNumber_tenantId_idx" ON "PhoneNumber"("tenantId");

-- CreateIndex
CREATE INDEX "Workflow_tenantId_idx" ON "Workflow"("tenantId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowPhoneNumber" ADD CONSTRAINT "WorkflowPhoneNumber_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDocument" ADD CONSTRAINT "WorkflowDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowIntegration" ADD CONSTRAINT "WorkflowIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
