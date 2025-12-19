import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { usageService } from "../services/usage";

const router = Router();

// GET /api/usage/summary - Get usage summary for tenant
router.get("/summary", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    // Get date range from query params or default to current month
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const summary = await usageService.getTenantUsageSummary(
      tenantId,
      startDate,
      endDate
    );

    res.json(summary);
  } catch (error) {
    console.error("Error fetching usage summary:", error);
    res.status(500).json({ error: "Failed to fetch usage summary" });
  }
});

// GET /api/usage/records - Get detailed usage records
router.get("/records", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;
    const type = req.query.type as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await usageService.getTenantUsageRecords(tenantId, {
      startDate,
      endDate,
      type,
      limit,
      offset,
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching usage records:", error);
    res.status(500).json({ error: "Failed to fetch usage records" });
  }
});

// GET /api/usage/breakdown - Get usage breakdown by type
router.get("/breakdown", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const breakdown = await usageService.getUsageBreakdown(
      tenantId,
      startDate,
      endDate
    );

    res.json(breakdown);
  } catch (error) {
    console.error("Error fetching usage breakdown:", error);
    res.status(500).json({ error: "Failed to fetch usage breakdown" });
  }
});

export default router;
