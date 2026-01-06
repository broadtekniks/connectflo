import { Router, Response } from "express";
import twilio from "twilio";
import { AuthRequest } from "../middleware/auth";
import { toTwilioClientIdentity } from "../services/twilioClientIdentity";

const router = Router();

router.post("/voice-token", async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req.user?.tenantId as string | undefined) || "";
    const userId = (req.user?.userId as string | undefined) || "";
    const role = (req.user?.role as string | undefined) || "";

    if (!tenantId || !userId) {
      return res.status(400).json({ error: "Missing tenantId/userId" });
    }

    if (role !== "TENANT_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
    const apiKeySid = String(process.env.TWILIO_API_KEY_SID || "").trim();
    const apiKeySecret = String(process.env.TWILIO_API_KEY_SECRET || "").trim();

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      return res.status(500).json({
        error:
          "Twilio API key not configured. Set TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET.",
      });
    }

    const identity = toTwilioClientIdentity({ tenantId, userId });

    // twilio.jwt.AccessToken is available from the Twilio Node SDK.
    const AccessToken = (twilio as any).jwt?.AccessToken;
    const VoiceGrant = (twilio as any).jwt?.AccessToken?.VoiceGrant;

    if (!AccessToken || !VoiceGrant) {
      return res.status(500).json({ error: "Twilio JWT helpers unavailable" });
    }

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 60 * 60, // 1 hour
    });

    const outgoingApplicationSid = String(
      process.env.TWILIO_TWIML_APP_SID || ""
    ).trim();

    const voiceGrant = new VoiceGrant({
      incomingAllow: true,
      ...(outgoingApplicationSid ? { outgoingApplicationSid } : {}),
    });

    token.addGrant(voiceGrant);

    return res.json({ token: token.toJwt(), identity });
  } catch (error) {
    console.error("Failed to mint Twilio voice token", error);
    return res.status(500).json({ error: "Failed to mint token" });
  }
});

export default router;
