-- Add optional workflow-level phone voice override fields
ALTER TABLE "Workflow"
ADD COLUMN IF NOT EXISTS "phoneVoiceId" TEXT,
ADD COLUMN IF NOT EXISTS "phoneVoiceLanguage" TEXT;
