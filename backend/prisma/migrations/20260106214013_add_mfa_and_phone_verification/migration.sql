-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" TEXT,
ADD COLUMN     "phoneVerificationCode" TEXT,
ADD COLUMN     "phoneVerificationExpiry" TIMESTAMP(3),
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
