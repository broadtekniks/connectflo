-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "externalForwardingAllowList" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "restrictExternalForwarding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "forwardingPhoneNumber" TEXT;

-- CreateTable
CREATE TABLE "CallGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ringStrategy" TEXT NOT NULL DEFAULT 'SEQUENTIAL',
    "ringTimeoutSeconds" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallGroupMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallGroup_tenantId_idx" ON "CallGroup"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CallGroup_tenantId_name_key" ON "CallGroup"("tenantId", "name");

-- CreateIndex
CREATE INDEX "CallGroupMember_tenantId_idx" ON "CallGroupMember"("tenantId");

-- CreateIndex
CREATE INDEX "CallGroupMember_callGroupId_idx" ON "CallGroupMember"("callGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "CallGroupMember_callGroupId_userId_key" ON "CallGroupMember"("callGroupId", "userId");

-- AddForeignKey
ALTER TABLE "CallGroup" ADD CONSTRAINT "CallGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallGroupMember" ADD CONSTRAINT "CallGroupMember_callGroupId_fkey" FOREIGN KEY ("callGroupId") REFERENCES "CallGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallGroupMember" ADD CONSTRAINT "CallGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
