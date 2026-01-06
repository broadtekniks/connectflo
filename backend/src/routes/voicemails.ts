import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { Readable } from "stream";

const router = Router();

const canViewVoicemails = (role?: string) =>
  role === "TENANT_ADMIN" || role === "AGENT" || role === "SUPER_ADMIN";

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

  try {
    const whereTenant = tenantId ? { tenantId } : {};

    const messages = await prisma.message.findMany({
      where: {
        ...whereTenant,
        sender: "CUSTOMER",
        attachments: { isEmpty: false },
        conversation: {
          channel: "VOICE",
        },
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

    const voicemails = messages.map((m) => {
      const recordingUrl = Array.isArray(m.attachments)
        ? String(m.attachments[0] || "")
        : "";
      return {
        id: m.id,
        conversationId: m.conversationId,
        createdAt: m.createdAt,
        content: m.content,
        recordingUrl: recordingUrl || null,
        playableUrl: toPlayableRecordingUrl(recordingUrl),
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

export default router;
