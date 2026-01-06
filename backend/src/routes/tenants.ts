import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { AuthRequest } from "../middleware/auth";
import { normalizeBusinessHoursConfig } from "../services/businessHours";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

const normalizeE164Like = (raw: unknown): string => {
  const v = String(raw || "").trim();
  if (!v) return "";
  return v.replace(/[^+0-9]/g, "");
};

const validateTimeZone = (timeZone: string): boolean => {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

// Tenant-scoped business hours + after-hours chat prefs
router.get("/me/business-hours", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        businessTimeZone: true,
        businessHours: true,
        calendarAutoAddMeet: true,
        maxMeetingDurationMinutes: true,
        chatAfterHoursMode: true,
        chatAfterHoursMessage: true,
      } as any,
    });

    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    res.json({
      timeZone: tenant.businessTimeZone || null,
      businessHours: normalizeBusinessHoursConfig(tenant.businessHours),
      calendarAutoAddMeet: tenant.calendarAutoAddMeet ?? true,
      maxMeetingDurationMinutes:
        (tenant as any)?.maxMeetingDurationMinutes ?? 60,
      chatAfterHoursMode: tenant.chatAfterHoursMode || "ONLY_ON_ESCALATION",
      chatAfterHoursMessage: tenant.chatAfterHoursMessage || null,
    });
  } catch (error) {
    console.error("Error fetching tenant business hours:", error);
    res.status(500).json({ error: "Failed to fetch business hours" });
  }
});

// Read-only tenant business timezone (used as default/fallback for schedules)
router.get("/me/business-timezone", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "AGENT" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessTimeZone: true } as any,
    });

    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    return res.json({ timeZone: tenant.businessTimeZone || null });
  } catch (error) {
    console.error("Error fetching tenant business timezone:", error);
    return res.status(500).json({ error: "Failed to fetch timezone" });
  }
});

// Tenant forwarding settings (external number restrictions)
router.get("/me/forwarding-settings", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: {
        restrictExternalForwarding: true,
        externalForwardingAllowList: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    return res.json(tenant);
  } catch (error) {
    console.error("Error fetching forwarding settings:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch forwarding settings" });
  }
});

// Tenant web phone settings (feature flag)
router.get("/me/web-phone-settings", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: {
        webPhoneEnabled: true,
        webPhoneOutboundCallerNumber: true,
        webPhoneOutboundCallerName: true,
      },
    });

    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    return res.json({
      webPhoneEnabled: Boolean(tenant.webPhoneEnabled),
      webPhoneOutboundCallerNumber:
        (tenant as any).webPhoneOutboundCallerNumber || null,
      webPhoneOutboundCallerName:
        (tenant as any).webPhoneOutboundCallerName || null,
    });
  } catch (error) {
    console.error("Error fetching web phone settings:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch web phone settings" });
  }
});

