-- Backfill tenantId for existing rows that were created before tenantId was added.

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
