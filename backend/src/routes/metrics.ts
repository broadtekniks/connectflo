import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    const [
      totalConversations,
      openConversations,
      resolvedConversations,
      totalMessages,
      customersCount,
    ] = await Promise.all([
      prisma.conversation.count({ where: { tenantId } }),
      prisma.conversation.count({ where: { tenantId, status: "OPEN" } }),
      prisma.conversation.count({ where: { tenantId, status: "RESOLVED" } }),
      prisma.message.count({
        where: {
          conversation: {
            tenantId,
          },
        },
      }),
      prisma.user.count({ where: { tenantId, role: "CUSTOMER" } }),
    ]);

    // Calculate some derived metrics
    const resolutionRate =
      totalConversations > 0
        ? Math.round((resolvedConversations / totalConversations) * 100)
        : 0;

    res.json({
      totalConversations,
      openConversations,
      resolvedConversations,
      totalMessages,
      customersCount,
      resolutionRate,
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

export default router;
