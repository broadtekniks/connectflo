import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import {
  isValidTimeZone as isValidScheduleTimeZone,
  normalizeWorkingHoursConfig,
} from "../services/agentSchedule";

const router = Router();

const isValidTimeZone = (tz: string): boolean => {
  try {
    // Will throw RangeError for unknown time zone IDs
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

router.get("/profile", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const userId = authReq.user?.userId as string | undefined;

    if (!userId) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ timeZone: (user as any)?.timeZone || null });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/profile", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const userId = authReq.user?.userId as string | undefined;

    if (!userId) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    const raw = req.body?.timeZone as string | null | undefined;
    const timeZone = typeof raw === "string" ? raw.trim() : null;

    if (timeZone && timeZone.length > 128) {
      return res.status(400).json({ error: "Invalid time zone" });
    }

    if (timeZone && !isValidTimeZone(timeZone)) {
      return res.status(400).json({ error: "Invalid time zone" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { timeZone: timeZone || null } as any as any,
    });

    return res.json({ timeZone: timeZone || null });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

// Agent/admin working hours + schedule timezone (used for scheduling when assigned)
router.get("/schedule", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const userId = authReq.user?.userId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { agentTimeZone: true, workingHours: true } as any,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      agentTimeZone: (user as any).agentTimeZone ?? null,
      workingHours: (user as any).workingHours ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch schedule:", error);
    return res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

router.put("/schedule", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const userId = authReq.user?.userId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Forbidden" });
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

    const updated = await prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: {
        agentTimeZone: tz || null,
        workingHours: normalizedWorkingHours as any,
      } as any,
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      agentTimeZone: tz || null,
      workingHours: normalizedWorkingHours,
    });
  } catch (error) {
    console.error("Failed to update schedule:", error);
    return res.status(500).json({ error: "Failed to update schedule" });
  }
});

router.get("/caller-id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const userId = authReq.user?.userId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        callerIdPhoneNumberId: true,
        callerIdPhoneNumber: {
          select: {
            id: true,
            number: true,
            friendlyName: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      phoneNumberId: user.callerIdPhoneNumberId || null,
      phoneNumber: user.callerIdPhoneNumber || null,
    });
  } catch (error) {
    console.error("Failed to fetch caller ID preference:", error);
    res.status(500).json({ error: "Failed to fetch caller ID" });
  }
});

router.put("/caller-id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const userId = authReq.user?.userId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const phoneNumberId =
      (req.body?.phoneNumberId as string | null | undefined) ?? null;

    if (!phoneNumberId) {
      const updated = await prisma.user.updateMany({
        where: { id: userId, tenantId },
        data: { callerIdPhoneNumberId: null },
      });

      if (updated.count === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({ phoneNumberId: null });
    }

    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, tenantId },
      select: { id: true, assignedToId: true },
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: "Phone number not found" });
    }

    // Keep agent choice consistent with what they can see/select.
    if (role === "AGENT") {
      if (phoneNumber.assignedToId && phoneNumber.assignedToId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const updated = await prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { callerIdPhoneNumberId: phoneNumberId },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ phoneNumberId });
  } catch (error) {
    console.error("Failed to update caller ID preference:", error);
    res.status(500).json({ error: "Failed to update caller ID" });
  }
});

export default router;
