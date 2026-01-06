import { Router, Request, Response } from "express";
import { GoogleAuthService } from "../services/integrations/google/auth";
import { GoogleGmailService } from "../services/integrations/google/gmail";
import { GoogleCalendarService } from "../services/integrations/google/calendar";
import prisma from "../lib/prisma";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();
const googleAuthService = new GoogleAuthService();
const googleGmailService = new GoogleGmailService();
const googleCalendarService = new GoogleCalendarService();

/**
 * Get all integrations for a tenant
 */
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    const integrations = await prisma.integration.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        provider: true,
        type: true,
        icon: true,
        connected: true,
        description: true,
        category: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ integrations });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

/**
 * Initiate Google OAuth flow
 */
router.post(
  "/google/connect",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { integrationType } = req.body; // 'calendar', 'gmail', 'drive', 'sheets'
      const authReq = req as AuthRequest;
      const tenantId = authReq.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID not found in token" });
      }

      if (!integrationType) {
        res.status(400).json({ error: "integrationType is required" });
        return;
      }

      const authUrl = googleAuthService.generateAuthUrl(
        tenantId,
        integrationType
      );

      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Google auth URL:", error);
      res.status(500).json({ error: "Failed to generate authorization URL" });
    }
  }
);

/**
 * Handle Google OAuth callback
 */
router.get("/google/callback", async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      res.status(400).send("Missing authorization code or state");
      return;
    }

    const result = await googleAuthService.handleCallback(
      code as string,
      state as string
    );

    // Redirect back to integrations page with success message
    res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/integrations?connected=google&success=true&category=CONNECTED`
    );
  } catch (error) {
    console.error("Error handling Google callback:", error);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/integrations?connected=google&success=false&category=CONNECTED`
    );
  }
});

/**
 * Disconnect Google integration
 */
router.post(
  "/google/disconnect",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { integrationType } = req.body;
      const authReq = req as AuthRequest;
      const tenantId = authReq.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID not found in token" });
      }

      if (!integrationType) {
        res.status(400).json({ error: "integrationType is required" });
        return;
      }

      await googleAuthService.disconnect(tenantId, integrationType);

      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Google integration:", error);
      res.status(500).json({ error: "Failed to disconnect integration" });
    }
  }
);

/**
 * Get connection status for a specific Google integration type
 */
router.get(
  "/google/:integrationType/status",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { integrationType } = req.params;
      const authReq = req as AuthRequest;
      const tenantId = authReq.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID not found in token" });
      }

      const integration = await prisma.integration.findUnique({
        where: {
          tenantId_provider_type: {
            tenantId,
            provider: "google",
            type: integrationType,
          },
        },
        select: {
          id: true,
          name: true,
          connected: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        connected: integration?.connected || false,
        integration,
      });
    } catch (error) {
      console.error("Error checking integration status:", error);
      res.status(500).json({ error: "Failed to check integration status" });
    }
  }
);

/**
 * Get the connected Gmail account email ("send as") for this tenant
 */
router.get(
  "/google/gmail/profile",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const tenantId = authReq.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID not found in token" });
      }

      const profile = await googleGmailService.getProfile(tenantId);
      return res.json({ connected: true, email: profile.email });
    } catch (error: any) {
      const message = String(error?.message ?? error ?? "");
      const isNotConnected = /not connected/i.test(message);
      if (isNotConnected) {
        return res.json({ connected: false });
      }
      console.error("Error fetching Gmail profile:", error);
      return res.status(500).json({ error: "Failed to fetch Gmail profile" });
    }
  }
);

/**
 * Get allowed conference provider types for the connected Google Calendar.
 * Uses the Calendar API's `conferenceProperties.allowedConferenceSolutionTypes`.
 */
router.get(
  "/google/calendar/conference-solutions",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const tenantId = authReq.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID not found in token" });
      }

      const allowed =
        await googleCalendarService.getAllowedConferenceSolutionTypes(tenantId);

      return res.json({
        connected: true,
        allowedConferenceSolutionTypes: allowed,
      });
    } catch (error: any) {
      const message = String(error?.message ?? error ?? "");
      const isNotConnected = /not connected/i.test(message);
      if (isNotConnected) {
        return res.json({
          connected: false,
          allowedConferenceSolutionTypes: [],
        });
      }

      console.error("Error fetching calendar conference solutions:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch calendar conference solutions" });
    }
  }
);

export default router;
