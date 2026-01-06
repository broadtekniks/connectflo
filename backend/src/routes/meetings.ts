import express from "express";
import prisma from "../lib/prisma";
import { GoogleCalendarService } from "../services/integrations/google/calendar";
import { AuthRequest } from "../middleware/auth";

const router = express.Router();
const googleCalendar = new GoogleCalendarService();

/**
 * GET /meetings
 * List all upcoming meetings from Google Calendar with customer information
 */
router.get("/", async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    // Check if Google Calendar is connected
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId,
        provider: "google",
        type: "calendar",
        connected: true,
      },
    });

    if (!integration) {
      return res.json({
        meetings: [],
        connected: false,
        message: "Google Calendar not connected",
      });
    }

    // Fetch upcoming events from Google Calendar
    const maxResults = parseInt(req.query.limit as string) || 100;
    const timeMin = req.query.timeMin as string | undefined;

    const result = await googleCalendar.listEvents(
      tenantId,
      maxResults,
      timeMin
    );

    if (!result.success) {
      return res.status(500).json({ error: "Failed to fetch calendar events" });
    }

    // Get all customers for this tenant to map email to customer info
    const customers = await prisma.user.findMany({
      where: {
        tenantId,
        role: "CUSTOMER",
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      },
    });

    const customerByEmail = new Map(
      customers.map((c) => [c.email.toLowerCase(), c])
    );

    // Format events with customer information
    const meetings = result.events.map((event: any) => {
      // Extract customer from attendees
      const attendeeEmails = event.attendees || [];
      const customerInfo = attendeeEmails
        .map((email: string) => customerByEmail.get(email.toLowerCase()))
        .filter(Boolean)[0];

      return {
        id: event.id,
        summary: event.summary || "Untitled Meeting",
        startTime: event.start,
        endTime: event.end,
        htmlLink: event.htmlLink,
        attendees: attendeeEmails,
        customer: customerInfo
          ? {
              id: customerInfo.id,
              name: customerInfo.name,
              email: customerInfo.email,
              avatar: customerInfo.avatar,
            }
          : null,
      };
    });

    res.json({
      meetings,
      connected: true,
      total: meetings.length,
    });
  } catch (error) {
    console.error("Failed to list meetings:", error);
    res.status(500).json({
      error: "Failed to list meetings",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
