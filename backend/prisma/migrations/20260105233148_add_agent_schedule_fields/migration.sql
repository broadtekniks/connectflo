-- DropForeignKey
ALTER TABLE "Workflow" DROP CONSTRAINT "Workflow_assignedAgentId_fkey";

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
