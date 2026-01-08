-- CreateTable
CREATE TABLE "CrmConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "crmType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "config" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmDiscoveredField" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "picklistValues" JSONB,
    "description" TEXT,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "lastDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmDiscoveredField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmFieldMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "crmField" TEXT NOT NULL,
    "internalField" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'both',
    "transformFunction" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSyncRecord" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmSyncRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSyncJob" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "objectType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "result" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmWebhookSubscription" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "webhookId" TEXT,
    "objectType" TEXT NOT NULL,
    "eventTypes" TEXT[],
    "webhookUrl" TEXT NOT NULL,
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmWebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmConnection_tenantId_idx" ON "CrmConnection"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmConnection_tenantId_crmType_key" ON "CrmConnection"("tenantId", "crmType");

-- CreateIndex
CREATE INDEX "CrmDiscoveredField_connectionId_objectType_idx" ON "CrmDiscoveredField"("connectionId", "objectType");

-- CreateIndex
CREATE UNIQUE INDEX "CrmDiscoveredField_connectionId_objectType_fieldName_key" ON "CrmDiscoveredField"("connectionId", "objectType", "fieldName");

-- CreateIndex
CREATE INDEX "CrmFieldMapping_connectionId_idx" ON "CrmFieldMapping"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmFieldMapping_connectionId_objectType_crmField_key" ON "CrmFieldMapping"("connectionId", "objectType", "crmField");

-- CreateIndex
CREATE INDEX "CrmSyncRecord_connectionId_objectType_idx" ON "CrmSyncRecord"("connectionId", "objectType");

-- CreateIndex
CREATE INDEX "CrmSyncRecord_internalId_idx" ON "CrmSyncRecord"("internalId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmSyncRecord_connectionId_objectType_crmId_key" ON "CrmSyncRecord"("connectionId", "objectType", "crmId");

-- CreateIndex
CREATE INDEX "CrmSyncJob_connectionId_status_scheduledAt_idx" ON "CrmSyncJob"("connectionId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "CrmWebhookSubscription_connectionId_idx" ON "CrmWebhookSubscription"("connectionId");

-- AddForeignKey
ALTER TABLE "CrmConnection" ADD CONSTRAINT "CrmConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmDiscoveredField" ADD CONSTRAINT "CrmDiscoveredField_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CrmConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmFieldMapping" ADD CONSTRAINT "CrmFieldMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CrmConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSyncRecord" ADD CONSTRAINT "CrmSyncRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CrmConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSyncJob" ADD CONSTRAINT "CrmSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CrmConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWebhookSubscription" ADD CONSTRAINT "CrmWebhookSubscription_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CrmConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
