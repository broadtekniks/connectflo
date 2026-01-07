/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,extension]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "WebPhoneStatus" AS ENUM ('ONLINE', 'BUSY', 'AWAY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('EXTERNAL', 'INTERNAL_VOIP', 'INTERNAL_PSTN');

-- AlterTable
ALTER TABLE "CallLog" ADD COLUMN     "callType" "CallType" NOT NULL DEFAULT 'EXTERNAL',
ADD COLUMN     "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "fromExtension" VARCHAR(10),
ADD COLUMN     "fromUserId" TEXT,
ADD COLUMN     "toExtension" VARCHAR(10),
ADD COLUMN     "toUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "extension" VARCHAR(10),
ADD COLUMN     "extensionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "extensionLabel" VARCHAR(100),
ADD COLUMN     "webPhoneLastSeen" TIMESTAMP(3),
ADD COLUMN     "webPhoneStatus" "WebPhoneStatus" NOT NULL DEFAULT 'OFFLINE';

-- CreateIndex
CREATE INDEX "CallLog_fromExtension_idx" ON "CallLog"("fromExtension");

-- CreateIndex
CREATE INDEX "CallLog_toExtension_idx" ON "CallLog"("toExtension");

-- CreateIndex
CREATE INDEX "CallLog_fromUserId_idx" ON "CallLog"("fromUserId");

-- CreateIndex
CREATE INDEX "CallLog_toUserId_idx" ON "CallLog"("toUserId");

-- CreateIndex
CREATE INDEX "User_extension_idx" ON "User"("extension");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_extension_key" ON "User"("tenantId", "extension");
