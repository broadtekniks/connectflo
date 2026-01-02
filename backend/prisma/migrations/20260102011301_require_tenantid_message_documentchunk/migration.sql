/*
  Warnings:

  - Made the column `tenantId` on table `DocumentChunk` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Message` required. This step will fail if there are existing NULL values in that column.

*/

-- Backfill tenantId for existing rows (idempotent)

-- Message.tenantId <- Conversation.tenantId
UPDATE "Message" AS m
SET "tenantId" = c."tenantId"
FROM "Conversation" AS c
WHERE m."tenantId" IS NULL
  AND m."conversationId" = c."id";

-- DocumentChunk.tenantId <- Document.tenantId
UPDATE "DocumentChunk" AS dc
SET "tenantId" = d."tenantId"
FROM "Document" AS d
WHERE dc."tenantId" IS NULL
  AND dc."documentId" = d."id";

-- AlterTable
ALTER TABLE "DocumentChunk" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "tenantId" SET NOT NULL;
