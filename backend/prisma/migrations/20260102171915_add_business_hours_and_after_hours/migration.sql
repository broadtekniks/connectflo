-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN     "afterHoursMessage" TEXT,
ADD COLUMN     "afterHoursMode" TEXT DEFAULT 'VOICEMAIL',
ADD COLUMN     "afterHoursNotifyUserId" TEXT,
ADD COLUMN     "afterHoursWorkflowId" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "businessTimeZone" TEXT,
ADD COLUMN     "chatAfterHoursMessage" TEXT,
ADD COLUMN     "chatAfterHoursMode" TEXT DEFAULT 'ONLY_ON_ESCALATION';

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_afterHoursWorkflowId_fkey" FOREIGN KEY ("afterHoursWorkflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_afterHoursNotifyUserId_fkey" FOREIGN KEY ("afterHoursNotifyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
