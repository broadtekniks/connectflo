import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { Readable } from "stream";

const router = Router();

const canViewVoicemails = (role?: string) =>
  role === "TENANT_ADMIN" || role === "AGENT" || role === "SUPER_ADMIN";

const getUserId = (req: AuthRequest) =>
  (req.user?.id as string | undefined) ??
  (req.user?.userId as string | undefined);

const toPlayableRecordingUrl = (raw: string) => {
  const url = String(raw || "").trim();
  if (!url) return null;
  // Twilio RecordingUrl is typically provided without an extension.
  // Adding .mp3 works for browser playback in most cases.
  if (/\.mp3(\?|$)/i.test(url) || /\.wav(\?|$)/i.test(url)) return url;
  return `${url}.mp3`;
};

const getTwilioBasicAuthHeader = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  const encoded = Buffer.from(`${sid}:${token}`).toString("base64");
  return `Basic ${encoded}`;
};

/**
 * Count "unread" voicemails.
 * Since we don't have read-receipts, we treat unread as: open VOICE conversations
 * that contain at least one customer message with a recording attachment.
 */
router.get("/unread-count", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tenantId = authReq.user?.tenantId;
  const role = authReq.user?.role;
  const userId = getUserId(authReq);

  if (!canViewVoicemails(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!tenantId && role !== "SUPER_ADMIN") {
    return res.status(400).json({ error: "Tenant ID not found in token" });
  }

  try {
    const whereTenant = tenantId ? { tenantId } : {};

    const conversationWhere: any = {
      ...whereTenant,
      channel: "VOICE",
      status: "OPEN",
    };

    // Agents see their assigned + unassigned voicemail queue.
    if (role === "AGENT" && userId) {
      conversationWhere.OR = [{ assigneeId: userId }, { assigneeId: null }];
    }

    // Count distinct conversations that have at least one customer recording message.
    const distinctConversations = await prisma.message.findMany({
      where: {
        ...whereTenant,
        sender: "CUSTOMER",
        attachments: { isEmpty: false },
        conversation: conversationWhere,
      },
      distinct: ["conversationId"],
      select: { conversationId: true },
    });

    // If we have a user id, subtract the conversations the user has marked read.
    if (userId) {
      const conversationIds = distinctConversations
        .map((c) => c.conversationId)
        .filter(Boolean) as string[];

      if (conversationIds.length === 0) {
        return res.json({ count: 0 });
      }

      const reads = await prisma.conversationRead.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          userId,
          conversationId: { in: conversationIds },
        },
        select: { conversationId: true },
      });

      const readSet = new Set(reads.map((r) => r.conversationId));
      const unreadCount = conversationIds.reduce(
        (acc, id) => acc + (readSet.has(id) ? 0 : 1),
        0
      );
      return res.json({ count: unreadCount });
    }

    return res.json({ count: distinctConversations.length });
  } catch (error) {
    console.error("Failed to compute unread voicemail count:", error);
    return res
      .status(500)
      .json({ error: "Failed to compute unread voicemail count" });
  }
});

/**
 * Mark a voicemail conversation as read for the current user.
 */
