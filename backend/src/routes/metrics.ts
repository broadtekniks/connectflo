import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

const requireAgent = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const role = authReq.user?.role as string | undefined;

  if (!authReq.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (role !== "AGENT") {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};

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

router.get("/agent", requireAgent, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const userId = authReq.user?.userId as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      assignedActiveConversations,
      assignedOpenConversations,
      assignedPendingConversations,
      resolvedToday,
      agentMessagesToday,
      voiceUsageToday,
      me,
    ] = await Promise.all([
      prisma.conversation.count({
        where: {
          tenantId,
          assigneeId: userId,
          status: { in: ["OPEN", "PENDING"] },
        },
      }),
      prisma.conversation.count({
        where: { tenantId, assigneeId: userId, status: "OPEN" },
      }),
      prisma.conversation.count({
        where: { tenantId, assigneeId: userId, status: "PENDING" },
      }),
      prisma.conversation.count({
        where: {
          tenantId,
          assigneeId: userId,
          status: "RESOLVED",
          updatedAt: { gte: startOfToday },
        },
      }),
      prisma.message.count({
        where: {
          tenantId,
          sender: "AGENT",
          createdAt: { gte: startOfToday },
          conversation: {
            assigneeId: userId,
          },
        },
      }),
      prisma.usageRecord.aggregate({
        where: {
          tenantId,
          userId,
          createdAt: { gte: startOfToday },
          type: { in: ["VOICE_INBOUND", "VOICE_OUTBOUND"] },
        },
        _count: { id: true },
        _sum: { durationSeconds: true },
      }),
      prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { isCheckedIn: true, checkedInAt: true },
      }),
    ]);

    const voiceCallsToday = voiceUsageToday?._count?.id ?? 0;
    const voiceSecondsToday = voiceUsageToday?._sum?.durationSeconds ?? 0;
    const voiceMinutesToday = Math.round(voiceSecondsToday / 60);

    res.json({
      assignedActiveConversations,
      assignedOpenConversations,
      assignedPendingConversations,
      resolvedToday,
      agentMessagesToday,
      voiceCallsToday,
      voiceMinutesToday,
      isCheckedIn: Boolean(me?.isCheckedIn),
      checkedInAt: me?.checkedInAt ? me.checkedInAt.toISOString() : null,
    });
  } catch (error) {
    console.error("Error fetching agent metrics:", error);
    res.status(500).json({ error: "Failed to fetch agent metrics" });
  }
});

export default router;
