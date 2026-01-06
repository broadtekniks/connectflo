-- Add working hours and timezone to User (for agents)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workingHours" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agentTimeZone" TEXT;

-- Add assigned agent to Workflow
ALTER TABLE "Workflow" ADD COLUMN IF NOT EXISTS "assignedAgentId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_assignedAgentId_fkey" 
  FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Create index for assigned agent
CREATE INDEX IF NOT EXISTS "Workflow_assignedAgentId_idx" ON "Workflow"("assignedAgentId");
