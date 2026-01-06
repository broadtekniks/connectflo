import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// List all lead captures
router.get("/", async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const { status, source, limit = 100, offset = 0 } = req.query;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (source) where.source = source;

    const [leads, total] = await Promise.all([
      prisma.leadCapture.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.leadCapture.count({ where }),
    ]);

    res.json({ leads, total });
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// Update lead status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = (req as any).user?.tenantId;

    if (
      !["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"].includes(status)
    ) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const lead = await prisma.leadCapture.update({
      where: { id, tenantId },
      data: { status },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ lead });
  } catch (error) {
    console.error("Failed to update lead status:", error);
    res.status(500).json({ error: "Failed to update lead status" });
  }
});

export default router;