router.post(
  "/:conversationId/mark-read",
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const tenantId = authReq.user?.tenantId;
    const role = authReq.user?.role;
    const userId = getUserId(authReq);

    if (!canViewVoicemails(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    const conversationId = String(req.params.conversationId || "").trim();
    if (!conversationId) {
      return res.status(400).json({ error: "Missing conversationId" });
    }

    if (!tenantId && role !== "SUPER_ADMIN") {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    try {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          ...(tenantId ? { tenantId } : {}),
          channel: "VOICE",
        },
        select: { id: true, tenantId: true },
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      await prisma.conversationRead.upsert({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        create: {
          tenantId: conversation.tenantId,
          conversationId,
          userId,
          readAt: new Date(),
        },
        update: {
          readAt: new Date(),
        },
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error("Failed to mark voicemail read:", error);
      return res.status(500).json({ error: "Failed to mark voicemail read" });
    }
  }
);

/**
 * Proxy voicemail audio through the backend.
 * - Browser audio tags can't send Bearer tokens.
 * - Twilio recording URLs typically require Basic auth.
 * So the UI fetches this endpoint as a blob (with Bearer token) and plays it via object URL.
 */
router.get("/:id/audio", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tenantId = authReq.user?.tenantId;
  const role = authReq.user?.role;

  if (!canViewVoicemails(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "Missing id" });

  const authHeader = getTwilioBasicAuthHeader();
  if (!authHeader) {
    return res.status(500).json({
      error: "Twilio credentials not configured on server",
    });
  }

  try {
    const msg = await prisma.message.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
        conversation: { channel: "VOICE" },
      },
      select: {
        attachments: true,
      },
    });

    if (!msg) return res.status(404).json({ error: "Voicemail not found" });

    const recordingUrl = Array.isArray(msg.attachments)
      ? String(msg.attachments[0] || "")
      : "";
    const playableUrl = toPlayableRecordingUrl(recordingUrl);
    if (!playableUrl) {
      return res.status(404).json({ error: "Recording URL missing" });
    }

    const upstream = await fetch(playableUrl, {
      headers: {
        Authorization: authHeader,
      },
    });

    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({ error: "Failed to fetch voicemail audio" });
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    res.setHeader("Content-Type", contentType);

    // Stream response body to client
    if (!upstream.body) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      return res.send(buf);
    }

    const nodeStream = Readable.fromWeb(upstream.body as any);
    nodeStream.on("error", (err) => {
      console.error("Voicemail audio stream error:", err);
      try {
        res.end();
      } catch {
        // ignore
      }
    });
    return nodeStream.pipe(res);
  } catch (error) {
    console.error("Failed to proxy voicemail audio:", error);
    return res.status(500).json({ error: "Failed to fetch voicemail audio" });
  }
});

/**
 * List voicemails (stored as VOICE messages with a recording attachment)
 */
