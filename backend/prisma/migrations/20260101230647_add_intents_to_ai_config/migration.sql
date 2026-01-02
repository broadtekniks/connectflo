/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,provider,type]` on the table `Integration` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider` to the `Integration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Integration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AiConfig" ADD COLUMN     "intents" JSONB;

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "credentials" JSONB,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ALTER COLUMN "icon" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "category" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Integration_tenantId_provider_type_key" ON "Integration"("tenantId", "provider", "type");
