-- Backfill tenantId for workflow join tables from their workflow.

UPDATE "WorkflowDocument" wd
SET "tenantId" = w."tenantId"
FROM "Workflow" w
WHERE wd."tenantId" IS NULL
  AND wd."workflowId" = w."id";

UPDATE "WorkflowIntegration" wi
SET "tenantId" = w."tenantId"
FROM "Workflow" w
WHERE wi."tenantId" IS NULL
  AND wi."workflowId" = w."id";

UPDATE "WorkflowPhoneNumber" wpn
SET "tenantId" = w."tenantId"
FROM "Workflow" w
WHERE wpn."tenantId" IS NULL
  AND wpn."workflowId" = w."id";
