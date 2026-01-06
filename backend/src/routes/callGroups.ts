import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

const canView = (role: string | undefined) =>
  role === "TENANT_ADMIN" || role === "AGENT";

const canManage = (role: string | undefined) => role === "TENANT_ADMIN";

router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!canView(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const groups = await (prisma as any).callGroup.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          orderBy: { order: "asc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isCheckedIn: true,
                checkedInAt: true,
                agentTimeZone: true,
                workingHours: true,
                forwardingPhoneNumber: true,
              },
            },
          },
        },
      },
    });

    res.json(
      groups.map((g: any) => ({
        ...g,
        members: g.members.map((m: any) => ({
          ...m,
          user: {
            ...m.user,
            checkedInAt: m.user.checkedInAt
              ? m.user.checkedInAt.toISOString()
              : null,
          },
        })),
      }))
    );
  } catch (error) {
    console.error("Error fetching call groups:", error);
    res.status(500).json({ error: "Failed to fetch call groups" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!canManage(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const ringStrategyRaw =
      typeof req.body?.ringStrategy === "string"
        ? req.body.ringStrategy.trim().toUpperCase()
        : "SEQUENTIAL";

    const ringStrategy =
      ringStrategyRaw === "SIMULTANEOUS" ? "SIMULTANEOUS" : "SEQUENTIAL";

    const ringTimeoutSecondsInput = Number(req.body?.ringTimeoutSeconds);
    const ringTimeoutSeconds = Number.isFinite(ringTimeoutSecondsInput)
      ? Math.min(60, Math.max(5, Math.floor(ringTimeoutSecondsInput)))
      : 20;

    const memberUserIds = Array.isArray(req.body?.memberUserIds)
      ? (req.body.memberUserIds as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0
        )
      : [];

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const group = await (prisma as any).callGroup.create({
      data: {
        tenantId,
        name,
        ringStrategy,
        ringTimeoutSeconds,
        members: {
          create: memberUserIds.map((userId, idx) => ({
            tenantId,
            userId,
            order: idx,
          })),
        },
      },
      include: {
        members: {
          orderBy: { order: "asc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    res.json(group);
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return res
        .status(400)
        .json({ error: "A call group with that name already exists" });
    }

    console.error("Error creating call group:", error);
    res.status(500).json({ error: "Failed to create call group" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;
    const groupId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!canManage(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const existing = await (prisma as any).callGroup.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Call group not found" });
    }

    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
    const ringStrategyRaw =
      typeof req.body?.ringStrategy === "string"
        ? req.body.ringStrategy.trim().toUpperCase()
        : undefined;

    const ringStrategy =
      ringStrategyRaw === undefined
        ? undefined
        : ringStrategyRaw === "SIMULTANEOUS"
        ? "SIMULTANEOUS"
        : "SEQUENTIAL";

    const ringTimeoutSecondsInput = req.body?.ringTimeoutSeconds;
    const ringTimeoutSeconds =
      ringTimeoutSecondsInput === undefined
        ? undefined
        : (() => {
            const v = Number(ringTimeoutSecondsInput);
            if (!Number.isFinite(v)) return undefined;
            return Math.min(60, Math.max(5, Math.floor(v)));
          })();

    const memberUserIds = Array.isArray(req.body?.memberUserIds)
      ? (req.body.memberUserIds as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0
        )
      : undefined;

    const updated = await (prisma as any).callGroup.update({
      where: { id: groupId },
      data: {
        ...(typeof name === "string" && name ? { name } : {}),
        ...(typeof ringStrategy === "string" ? { ringStrategy } : {}),
        ...(typeof ringTimeoutSeconds === "number"
          ? { ringTimeoutSeconds }
          : {}),
        ...(memberUserIds
          ? {
              members: {
                deleteMany: {},
                create: memberUserIds.map((userId, idx) => ({
                  tenantId,
                  userId,
                  order: idx,
                })),
              },
            }
          : {}),
      },
      include: {
        members: {
          orderBy: { order: "asc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    res.json(updated);
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return res
        .status(400)
        .json({ error: "A call group with that name already exists" });
    }

    console.error("Error updating call group:", error);
    res.status(500).json({ error: "Failed to update call group" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;
    const groupId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!canManage(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const existing = await (prisma as any).callGroup.findFirst({
      where: { id: groupId, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Call group not found" });
    }

    await (prisma as any).callGroup.delete({ where: { id: groupId } });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting call group:", error);
    res.status(500).json({ error: "Failed to delete call group" });
  }
});

export default router;
