import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// Middleware to check super admin
const requireSuperAdmin = (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
};

// GET /api/plans - Get all plans (super admin only)
router.get("/", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { name: "asc" },
    });
    res.json(plans);
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// GET /api/plans/:id - Get a specific plan (super admin only)
router.get("/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    res.json(plan);
  } catch (error) {
    console.error("Error fetching plan:", error);
    res.status(500).json({ error: "Failed to fetch plan" });
  }
});

// POST /api/plans - Create a new plan (super admin only)
router.post("/", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const {
      name,
      documentLimit,
      docSizeLimitMB,
      pricingDiscount,
      fallbackMarkup,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Plan name is required" });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        documentLimit: documentLimit ?? 5,
        docSizeLimitMB: docSizeLimitMB ?? 10,
        pricingDiscount: pricingDiscount ?? 0.0,
        fallbackMarkup: fallbackMarkup ?? 0.5,
      },
    });

    res.status(201).json(plan);
  } catch (error: any) {
    console.error("Error creating plan:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Plan name already exists" });
    }
    res.status(500).json({ error: "Failed to create plan" });
  }
});

// PUT /api/plans/:id - Update a plan (super admin only)
router.put("/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      documentLimit,
      docSizeLimitMB,
      pricingDiscount,
      fallbackMarkup,
    } = req.body;

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(documentLimit !== undefined && { documentLimit }),
        ...(docSizeLimitMB !== undefined && { docSizeLimitMB }),
        ...(pricingDiscount !== undefined && { pricingDiscount }),
        ...(fallbackMarkup !== undefined && { fallbackMarkup }),
      },
    });

    res.json(plan);
  } catch (error: any) {
    console.error("Error updating plan:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Plan name already exists" });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.status(500).json({ error: "Failed to update plan" });
  }
});

// DELETE /api/plans/:id - Delete a plan (super admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      await prisma.plan.delete({
        where: { id },
      });

      res.json({ message: "Plan deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting plan:", error);
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Plan not found" });
      }
      res.status(500).json({ error: "Failed to delete plan" });
    }
  }
);

export default router;
