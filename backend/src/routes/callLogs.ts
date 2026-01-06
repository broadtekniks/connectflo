import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// List all call logs
router.get("/", async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const { direction, status, limit = 100, offset = 0 } = req.query;

    const where: any = { tenantId };
    if (direction) where.direction = direction;
    if (status) where.status = status;

    const [callLogs, total] = await Promise.all([
      prisma.callLog.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          phoneNumber: {
            select: { id: true, number: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.callLog.count({ where }),
    ]);

    res.json({ callLogs, total });
  } catch (error) {
    console.error("Failed to fetch call logs:", error);
    res.status(500).json({ error: "Failed to fetch call logs" });
  }
});

// Get single call log with details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;

    const callLog = await prisma.callLog.findUnique({
      where: { id, tenantId },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        phoneNumber: {
          select: { id: true, number: true },
        },
      },
    });

    if (!callLog) {
      return res.status(404).json({ error: "Call log not found" });
    }

    res.json({ callLog });
  } catch (error) {
    console.error("Failed to fetch call log:", error);
    res.status(500).json({ error: "Failed to fetch call log" });
  }
});

export default router;
