-- CreateEnum
CREATE TYPE "PhoneProvider" AS ENUM ('TELNYX', 'TWILIO');

-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN     "provider" "PhoneProvider" NOT NULL DEFAULT 'TELNYX';
