/*
  Warnings:

  - Made the column `tenantId` on table `WorkflowDocument` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `WorkflowIntegration` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `WorkflowPhoneNumber` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "WorkflowDocument" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "WorkflowIntegration" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "WorkflowPhoneNumber" ALTER COLUMN "tenantId" SET NOT NULL;
