-- Add persistent system-wide phone voice preference to Tenant
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "phoneVoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneVoiceLanguage" TEXT;
