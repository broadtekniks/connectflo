import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { WorkflowEngine } from "../services/workflowEngine";

const router = Router();
const workflowEngine = new WorkflowEngine();

// Get all workflows
router.get("/", async (req: Request, res: Response) => {
  try {
    const workflows = await prisma.workflow.findMany({
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
  try {
    const { name, description, triggerType } = req.body;
    const workflow = await prisma.workflow.create({
      data: {
        name: name || "Untitled Workflow",
        description: description || "",
        triggerType: triggerType || "Manual",
        nodes: [],
        edges: [],
        isActive: false,
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
  try {
    const { id } = req.params;
    const { nodes, edges, name, description, isActive, triggerType } = req.body;

    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        nodes,
        edges,
        name,
        description,
        isActive,
        triggerType,
      },
    });
    res.json(workflow);
  } catch (error) {
    console.error("Failed to update workflow:", error);
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

// Simulate trigger
router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const { triggerType, context } = req.body;
    console.log("Simulating workflow trigger:", triggerType);

    // Fire and forget - don't wait for full execution
    workflowEngine.trigger(triggerType, context).catch((err) => {
      console.error("Async simulation error:", err);
    });

    res.json({ success: true, message: "Simulation started" });
  } catch (error) {
    console.error("Simulation request failed:", error);
    res.status(500).json({ error: "Simulation failed" });
  }
});

export default router;
