import { google } from "googleapis";
import { GoogleAuthService } from "./auth";

const authService = new GoogleAuthService();

export class GoogleCalendarService {
  /**
   * Create a calendar event
   */
  async createEvent(
    tenantId: string,
    eventData: {
      summary: string;
      description?: string;
      startTime: string; // ISO 8601
      endTime: string; // ISO 8601
      attendees?: string[]; // Email addresses
      location?: string;
      timeZone?: string;
    }
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "calendar");
    const calendar = google.calendar({ version: "v3", auth });

    const event = {
      summary: eventData.summary,
      description: eventData.description,
      location: eventData.location,
      start: {
        dateTime: eventData.startTime,
        timeZone: eventData.timeZone || "America/New_York",
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: eventData.timeZone || "America/New_York",
      },
      attendees: eventData.attendees?.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: "all", // Send email invitations
    });

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      meetLink: response.data.hangoutLink,
    };
  }

  /**
   * Check availability for a time slot
   */
  async checkAvailability(
    tenantId: string,
    startTime: string,
    endTime: string,
    timeZone?: string
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "calendar");
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startTime,
        timeMax: endTime,
        timeZone: timeZone || "America/New_York",
        items: [{ id: "primary" }],
      },
    });

    const busySlots = response.data.calendars?.primary?.busy || [];
    const isFree = busySlots.length === 0;

    return {
      success: true,
      isFree,
      busySlots,
    };
  }

  /**
   * List upcoming events
   */
  async listEvents(
    tenantId: string,
    maxResults: number = 10,
    timeMin?: string
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "calendar");
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin || new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });

    return {
      success: true,
      events:
        response.data.items?.map((event) => ({
          id: event.id,
          summary: event.summary,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          htmlLink: event.htmlLink,
          attendees: event.attendees?.map((a) => a.email),
        })) || [],
    };
  }
}