router.put("/me/web-phone-settings", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const body: any = (req as any).body || {};

    const webPhoneEnabled =
      typeof body?.webPhoneEnabled === "boolean"
        ? Boolean(body.webPhoneEnabled)
        : undefined;

    const outboundCallerNumberRaw =
      typeof body?.webPhoneOutboundCallerNumber === "string" ||
      body?.webPhoneOutboundCallerNumber === null
        ? body.webPhoneOutboundCallerNumber
        : undefined;

    const outboundCallerNameRaw =
      typeof body?.webPhoneOutboundCallerName === "string" ||
      body?.webPhoneOutboundCallerName === null
        ? body.webPhoneOutboundCallerName
        : undefined;

    if (
      typeof webPhoneEnabled !== "boolean" &&
      outboundCallerNumberRaw === undefined &&
      outboundCallerNameRaw === undefined
    ) {
      return res.status(400).json({
        error:
          "Provide at least one of: webPhoneEnabled, webPhoneOutboundCallerNumber, webPhoneOutboundCallerName",
      });
    }

    const outboundCallerNumber =
      outboundCallerNumberRaw === undefined
        ? undefined
        : outboundCallerNumberRaw === null
        ? null
        : (() => {
            const cleaned = normalizeE164Like(outboundCallerNumberRaw);
            return cleaned || null;
          })();

    if (
      outboundCallerNumber !== undefined &&
      outboundCallerNumber !== null &&
      outboundCallerNumber.length > 32
    ) {
      return res
        .status(400)
        .json({ error: "webPhoneOutboundCallerNumber is too long" });
    }

    const outboundCallerName =
      outboundCallerNameRaw === undefined
        ? undefined
        : outboundCallerNameRaw === null
        ? null
        : String(outboundCallerNameRaw).trim() || null;

    if (
      outboundCallerName !== undefined &&
      outboundCallerName !== null &&
      outboundCallerName.length > 128
    ) {
      return res
        .status(400)
        .json({ error: "webPhoneOutboundCallerName is too long" });
    }

    console.log("[Tenants] PUT web-phone-settings:", {
      webPhoneEnabled,
      outboundCallerNumberRaw,
      outboundCallerNumber,
      outboundCallerNameRaw,
      outboundCallerName,
    });

    const updated = await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: {
        ...(typeof webPhoneEnabled === "boolean" ? { webPhoneEnabled } : {}),
        ...(outboundCallerNumber !== undefined
          ? { webPhoneOutboundCallerNumber: outboundCallerNumber }
          : {}),
        ...(outboundCallerName !== undefined
          ? { webPhoneOutboundCallerName: outboundCallerName }
          : {}),
      },
      select: {
        webPhoneEnabled: true,
        webPhoneOutboundCallerNumber: true,
        webPhoneOutboundCallerName: true,
      },
    });

    return res.json({
      webPhoneEnabled: Boolean((updated as any).webPhoneEnabled),
      webPhoneOutboundCallerNumber:
        (updated as any).webPhoneOutboundCallerNumber || null,
      webPhoneOutboundCallerName:
        (updated as any).webPhoneOutboundCallerName || null,
    });
  } catch (error) {
    console.error("Error updating web phone settings:", error);
    return res
      .status(500)
      .json({ error: "Failed to update web phone settings" });
  }
});

router.put("/me/forwarding-settings", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const restrictExternalForwarding =
      typeof req.body?.restrictExternalForwarding === "boolean"
        ? req.body.restrictExternalForwarding
        : undefined;

    const allowListRaw = Array.isArray(req.body?.externalForwardingAllowList)
      ? (req.body.externalForwardingAllowList as unknown[])
      : undefined;

    const allowList = allowListRaw
      ? allowListRaw
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v.length > 0 && v.length <= 32)
      : undefined;

    const updated = await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: {
        ...(typeof restrictExternalForwarding === "boolean"
          ? { restrictExternalForwarding }
          : {}),
        ...(Array.isArray(allowList)
          ? { externalForwardingAllowList: allowList }
          : {}),
      },
      select: {
        restrictExternalForwarding: true,
        externalForwardingAllowList: true,
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("Error updating forwarding settings:", error);
    return res
      .status(500)
      .json({ error: "Failed to update forwarding settings" });
  }
});

