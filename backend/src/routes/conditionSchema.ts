import { Router, Request, Response } from "express";
import { schemaBuilder } from "../services/conditionSchema";

const router = Router();

/**
 * Get condition schema for workflow builder
 * Returns available fields and operators for building conditions
 */
router.get(
  "/workflows/:workflowId/condition-schema",
  async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      const tenantId = (req as any).user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Build schema with base + custom + integration fields
      const schema = await schemaBuilder.buildSchema(tenantId, workflowId);

      // Group by category for easier UI rendering
      const grouped = schemaBuilder.groupByCategory(schema);

      res.json({
        fields: schema,
        grouped,
        categories: Object.keys(grouped).sort(),
      });
    } catch (error) {
      console.error("Error fetching condition schema:", error);
      res.status(500).json({ error: "Failed to fetch condition schema" });
    }
  }
);

/**
 * Get condition schema without workflow context
 * Returns only base fields (used for new workflows)
 */
router.get("/condition-schema", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Build schema with base + custom fields only (no workflow-specific)
    const schema = await schemaBuilder.buildSchema(tenantId);

    // Group by category
    const grouped = schemaBuilder.groupByCategory(schema);

    res.json({
      fields: schema,
      grouped,
      categories: Object.keys(grouped).sort(),
    });
  } catch (error) {
    console.error("Error fetching condition schema:", error);
    res.status(500).json({ error: "Failed to fetch condition schema" });
  }
});

export default router;
