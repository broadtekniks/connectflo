-- Add phoneNumber to User table
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;

-- Create SmsOptOut table
CREATE TABLE "SmsOptOut" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "reason" TEXT,
    "optedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "SmsOptOut_tenantId_phoneNumber_key" ON "SmsOptOut"("tenantId", "phoneNumber");
CREATE INDEX "SmsOptOut_tenantId_idx" ON "SmsOptOut"("tenantId");
CREATE INDEX "SmsOptOut_phoneNumber_idx" ON "SmsOptOut"("phoneNumber");

-- Add foreign key
ALTER TABLE "SmsOptOut" ADD CONSTRAINT "SmsOptOut_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