router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tenantId = authReq.user?.tenantId;
  const role = authReq.user?.role;
  const userId = getUserId(authReq);

  if (!canViewVoicemails(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!tenantId && role !== "SUPER_ADMIN") {
    return res.status(400).json({ error: "Tenant ID not found in token" });
  }

  const limitRaw = req.query?.limit;
  const limit = Math.min(
    200,
    Math.max(1, parseInt(String(limitRaw || "50"), 10) || 50)
  );

  // Filter parameters
  const fromDate = req.query?.fromDate ? String(req.query.fromDate) : null;
  const toDate = req.query?.toDate ? String(req.query.toDate) : null;
  const phoneNumber = req.query?.phoneNumber
    ? String(req.query.phoneNumber)
    : null;

  try {
    const whereTenant = tenantId ? { tenantId } : {};

    // Build date filter
    const dateFilter: any = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      // Add one day to include the entire end date
      const endDate = new Date(toDate);
      endDate.setDate(endDate.getDate() + 1);
      dateFilter.lt = endDate;
    }

    // Build content filter for phone number
    const contentFilter = phoneNumber
      ? { contains: `on ${phoneNumber}` }
      : undefined;

    const messages = await prisma.message.findMany({
      where: {
        ...whereTenant,
        sender: "CUSTOMER",
        attachments: { isEmpty: false },
        conversation: {
          channel: "VOICE",
        },
        ...(Object.keys(dateFilter).length > 0
          ? { createdAt: dateFilter }
          : {}),
        ...(contentFilter ? { content: contentFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        content: true,
        attachments: true,
        createdAt: true,
        conversationId: true,
        conversation: {
          select: {
            id: true,
            subject: true,
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    const conversationIds = messages
      .map((m) => m.conversationId)
      .filter(Boolean) as string[];

    let readSet: Set<string> | null = null;
    if (userId && conversationIds.length > 0) {
      const reads = await prisma.conversationRead.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          userId,
          conversationId: { in: conversationIds },
        },
        select: { conversationId: true },
      });
      readSet = new Set(reads.map((r) => r.conversationId));
    }

    const voicemails = messages.map((m) => {
      const recordingUrl = Array.isArray(m.attachments)
        ? String(m.attachments[0] || "")
        : "";

      // Extract phone number from content (format: "on +1234567890")
      const phoneMatch = m.content?.match(/on (\+?[\d\s\-\(\)]+)\.?/);
      const phoneNumber = phoneMatch ? phoneMatch[1].trim() : null;

      return {
        id: m.id,
        conversationId: m.conversationId,
        createdAt: m.createdAt,
        content: m.content,
        recordingUrl: recordingUrl || null,
        playableUrl: toPlayableRecordingUrl(recordingUrl),
        isRead: readSet ? readSet.has(m.conversationId) : false,
        phoneNumber,
        customer: m.conversation?.customer
          ? {
              id: m.conversation.customer.id,
              name: m.conversation.customer.name,
              email: m.conversation.customer.email,
              avatar: m.conversation.customer.avatar,
            }
          : null,
        subject: m.conversation?.subject || null,
      };
    });

    return res.json({ voicemails });
  } catch (error) {
    console.error("Failed to fetch voicemails:", error);
    return res.status(500).json({ error: "Failed to fetch voicemails" });
  }
});

/**
 * Get voicemail details by message id
 */
router.get("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tenantId = authReq.user?.tenantId;
  const role = authReq.user?.role;
  const userId = getUserId(authReq);

  if (!canViewVoicemails(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "Missing id" });

  try {
    const msg = await prisma.message.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {}),
        conversation: { channel: "VOICE" },
      },
      select: {
        id: true,
        content: true,
        attachments: true,
        createdAt: true,
        conversationId: true,
        conversation: {
          select: {
            id: true,
            subject: true,
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!msg) return res.status(404).json({ error: "Voicemail not found" });

    let isRead = false;
    if (userId && msg.conversationId) {
      const read = await prisma.conversationRead.findFirst({
        where: {
          ...(tenantId ? { tenantId } : {}),
          userId,
          conversationId: msg.conversationId,
        },
        select: { id: true },
      });
      isRead = !!read;
    }

    const recordingUrl = Array.isArray(msg.attachments)
      ? String(msg.attachments[0] || "")
      : "";

    return res.json({
      voicemail: {
        id: msg.id,
        conversationId: msg.conversationId,
        createdAt: msg.createdAt,
        content: msg.content,
        recordingUrl: recordingUrl || null,
        playableUrl: toPlayableRecordingUrl(recordingUrl),
        isRead,
        customer: msg.conversation?.customer
          ? {
              id: msg.conversation.customer.id,
              name: msg.conversation.customer.name,
              email: msg.conversation.customer.email,
              avatar: msg.conversation.customer.avatar,
            }
          : null,
        subject: msg.conversation?.subject || null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch voicemail:", error);
    return res.status(500).json({ error: "Failed to fetch voicemail" });
  }
});

/**
 * Delete a voicemail (soft delete by deleting the message)
 */
router.delete("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tenantId = authReq.user?.tenantId;
  const role = authReq.user?.role;

  if (!canViewVoicemails(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!tenantId && role !== "SUPER_ADMIN") {
    return res.status(400).json({ error: "Tenant ID not found in token" });
  }

  const messageId = String(req.params.id || "").trim();
  if (!messageId) {
    return res.status(400).json({ error: "Missing message ID" });
  }

  try {
    const whereTenant = tenantId ? { tenantId } : {};

    // Find the message and verify it's a voicemail
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        ...whereTenant,
        sender: "CUSTOMER",
        attachments: { isEmpty: false },
        conversation: { channel: "VOICE" },
      },
      include: {
        conversation: {
          select: {
            id: true,
            assigneeId: true,
          },
        },
      },
    });

    if (!message) {
      return res.status(404).json({ error: "Voicemail not found" });
    }

    // For agents, only allow deleting their assigned voicemails or unassigned ones
    if (role === "AGENT") {
      const userId = getUserId(authReq);
      const assigneeId = message.conversation?.assigneeId;
      if (assigneeId !== null && assigneeId !== userId) {
        return res
          .status(403)
          .json({ error: "Cannot delete another agent's voicemail" });
      }
    }

    // Delete the message
    await prisma.message.delete({
      where: { id: messageId },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete voicemail:", error);
    return res.status(500).json({ error: "Failed to delete voicemail" });
  }
});

export default router;
