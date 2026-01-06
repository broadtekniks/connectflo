import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import {
  isValidTimeZone as isValidScheduleTimeZone,
  normalizeWorkingHoursConfig,
} from "../services/agentSchedule";

const router = Router();

type TeamMemberResponseRow = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  tenantId: string | null;
  createdAt: Date;
  isCheckedIn: boolean;
  checkedInAt: Date | null;
  agentTimeZone?: string | null;
  workingHours?: unknown | null;
  forwardingPhoneNumber?: string | null;
};

router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Tenant admins and agents can view team schedules.
    if (role !== "TENANT_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const members = (await prisma.user.findMany({
      where: {
        tenantId,
        role: {
          in: ["TENANT_ADMIN", "AGENT"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        tenantId: true,
        createdAt: true,
        isCheckedIn: true,
        checkedInAt: true,
        agentTimeZone: true,
        workingHours: true,
        forwardingPhoneNumber: true,
      } as any,
    })) as unknown as TeamMemberResponseRow[];

    res.json(
      members.map((m) => ({
        ...m,
        checkedInAt: m.checkedInAt ? m.checkedInAt.toISOString() : null,
      }))
    );
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

router.put("/:id/forwarding-number", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;
    const userId = authReq.user?.userId as string | undefined;
    const targetUserId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (role === "AGENT") {
      if (!userId || userId !== targetUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: { id: true, role: true },
    });

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    if (target.role !== "TENANT_ADMIN" && target.role !== "AGENT") {
      return res
        .status(400)
        .json({ error: "Only agents and admins can have forwarding numbers" });
    }

    const raw = req.body?.forwardingPhoneNumber;
    const value = typeof raw === "string" ? raw.trim() : "";

    if (value && value.length > 32) {
      return res.status(400).json({ error: "Invalid forwarding phone number" });
    }

    // Very lightweight validation: allow + and digits only (E.164-ish)
    if (value && !/^\+?[0-9]{7,15}$/.test(value.replace(/\s+/g, ""))) {
      return res
        .status(400)
        .json({ error: "Forwarding number must be in E.164 format" });
    }

    const cleaned = value ? value.replace(/\s+/g, "") : null;

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { forwardingPhoneNumber: cleaned } as any,
      select: { id: true, forwardingPhoneNumber: true } as any,
    });

    return res.json(updated);
  } catch (error) {
    console.error("Error updating forwarding number:", error);
    return res
      .status(500)
      .json({ error: "Failed to update forwarding number" });
  }
});

router.put("/:id/schedule", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;
    const userId = authReq.user?.userId as string | undefined;
    const targetUserId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (role === "AGENT") {
      if (!userId || userId !== targetUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: { id: true, role: true },
    });

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    if (target.role !== "TENANT_ADMIN" && target.role !== "AGENT") {
      return res
        .status(400)
        .json({ error: "Only agents and admins can have working hours" });
    }

    const rawTz = req.body?.agentTimeZone;
    const tz = typeof rawTz === "string" ? rawTz.trim() : "";
    if (tz && tz.length > 128) {
      return res.status(400).json({ error: "Invalid time zone" });
    }
    if (tz && !isValidScheduleTimeZone(tz)) {
      return res.status(400).json({ error: "Invalid time zone" });
    }

    const normalizedWorkingHours = normalizeWorkingHoursConfig(
      (req.body as any)?.workingHours
    );

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        agentTimeZone: tz || null,
        workingHours: normalizedWorkingHours as any,
      } as any,
      select: {
        id: true,
        agentTimeZone: true,
        workingHours: true,
      } as any,
    });

    return res.json(updated);
  } catch (error) {
    console.error("Error updating team member schedule:", error);
    return res.status(500).json({ error: "Failed to update schedule" });
  }
});

export default router;
