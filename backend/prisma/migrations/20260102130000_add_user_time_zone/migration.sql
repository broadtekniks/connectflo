-- Add optional per-user time zone preference
ALTER TABLE "User" ADD COLUMN "timeZone" TEXT;
