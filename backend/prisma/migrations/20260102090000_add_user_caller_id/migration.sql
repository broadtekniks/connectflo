-- Add per-user default caller ID phone number

ALTER TABLE "User" ADD COLUMN "callerIdPhoneNumberId" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_callerIdPhoneNumberId_fkey"
FOREIGN KEY ("callerIdPhoneNumberId") REFERENCES "PhoneNumber"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "User_callerIdPhoneNumberId_idx"
ON "User"("callerIdPhoneNumberId");
