-- Add persisted agent check-in status

ALTER TABLE "User" ADD COLUMN "isCheckedIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "checkedInAt" TIMESTAMP(3);
