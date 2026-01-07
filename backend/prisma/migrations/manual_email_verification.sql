-- Add email verification fields to User table
-- Run this migration: npx prisma migrate dev --name add_email_verification

ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS "verificationTokenExpiry" TIMESTAMP;

-- Auto-verify existing users (optional - comment out if you want to require verification)
UPDATE "User" SET "emailVerified" = true WHERE "password" IS NULL; -- OAuth users
-- UPDATE "User" SET "emailVerified" = true WHERE "createdAt" < NOW(); -- All existing users
