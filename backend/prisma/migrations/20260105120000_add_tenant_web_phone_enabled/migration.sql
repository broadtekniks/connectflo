-- Add tenant-level Web Phone feature flag

ALTER TABLE "Tenant" ADD COLUMN "webPhoneEnabled" BOOLEAN NOT NULL DEFAULT false;
