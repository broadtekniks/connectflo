-- Add tenant-level Web Phone outbound caller settings
ALTER TABLE "Tenant"
  ADD COLUMN "webPhoneOutboundCallerNumber" TEXT,
  ADD COLUMN "webPhoneOutboundCallerName" TEXT;
