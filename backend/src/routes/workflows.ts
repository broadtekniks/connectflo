import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { WorkflowEngine } from "../services/workflowEngine";
import { AuthRequest } from "../middleware/auth";

const router = Router();
const workflowEngine = new WorkflowEngine();

// Get all workflows
router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    const workflows = await prisma.workflow.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(workflows);
  } catch (error) {
    console.error("Failed to fetch workflows:", error);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

// Create new workflow
router.post("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { name, description, triggerType } = req.body;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    const workflow = await prisma.workflow.create({
      data: {
        name: name || "Untitled Workflow",
        description: description || "",
        triggerType: triggerType || "Manual",
        nodes: [],
        edges: [],
        isActive: false,
        tenantId,
      },
    });
    res.json(workflow);
  } catch (error) {
    console.error("Failed to create workflow:", error);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

// Update workflow (Save)
router.put("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const { nodes, edges, name, description, isActive, triggerType } = req.body;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify ownership
    const existing = await prisma.workflow.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const result = await prisma.workflow.updateMany({
      where: { id, tenantId },
      data: {
        nodes,
        edges,
        name,
        description,
        isActive,
        triggerType,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const workflow = await prisma.workflow.findFirst({
      where: { id, tenantId },
    });
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json(workflow);
  } catch (error) {
    console.error("Failed to update workflow:", error);
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

// Delete workflow
router.delete("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify ownership
    const existing = await prisma.workflow.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const result = await prisma.workflow.deleteMany({
      where: { id, tenantId },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json({ success: true, message: "Workflow deleted" });
  } catch (error) {
    console.error("Failed to delete workflow:", error);
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

// Simulate trigger
router.post("/simulate", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { triggerType, context } = req.body;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Add tenantId to context for tenant-aware execution
    const enhancedContext = { ...context, tenantId };

    // Fire and forget - don't wait for full execution
    workflowEngine.trigger(triggerType, enhancedContext).catch((err) => {
      console.error("Async simulation error:", err);
    });

    res.json({ success: true, message: "Simulation started" });
  } catch (error) {
    console.error("Simulation request failed:", error);
    res.status(500).json({ error: "Simulation failed" });
  }
});

export default router;