router.put("/me/business-hours", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;
    const {
      timeZone,
      businessHours,
      calendarAutoAddMeet,
      maxMeetingDurationMinutes,
      chatAfterHoursMode,
      chatAfterHoursMessage,
    } = req.body || {};

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const tz = typeof timeZone === "string" ? timeZone.trim() : "";
    if (tz && !validateTimeZone(tz)) {
      return res.status(400).json({ error: "Invalid time zone" });
    }

    const normalized = normalizeBusinessHoursConfig(businessHours);
    const modeRaw =
      typeof chatAfterHoursMode === "string" ? chatAfterHoursMode : "";
    const mode = ["ONLY_ON_ESCALATION", "ALWAYS", "NEVER"].includes(modeRaw)
      ? modeRaw
      : "ONLY_ON_ESCALATION";
    const message =
      typeof chatAfterHoursMessage === "string" ? chatAfterHoursMessage : null;
    const autoAddMeet =
      typeof calendarAutoAddMeet === "boolean"
        ? calendarAutoAddMeet
        : undefined;

    const maxDurationRaw =
      typeof maxMeetingDurationMinutes === "number"
        ? maxMeetingDurationMinutes
        : parseInt(String(maxMeetingDurationMinutes ?? ""), 10);
    const maxDuration =
      Number.isFinite(maxDurationRaw) && maxDurationRaw > 0
        ? Math.min(8 * 60, Math.max(5, Math.floor(maxDurationRaw)))
        : undefined;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        businessTimeZone: tz || null,
        businessHours: normalized as any,
        ...(typeof autoAddMeet === "boolean"
          ? { calendarAutoAddMeet: autoAddMeet }
          : {}),
        ...(typeof maxDuration === "number"
          ? { maxMeetingDurationMinutes: maxDuration }
          : {}),
        chatAfterHoursMode: mode,
        chatAfterHoursMessage: message,
      },
      select: {
        businessTimeZone: true,
        businessHours: true,
        calendarAutoAddMeet: true,
        maxMeetingDurationMinutes: true,
        chatAfterHoursMode: true,
        chatAfterHoursMessage: true,
      } as any,
    });

    res.json({
      timeZone: updated.businessTimeZone || null,
      businessHours: normalizeBusinessHoursConfig(updated.businessHours),
      calendarAutoAddMeet: updated.calendarAutoAddMeet ?? true,
      maxMeetingDurationMinutes:
        (updated as any)?.maxMeetingDurationMinutes ?? 60,
      chatAfterHoursMode: updated.chatAfterHoursMode || "ONLY_ON_ESCALATION",
      chatAfterHoursMessage: updated.chatAfterHoursMessage || null,
    });
  } catch (error) {
    console.error("Error updating tenant business hours:", error);
    res.status(500).json({ error: "Failed to update business hours" });
  }
});

// Get all tenants
router.get("/", async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// Create a new tenant
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, plan, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        plan: plan || "STARTER",
        status: status || "ACTIVE",
      },
    });

    res.status(201).json(tenant);
  } catch (error) {
    console.error("Error creating tenant:", error);
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

// Update tenant plan
router.patch("/:id/plan", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ error: "Plan name is required" });
    }

    // Verify plan exists
    const planExists = await prisma.plan.findUnique({
      where: { name: plan },
    });

    if (!planExists) {
      return res.status(400).json({ error: "Invalid plan name" });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { plan },
    });

    res.json(tenant);
  } catch (error) {
    console.error("Error updating tenant plan:", error);
    res.status(500).json({ error: "Failed to update tenant plan" });
  }
});

// Get single tenant
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      // Select a minimal set of fields to avoid failing hard if the DB schema
      // is temporarily behind the Prisma schema (missing new columns).
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
      } as any,
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});

// Update a tenant
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, plan, status } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name,
        plan,
        status,
      },
    });

    res.json(tenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// Delete a tenant
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.tenant.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting tenant:", error);
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

// Create a test customer for a tenant
router.post("/test-customer", async (req: Request, res: Response) => {
  try {
    // In a real app, we would get the tenantId from the authenticated user's session
    // For now, we'll expect it in the body or use a default if testing locally
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const email = `test-customer-${tenant.slug}@example.com`;

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash("password", 10);
      user = await prisma.user.create({
        data: {
          email,
          name: "Test Customer",
          password: hashedPassword,
          role: Role.CUSTOMER,
          tenantId: tenant.id,
          avatar: `https://ui-avatars.com/api/?name=Test+Customer`,
        },
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      user,
      token,
    });
  } catch (error) {
    console.error("Error creating test customer:", error);
    res.status(500).json({ error: "Failed to create test customer" });
  }
});

export default router;
