import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import type { Server } from "socket.io";

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

router.get("/me", requireAgent, async (req: Request, res: Response) => {
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

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isCheckedIn: true, checkedInAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      isCheckedIn: Boolean(user.isCheckedIn),
      checkedInAt: user.checkedInAt ? user.checkedInAt.toISOString() : null,
    });
  } catch (error) {
    console.error("Failed to fetch agent status:", error);
    res.status(500).json({ error: "Failed to fetch agent status" });
  }
});

router.post("/check-in", requireAgent, async (req: Request, res: Response) => {
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

    await prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { isCheckedIn: true, checkedInAt: new Date() },
    });

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isCheckedIn: true, checkedInAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const io = (req.app.get("io") as Server | undefined) ?? undefined;
    io?.to(`tenant:${tenantId}`).emit("team_member_checkin_updated", {
      userId,
      tenantId,
      isCheckedIn: Boolean(user.isCheckedIn),
      checkedInAt: user.checkedInAt ? user.checkedInAt.toISOString() : null,
    });

    res.json({
      isCheckedIn: Boolean(user.isCheckedIn),
      checkedInAt: user.checkedInAt ? user.checkedInAt.toISOString() : null,
    });
  } catch (error) {
    console.error("Failed to check in agent:", error);
    res.status(500).json({ error: "Failed to check in" });
  }
});

router.post("/check-out", requireAgent, async (req: Request, res: Response) => {
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

    await prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { isCheckedIn: false, checkedInAt: null },
    });

    const io = (req.app.get("io") as Server | undefined) ?? undefined;
    io?.to(`tenant:${tenantId}`).emit("team_member_checkin_updated", {
      userId,
      tenantId,
      isCheckedIn: false,
      checkedInAt: null,
    });

    res.json({ isCheckedIn: false, checkedInAt: null });
  } catch (error) {
    console.error("Failed to check out agent:", error);
    res.status(500).json({ error: "Failed to check out" });
  }
});

export default router;
