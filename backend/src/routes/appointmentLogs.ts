import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

// List all appointment logs
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

    const [appointmentLogs, total] = await Promise.all([
      prisma.appointmentLog.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { appointmentTime: "desc" },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.appointmentLog.count({ where }),
    ]);

    res.json({ appointmentLogs, total });
  } catch (error) {
    console.error("Failed to fetch appointment logs:", error);
    res.status(500).json({ error: "Failed to fetch appointment logs" });
  }
});

// Update appointment status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = (req as any).user?.tenantId;

    if (
      !["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(
        status
      )
    ) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const appointment = await prisma.appointmentLog.update({
      where: { id, tenantId },
      data: { status },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ appointment });
  } catch (error) {
    console.error("Failed to update appointment status:", error);
    res.status(500).json({ error: "Failed to update appointment status" });
  }
});

export default router;
