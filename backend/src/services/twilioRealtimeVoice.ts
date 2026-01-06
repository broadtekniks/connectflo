import WebSocket from "ws";
import { EventEmitter } from "events";
import { TwilioService } from "./twilio";
import { variableResolver } from "./variableResolver";
import { DateTime } from "luxon";
import prisma from "../lib/prisma";
import { buildIcsInvite } from "./calendarInvite";
import { EmailService } from "./email";
import { GoogleCalendarService } from "./integrations/google/calendar";

const END_CALL_MARKER = "[[END_CALL]]";

const VOICE_CALL_RUNTIME_INSTRUCTIONS = [
  "You are speaking with a caller on a live phone call.",
  "Keep responses concise and conversational.",
  "If the caller asks to end the call, respond with a brief goodbye and confirm you are ending the call.",
  `If you decide the call should be ended now, include the token ${END_CALL_MARKER} in your TEXT output only (do not say the token out loud).`,
].join("\n");

function normalizeGreeting(raw: string, agentName?: string): string {
  const fallback = `Hello! This is ${
    agentName || "your assistant"
  }. How may I help you today?`;
  const text = (raw || "").replace(/\s+/g, " ").trim();
  const base = text.length ? text : fallback;

  // Preserve the full user-configured greeting (voice calls sometimes need longer intros).
  // Apply a generous cap to avoid extreme payloads.
  const maxChars = 2000;
  return base.length > maxChars ? base.slice(0, maxChars).trim() : base;
}

function isValidEmail(email: string): boolean {
  const e = (email || "").trim().toLowerCase();
  if (!e) return false;
  // Conservative but practical.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function normalizeEmailFromSpoken(spoken: string): {
  success: boolean;
  email?: string;
  confidence: number;
  message: string;
} {
  const raw = String(spoken || "").trim();
  if (!raw) {
    return {
      success: false,
      confidence: 0,
      message: "No email input provided",
    };
  }

  const nato: Record<string, string> = {
    alpha: "a",
    bravo: "b",
    charlie: "c",
    delta: "d",
    echo: "e",
    foxtrot: "f",
    golf: "g",
    hotel: "h",
    india: "i",
    juliett: "j",
    juliet: "j",
    kilo: "k",
    lima: "l",
    mike: "m",
    november: "n",
    oscar: "o",
    papa: "p",
    quebec: "q",
    romeo: "r",
    sierra: "s",
    tango: "t",
    uniform: "u",
    victor: "v",
    whiskey: "w",
    whisky: "w",
    xray: "x",
    "x-ray": "x",
    yankee: "y",
    zulu: "z",
  };

  const tokens = raw
    .toLowerCase()
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t0 = tokens[i];
    const t = t0.replace(/^[\"'()\[]+|[\"'()\]]+$/g, "");
    if (!t) continue;

    // Handle patterns like "s for sugar" or "t for tommy" -> take the letter
    if (/^[a-z]$/.test(t) && tokens[i + 1] === "for") {
      out.push(t);
      i += 2; // skip "for" and the following word
      continue;
    }

    // Handle patterns like "s4sugar" or "t4tommy" -> take leading letter
    const s4 = t.match(/^([a-z])\d/);
    if (s4) {
      out.push(s4[1]);
      continue;
    }

    if (t === "at" || t === "@") {
      out.push("@");
      continue;
    }
    if (t === "dot" || t === ".") {
      out.push(".");
      continue;
    }
    if (t === "underscore") {
      out.push("_");
      continue;
    }
    if (t === "dash" || t === "hyphen") {
      out.push("-");
      continue;
    }
    if (t === "plus") {
      out.push("+");
      continue;
    }

    // Handle things like "t.d.a." or "f-y" passed through
    const stripped = t.replace(/[^a-z0-9@._+\-]/g, "");
    if (stripped.includes("@") || stripped.includes(".")) {
      out.push(stripped);
      continue;
    }

    // NATO phonetics and single-letter spelling
    if (nato[stripped]) {
      out.push(nato[stripped]);
      continue;
    }
    if (/^[a-z]$/.test(stripped)) {
      out.push(stripped);
      continue;
    }

    // Common domain shortcuts
    if (stripped === "gmail") {
      out.push("gmail");
      continue;
    }
    if (stripped === "yahoo") {
      out.push("yahoo");
      continue;
    }

    // Otherwise append literal token
    out.push(stripped);
  }

  const joined = out
    .join("")
    .replace(/\.+/g, ".")
    .replace(/@+/g, "@")
    .replace(/\s+/g, "")
    .trim();

  // Try to repair missing punctuation in common endings
  let candidate = joined;
  candidate = candidate
    .replace(/\(at\)/g, "@")
    .replace(/\(dot\)/g, ".")
    .replace(/\.(com|net|org)\b/g, ".$1");

  const email = candidate;
  if (!isValidEmail(email)) {
    return {
      success: false,
      confidence: 0.25,
      message:
        "Could not confidently parse a valid email. Ask the caller to spell it letter-by-letter (or using phonetics like Alpha/Bravo), including 'at' and 'dot'.",
    };
  }

  // Basic confidence heuristic: higher if original already looked like an email.
  const confidence = raw.includes("@") ? 0.9 : 0.7;
  return {
    success: true,
    email,
    confidence,
    message: "Parsed email from spelling",
  };
}

function transcriptIsAffirmative(transcript: string): boolean {
  const t = (transcript || "").trim().toLowerCase();
  if (!t) return false;
  // Keep conservative.
  return (
    t === "yes" ||
    t === "yes." ||
    t === "correct" ||
    t === "correct." ||
    t.includes("that's correct") ||
    t.includes("that is correct") ||
    t.includes("yes i am") ||
    t.includes("that's me") ||
    t.includes("that is me")
  );
}

function transcriptIsNegative(transcript: string): boolean {
  const t = (transcript || "").trim().toLowerCase();
  if (!t) return false;
  return (
    t === "no" || t === "no." || t.includes("not me") || t.includes("wrong")
  );
}

interface TwilioRealtimeSession {
  sessionId: string;
  callSid: string;
  streamSid: string;
  tenantId: string;
  workflowId?: string;
  openaiWs?: WebSocket;
  twilioWs?: WebSocket;
  conversationHistory: any[];
  systemPrompt: string;
  documentIds?: string[];
  agentName?: string;
  greeting?: string;
  greetingSent?: boolean;
  greetingInProgress?: boolean; // Track if initial greeting is currently being spoken
  infoRequestSent?: boolean; // Track if we've already requested missing info
  responseInProgress?: boolean;
  pendingHangupReason?: string;
  hangupAfterThisResponse?: boolean;
  heardUserSpeech?: boolean;
  bargeInActive?: boolean;
  responseRequested?: boolean;
  silencePromptCount?: number;
  lastUserSpeechTime?: number;
  silenceCheckTimeout?: NodeJS.Timeout;
  workflowContext?: any; // Store workflow context for variable resolution
}

/**
 * Twilio Realtime Voice Service
 * Integrates OpenAI Realtime API with Twilio Media Streams for natural voice
 */
export class TwilioRealtimeVoiceService extends EventEmitter {
  private sessions: Map<string, TwilioRealtimeSession> = new Map();
  private apiKey: string;
  private twilioService: TwilioService;
  private emailService: EmailService;
  private googleCalendar: GoogleCalendarService;
  private loggingService: any; // Will be imported

  constructor() {
    super();
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.twilioService = new TwilioService();
    this.emailService = new EmailService();
    this.googleCalendar = new GoogleCalendarService();
    // Dynamic import to avoid circular dependency
    import("./loggingService").then((module) => {
      this.loggingService = module.loggingService;
    });
  }

  private getDefaultTimeZone(session: TwilioRealtimeSession): string {
    const explicit =
      String(session.workflowContext?.customer?.timeZone ?? "").trim() ||
      String(session.workflowContext?.tenant?.timeZone ?? "").trim();
    if (explicit) return explicit;

    const callerCountry = String(session.workflowContext?.call?.callerCountry)
      .trim()
      .toUpperCase();
    const callerState = String(session.workflowContext?.call?.callerState)
      .trim()
      .toUpperCase();

    if (callerCountry === "US" && callerState) {
      const eastern = new Set([
        "CT",
        "DE",
        "FL",
        "GA",
        "IN",
        "KY",
        "MA",
        "MD",
        "ME",
        "MI",
        "NC",
        "NH",
        "NJ",
        "NY",
        "OH",
        "PA",
        "RI",
        "SC",
        "TN",
        "VA",
        "VT",
        "WV",
        "DC",
      ]);
      const central = new Set([
        "AL",
        "AR",
        "IA",
        "IL",
        "KS",
        "LA",
        "MN",
        "MO",
        "MS",
        "ND",
        "NE",
        "OK",
        "SD",
        "TX",
        "WI",
      ]);
      const mountain = new Set(["AZ", "CO", "ID", "MT", "NM", "UT", "WY"]);
      const pacific = new Set(["CA", "NV", "OR", "WA"]);
      const alaska = new Set(["AK"]);
      const hawaii = new Set(["HI"]);

      if (eastern.has(callerState)) return "America/New_York";
      if (central.has(callerState)) return "America/Chicago";
      if (mountain.has(callerState)) return "America/Denver";
      if (pacific.has(callerState)) return "America/Los_Angeles";
      if (alaska.has(callerState)) return "America/Anchorage";
      if (hawaii.has(callerState)) return "Pacific/Honolulu";
    }

    return "America/New_York";
  }

  /**
   * Check if a time range falls within working hours
   */
  private checkWithinWorkingHours(
    start: DateTime,
    end: DateTime,
    workingHours: Record<string, { start: string; end: string } | null>,
    workingHoursTimeZone: string
  ): boolean {
    // Convert start/end to the working hours timezone
    const startInZone = start.setZone(workingHoursTimeZone);
    const endInZone = end.setZone(workingHoursTimeZone);

    // Get day of week (lowercase: monday, tuesday, etc.)
    const dayOfWeek = startInZone.weekdayLong?.toLowerCase();
    if (!dayOfWeek) return false;

    // Get working hours for this day
    const dayHours = workingHours[dayOfWeek];
    if (!dayHours || !dayHours.start || !dayHours.end) {
      // Day is not configured or marked as closed
      return false;
    }

    // Parse working hours times (format: "HH:mm")
    const [startHour, startMin] = dayHours.start.split(":").map(Number);
    const [endHour, endMin] = dayHours.end.split(":").map(Number);

    const workStart = startInZone.set({
      hour: startHour,
      minute: startMin,
      second: 0,
    });
    const workEnd = startInZone.set({
      hour: endHour,
      minute: endMin,
      second: 0,
    });

    // Check if appointment is within working hours
    return startInZone >= workStart && endInZone <= workEnd;
  }

  private async bookAppointment(
    session: TwilioRealtimeSession,
    input: {
      startTime: string;
      timeZone?: string;
      durationMinutes?: number;
      summary?: string;
      description?: string;
      location?: string;
      attendeeEmail?: string;
      requireCalendarEvent?: boolean;
      emailConfirmed?: boolean;
    }
  ): Promise<{
    success: boolean;
    message: string;
    attendeeEmail?: string;
    startTime?: string;
    endTime?: string;
    calendarEventId?: string;
    calendarEventHtmlLink?: string;
    calendarMeetLink?: string;
    calendarEventCreated?: boolean;
    calendarAvailabilityChecked?: boolean;
    calendarIsFree?: boolean;
    suggestions?: Array<{ startTime: string; endTime: string }>;
  }> {
    // Determine timezone: use agent timezone if assigned, otherwise use input or default
    const assignedAgent = session.workflowContext?.workflow?.assignedAgent;
    const timeZone =
      assignedAgent?.agentTimeZone ||
      String(input.timeZone || "").trim() ||
      this.getDefaultTimeZone(session);

    const tenantPrefs: any = await (prisma as any).tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        maxMeetingDurationMinutes: true,
        calendarAutoAddMeet: true,
        businessHours: true,
        businessTimeZone: true,
      },
    });

    const maxDurationMinutes = Math.min(
      8 * 60,
      Math.max(5, tenantPrefs?.maxMeetingDurationMinutes ?? 60)
    );

    const requestedDuration =
      typeof input.durationMinutes === "number" && input.durationMinutes > 0
        ? Math.floor(input.durationMinutes)
        : undefined;

    if (requestedDuration && requestedDuration > maxDurationMinutes) {
      return {
        success: false,
        message: `The maximum appointment length is ${maxDurationMinutes} minutes. Please choose a shorter duration.`,
      };
    }

    const durationMinutes = requestedDuration
      ? Math.min(maxDurationMinutes, requestedDuration)
      : Math.min(maxDurationMinutes, 30);

    const attendeeEmail = String(
      input.attendeeEmail || session.workflowContext?.customer?.email || ""
    )
      .trim()
      .toLowerCase();

    if (!attendeeEmail) {
      return {
        success: false,
        message: "Missing attendee email address",
      };
    }

    if (!isValidEmail(attendeeEmail)) {
      return {
        success: false,
        message:
          "That email address doesn't look valid. Please spell it letter by letter (or using phonetics like Alpha/Bravo), including 'at' and 'dot'.",
      };
    }

    const requireCalendarEvent =
      typeof input.requireCalendarEvent === "boolean"
        ? input.requireCalendarEvent
        : true;

    const emailConfirmed =
      Boolean(input.emailConfirmed) ||
      Boolean(session.workflowContext?.emailConfirmed === true);

    if (!emailConfirmed) {
      return {
        success: false,
        message:
          "Please confirm the email address is correct before booking. Read it back and ask for a yes/no confirmation.",
        attendeeEmail,
      };
    }

    const startRaw = String(input.startTime || "").trim();
    if (!startRaw) {
      return { success: false, message: "Missing start time" };
    }

    const hasExplicitZone = /([zZ]|[+-]\d\d:\d\d)$/.test(startRaw);
    const parsed = DateTime.fromISO(startRaw);
    if (!parsed.isValid) {
      return {
        success: false,
        message: "Invalid start time format (expected ISO 8601)",
      };
    }

    // Realtime models sometimes supply an ISO string with an arbitrary offset.
    // Interpret the *local time* the caller requested in the chosen timeZone.
    const start = hasExplicitZone
      ? parsed.setZone(timeZone, { keepLocalTime: true })
      : DateTime.fromISO(startRaw, { zone: timeZone });

    const end = start.plus({ minutes: durationMinutes });
    const startTime = start.toISO();
    const endTime = end.toISO();
    if (!startTime || !endTime) {
      return {
        success: false,
        message: "Failed to compute appointment time range",
      };
    }

    // Validate against working hours (agent's if assigned, otherwise tenant's business hours)
    const workingHours =
      assignedAgent?.workingHours || tenantPrefs?.businessHours;
    const workingHoursTimeZone =
      assignedAgent?.timezone || tenantPrefs?.businessTimeZone || timeZone;

    if (workingHours && typeof workingHours === "object") {
      const isWithinWorkingHours = this.checkWithinWorkingHours(
        start,
        end,
        workingHours as any,
        workingHoursTimeZone
      );

      if (!isWithinWorkingHours) {
        const scheduleName = assignedAgent
          ? `${assignedAgent.name}'s schedule`
          : "business hours";
        return {
          success: false,
          message: `That time is outside ${scheduleName}. Please choose a time during working hours.`,
        };
      }
    }

    const summary =
      String(input.summary || "Call Appointment").trim() || "Call Appointment";
    const description = String(input.description || "").trim() || undefined;
    const location = String(input.location || "").trim() || undefined;

    // Calendar-first: check availability and create Google Calendar event on the connected calendar.
    let googleEvent: {
      eventId?: string;
      htmlLink?: string;
      meetLink?: string;
    } | null = null;
    let calendarAvailabilityChecked = false;
    let calendarIsFree: boolean | undefined;
    const suggestions: Array<{ startTime: string; endTime: string }> = [];

    try {
      // Availability check
      const availability = await this.googleCalendar.checkAvailability(
        session.tenantId,
        startTime,
        endTime,
        timeZone
      );

      calendarAvailabilityChecked = true;
      calendarIsFree = Boolean(availability?.isFree);

      if (!availability?.isFree) {
        // Suggest a few alternative 30-min slots by scanning forward.
        let cursor = start.plus({ minutes: 30 });
        const maxChecks = 24; // up to 12 hours ahead
        for (let i = 0; i < maxChecks && suggestions.length < 3; i += 1) {
          const s = cursor;
          const e = s.plus({ minutes: durationMinutes });
          const sIso = s.toISO();
          const eIso = e.toISO();
          if (!sIso || !eIso) break;

          try {
            const a = await this.googleCalendar.checkAvailability(
              session.tenantId,
              sIso,
              eIso,
              timeZone
            );
            if (a?.isFree) {
              suggestions.push({ startTime: sIso, endTime: eIso });
            }
          } catch {
            // ignore suggestion check errors
          }

          cursor = cursor.plus({ minutes: 30 });
        }

        return {
          success: false,
          message:
            "That time is not available on the connected calendar. Please choose a different time.",
          attendeeEmail,
          startTime,
          endTime,
          calendarEventCreated: false,
          calendarAvailabilityChecked,
          calendarIsFree: false,
          suggestions: suggestions.length ? suggestions : undefined,
        };
      }

      const addMeet = tenantPrefs?.calendarAutoAddMeet ?? true;

      const googleResult = await this.googleCalendar.createEvent(
        session.tenantId,
        {
          summary,
          description,
          location,
          startTime,
          endTime,
          attendees: [attendeeEmail],
          timeZone,
          sendUpdates: "all",
          addMeet,
        }
      );

      if (googleResult?.success) {
        googleEvent = {
          eventId: googleResult.eventId ?? undefined,
          htmlLink: googleResult.htmlLink ?? undefined,
          meetLink: googleResult.meetLink ?? undefined,
        };
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown calendar error";
      console.error(
        `[TwilioRealtime] Failed to create Google Calendar event (tenant=${session.tenantId}): ${msg}`
      );
    }

    if (requireCalendarEvent && !googleEvent?.eventId) {
      return {
        success: false,
        message:
          "I couldn't add this appointment to the connected Google Calendar (it may not be connected, or the Google Calendar API is disabled). Please connect/enable Google Calendar and try again.",
        attendeeEmail,
        startTime,
        endTime,
        calendarEventCreated: false,
        calendarAvailabilityChecked,
        calendarIsFree,
      };
    }

    const effectiveDescription =
      googleEvent?.meetLink &&
      !String(description ?? "").includes(String(googleEvent.meetLink))
        ? [String(description ?? "").trim(), `Join: ${googleEvent.meetLink}`]
            .filter(Boolean)
            .join("\n")
        : description;

    const { uid, ics } = buildIcsInvite({
      summary,
      description: effectiveDescription,
      location,
      startTime,
      endTime,
      timeZone,
      attendees: [attendeeEmail],
    });

    const subject = `Appointment Confirmation: ${summary}`;
    const body = [
      `Confirmed: ${summary}`,
      `When: ${start.toLocaleString(DateTime.DATETIME_FULL)}`,
      location ? `Location: ${location}` : "",
      googleEvent?.meetLink ? `Join: ${googleEvent.meetLink}` : "",
      googleEvent?.htmlLink ? `View: ${googleEvent.htmlLink}` : "",
      "\nThis email includes an .ics calendar invite attachment.",
    ]
      .filter(Boolean)
      .join("\n");

    await this.emailService.sendEmail({
      to: attendeeEmail,
      subject,
      body,
      isHtml: false,
      attachments: [
        {
          filename: "invite.ics",
          content: ics,
          contentType: "text/calendar; charset=utf-8; method=REQUEST",
        },
      ],
    });

    // Store useful outputs in session context for later responses if needed.
    session.workflowContext = session.workflowContext || {};
    session.workflowContext.emailConfirmed = true;
    session.workflowContext.booking = {
      uid,
      attendeeEmail,
      startTime,
      endTime,
      timeZone,
      summary,
      calendarEventId: googleEvent?.eventId,
      calendarEventHtmlLink: googleEvent?.htmlLink,
      calendarMeetLink: googleEvent?.meetLink,
    };

    // Log appointment to database
    if (this.loggingService && session.tenantId) {
      try {
        await this.loggingService.logAppointment({
          tenantId: session.tenantId,
          customerId: session.workflowContext?.customer?.id,
          customerName: session.workflowContext?.customer?.name,
          customerEmail: attendeeEmail,
          customerPhone: session.workflowContext?.call?.from,
          appointmentTime: start.toJSDate(),
          durationMinutes: durationMinutes,
          status: "SCHEDULED",
          eventId: googleEvent?.eventId,
          source: "voice",
          notes: description,
          metadata: {
            callSid: session.workflowContext?.call?.callSid,
            timeZone,
            meetLink: googleEvent?.meetLink,
          },
          conversationId: (session as any).conversationId,
        });
      } catch (logError) {
        console.error("[TwilioRealtime] Failed to log appointment:", logError);
      }
    }

    return {
      success: true,
      message: googleEvent?.eventId
        ? "Appointment booked on the connected calendar and confirmation email sent"
        : "Confirmation email sent (calendar event was not created)",
      attendeeEmail,
      startTime,
      endTime,
      calendarEventId: googleEvent?.eventId,
      calendarEventHtmlLink: googleEvent?.htmlLink,
      calendarMeetLink: googleEvent?.meetLink,
      calendarEventCreated: Boolean(googleEvent?.eventId),
      calendarAvailabilityChecked,
      calendarIsFree,
      suggestions: suggestions.length ? suggestions : undefined,
    };
  }

  private extractTextFromResponseDone(message: any): string {
    const response = message?.response;
    const outputs: any[] = Array.isArray(response?.output)
      ? response.output
      : [];

    const chunks: string[] = [];
    for (const out of outputs) {
      const content: any[] = Array.isArray(out?.content) ? out.content : [];
      for (const c of content) {
        if (typeof c?.text === "string") chunks.push(c.text);
        if (typeof c?.transcript === "string") chunks.push(c.transcript);
      }

      // Some schemas put text at the top level.
      if (typeof out?.text === "string") chunks.push(out.text);
      if (typeof out?.transcript === "string") chunks.push(out.transcript);
    }

    return chunks.join("\n").trim();
  }

  private extractUserTranscript(message: any): string {
    if (!message) return "";

    if (typeof message?.transcript === "string") return message.transcript;

    // Common shapes for transcription events.
    const item = message?.item;
    const content: any[] = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (typeof c?.transcript === "string") return c.transcript;
      if (typeof c?.text === "string") return c.text;
    }

    return "";
  }

  private userWantsToEndCall(transcript: string): boolean {
    const t = (transcript || "").toLowerCase();
    if (!t) return false;

    // Keep this conservative to avoid accidental hangups.
    return (
      t.includes("hang up") ||
      t.includes("end the call") ||
      t.includes("please end") ||
      t.includes("goodbye") ||
      t === "bye" ||
      t.includes("bye bye")
    );
  }

  async hangupCall(sessionId: string, reason: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(
      `[TwilioRealtime] Hanging up call ${session.callSid} (reason=${reason})`
    );

    try {
      await this.twilioService.endCall(session.callSid);
    } catch (error) {
      // If the caller already hung up, Twilio may reject the update; treat as best-effort.
      console.log(
        `[TwilioRealtime] Hangup best-effort failed for ${session.callSid}`
      );
    } finally {
      await this.endSession(sessionId);
    }
  }

  async endSessionByCallSid(callSid: string): Promise<void> {
    for (const [sessionId, s] of this.sessions.entries()) {
      if (s.callSid === callSid) {
        await this.endSession(sessionId);
      }
    }
  }

  /**
   * Start a new session when Twilio Media Stream connects
   */
  async startSession(
    callSid: string,
    streamSid: string,
    tenantId: string,
    workflowId?: string,
    systemPrompt?: string,
    documentIds?: string[],
    agentName?: string,
    greeting?: string,
    workflowContext?: any
  ): Promise<string> {
    const sessionId = `twilio_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    const session: TwilioRealtimeSession = {
      sessionId,
      callSid,
      streamSid,
      tenantId,
      workflowId,
      conversationHistory: [],
      systemPrompt:
        systemPrompt ||
        "You are a helpful AI assistant for customer support. Keep responses brief and natural.",
      documentIds,
      agentName,
      greeting,
      greetingSent: false,
      greetingInProgress: false,
      infoRequestSent: false,
      responseInProgress: false,
      heardUserSpeech: false,
      bargeInActive: false,
      responseRequested: false,
      silencePromptCount: 0,
      lastUserSpeechTime: Date.now(),
      workflowContext, // Store workflow context in session
    };

    this.sessions.set(sessionId, session);
    console.log(
      `[TwilioRealtime] Session ${sessionId} created for call ${callSid}`
    );
    if (agentName) {
      console.log(`[TwilioRealtime] Agent name: ${agentName}`);
    }
    if (documentIds && documentIds.length > 0) {
      console.log(
        `[TwilioRealtime] Documents available: ${documentIds.length}`
      );
    }
    if (workflowContext?.customer?.name) {
      console.log(
        `[TwilioRealtime] Customer: ${workflowContext.customer.name}`
      );
    }

    return sessionId;
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connectToOpenAI(
    sessionId: string,
    voice: string = "alloy"
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "OpenAI-Beta": "realtime=v1",
          },
        }
      );

      ws.on("open", () => {
        console.log(
          `[TwilioRealtime] OpenAI WebSocket connected for ${sessionId}`
        );

        // Configure session
        const config = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `${session.systemPrompt}\n\n${VOICE_CALL_RUNTIME_INSTRUCTIONS}\n\nWhen you learn the caller's name, email, phone number, order number, or reason for calling, use the update_customer_info function to save it.\n\nIDENTITY CHECK RULES:\n- If our records show a caller name, ask: "Are you <name>?" and wait for yes/no.\n- If the caller confirms, call update_customer_info with that same name to mark it verified.\n- If we do NOT have a name on file, always ask for their full name and save it.\n\nAPPOINTMENT BOOKING RULES:\n- Before calling book_appointment, ALWAYS confirm: date, time, time zone, and email address.\n- ALWAYS read back the email address slowly and ask the caller to confirm yes/no.\n- If the caller spells their email using patterns like "S for Sugar" or phonetics like "Tango", use normalize_email_spelling to reconstruct the email; then read it back and confirm.\n- Only call book_appointment AFTER email confirmation. Include emailConfirmed=true.\n- By default, require a Google Calendar event (requireCalendarEvent=true). If Google Calendar isn't available, ask if email-only is acceptable and only then set requireCalendarEvent=false.\n- If the caller says "tomorrow at 10", ask clarifying questions if date/time zone are ambiguous.\n- Booking must respect the connected Google Calendar schedule; if busy, offer alternatives.\n\nIf the caller asks to book/schedule an appointment or call, follow the rules above and then use the book_appointment function to create the appointment and send a confirmation email (with an .ics invite).`,
            voice: voice, // Options: alloy, echo, shimmer
            input_audio_format: "g711_ulaw", // Twilio uses mulaw
            output_audio_format: "g711_ulaw",
            input_audio_transcription: {
              model: "whisper-1",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.6, // Higher threshold = less sensitive to background noise
              prefix_padding_ms: 500, // Longer padding helps distinguish speech from noise
              silence_duration_ms: 1000, // Longer silence = more stable detection
              // We explicitly create responses after speech_stopped,
              // so the assistant reliably waits for the caller.
              create_response: false,
            },
            temperature: 0.8,
            tools: [
              {
                type: "function",
                name: "update_customer_info",
                description:
                  "Save customer information learned during the conversation (name, email, phone, order number, reason for calling)",
                parameters: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "The customer's full name",
                    },
                    email: {
                      type: "string",
                      description: "The customer's email address",
                    },
                    phone: {
                      type: "string",
                      description: "The customer's phone number",
                    },
                    orderNumber: {
                      type: "string",
                      description: "Order or account number",
                    },
                    reason: {
                      type: "string",
                      description: "The reason for their call",
                    },
                  },
                  required: [],
                },
              },
              {
                type: "function",
                name: "normalize_email_spelling",
                description:
                  "Normalize an email address from spoken/spelled input like 'T D A at yahoo dot com' or phonetics like 'Tango Delta Alpha at yahoo dot com'.",
                parameters: {
                  type: "object",
                  properties: {
                    spoken: {
                      type: "string",
                      description:
                        "The caller's spoken/spelled email input (including words like at/dot).",
                    },
                  },
                  required: ["spoken"],
                },
              },
              {
                type: "function",
                name: "book_appointment",
                description:
                  "Book an appointment/call and send a confirmation email with a calendar invite (.ics).",
                parameters: {
                  type: "object",
                  properties: {
                    startTime: {
                      type: "string",
                      description:
                        "Appointment start time as ISO 8601 (e.g. 2026-01-05T10:00:00-08:00)",
                    },
                    timeZone: {
                      type: "string",
                      description:
                        "IANA timezone name (e.g. America/Los_Angeles). If omitted, a tenant default is used.",
                    },
                    durationMinutes: {
                      type: "number",
                      description:
                        "Length in minutes (defaults to 30 if omitted).",
                    },
                    summary: {
                      type: "string",
                      description: "Short title for the appointment.",
                    },
                    description: {
                      type: "string",
                      description: "Optional notes for the invite.",
                    },
                    location: {
                      type: "string",
                      description:
                        "Optional location or 'Phone call' / 'Google Meet'.",
                    },
                    attendeeEmail: {
                      type: "string",
                      description:
                        "Email address to send the confirmation invite to. If omitted, uses the caller email on file.",
                    },
                    emailConfirmed: {
                      type: "boolean",
                      description:
                        "Set to true ONLY after you read back the email and the caller confirms it is correct.",
                    },
                    requireCalendarEvent: {
                      type: "boolean",
                      description:
                        "If true (recommended), booking should only succeed if the appointment is added to the connected Google Calendar. If false, allow email-only confirmation.",
                    },
                  },
                  required: ["startTime"],
                },
              },
            ],
            tool_choice: "auto",
          },
        };

        ws.send(JSON.stringify(config));

        session.openaiWs = ws;
        console.log(
          `[TwilioRealtime] Session ${sessionId} configured and ready`
        );
        resolve();
      });

      ws.on("message", (data: Buffer) => {
        this.handleOpenAIMessage(sessionId, data);
      });

      ws.on("error", (error) => {
        console.error(`[TwilioRealtime] OpenAI WebSocket error:`, error);
        reject(error);
      });

      ws.on("close", (code, reason) => {
        console.log(
          `[TwilioRealtime] OpenAI WebSocket closed for ${sessionId} - Code: ${code}, Reason: ${
            reason || "(none)"
          }`
        );
      });
    });
  }

  /**
   * Handle incoming audio from Twilio Media Stream
   */
  handleTwilioAudio(sessionId: string, audioPayload: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) return;

    // Twilio occasionally sends empty payloads; ignore them.
    if (!audioPayload) return;

    // Forward audio to OpenAI Realtime API
    session.openaiWs.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: audioPayload, // Base64 mulaw audio from Twilio
      })
    );
  }

  /**
   * Handle messages from OpenAI Realtime API
   */
  private handleOpenAIMessage(sessionId: string, data: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message = JSON.parse(data.toString());

      // Capture user transcription events (shape varies by event type).
      if (
        typeof message?.type === "string" &&
        message.type.includes("transcription")
      ) {
        const transcript = this.extractUserTranscript(message);
        if (transcript) {
          console.log(`[TwilioRealtime] User transcript: ${transcript}`);

          // Auto-handle identity/email confirmations when we have a pending candidate.
          if (session.workflowContext?.pendingIdentityName) {
            if (transcriptIsAffirmative(transcript)) {
              session.workflowContext.identityVerified = true;
              session.workflowContext.customer =
                session.workflowContext.customer || {};
              session.workflowContext.customer.name =
                session.workflowContext.pendingIdentityName;
              session.workflowContext.infoCollected =
                session.workflowContext.infoCollected || [];
              if (!session.workflowContext.infoCollected.includes("name")) {
                session.workflowContext.infoCollected.push("name");
              }
              delete session.workflowContext.pendingIdentityName;
              console.log(
                `[TwilioRealtime] Identity confirmed for ${session.workflowContext.customer.name}`
              );
            } else if (transcriptIsNegative(transcript)) {
              delete session.workflowContext.pendingIdentityName;
            }
          }

          if (session.workflowContext?.pendingEmailCandidate) {
            if (transcriptIsAffirmative(transcript)) {
              session.workflowContext.customer =
                session.workflowContext.customer || {};
              session.workflowContext.customer.email =
                session.workflowContext.pendingEmailCandidate;
              session.workflowContext.emailConfirmed = true;
              session.workflowContext.infoCollected =
                session.workflowContext.infoCollected || [];
              if (!session.workflowContext.infoCollected.includes("email")) {
                session.workflowContext.infoCollected.push("email");
              }
              delete session.workflowContext.pendingEmailCandidate;
              console.log(
                `[TwilioRealtime] Email confirmed: ${session.workflowContext.customer.email}`
              );
            } else if (transcriptIsNegative(transcript)) {
              session.workflowContext.emailConfirmed = false;
              delete session.workflowContext.pendingEmailCandidate;
            }
          }

          if (this.userWantsToEndCall(transcript)) {
            session.pendingHangupReason = "caller_requested";
            session.hangupAfterThisResponse = false;
          }
        }
      }

      switch (message.type) {
        case "session.created":
          console.log(`[TwilioRealtime] Session created:`, message.session.id);
          break;

        case "session.updated":
          console.log(`[TwilioRealtime] Session updated`);
          break;

        case "conversation.item.created":
          // Track conversation history
          if (message.item) {
            session.conversationHistory.push(message.item);
          }
          break;

        case "response.created":
          // Treat as active so we can cancel immediately on user barge-in.
          session.responseRequested = false;
          session.responseInProgress = true;
          break;

        case "response.audio.delta":
          session.responseInProgress = true;
          // If the user barges in, stop sending any further assistant audio.
          if (session.bargeInActive) {
            break;
          }
          // Stream audio back to Twilio
          if (message.delta && session.twilioWs) {
            session.twilioWs.send(
              JSON.stringify({
                event: "media",
                streamSid: session.streamSid,
                media: {
                  payload: message.delta, // Base64 mulaw audio
                },
              })
            );
          }
          break;

        case "response.audio.done":
          console.log(`[TwilioRealtime] Audio response complete`);
          break;

        case "response.done":
          console.log(`[TwilioRealtime] Response complete`);
          session.responseInProgress = false;
          session.responseRequested = false;

          // Mark greeting as complete if it was in progress
          if (session.greetingInProgress) {
            session.greetingInProgress = false;
            console.log(
              `[TwilioRealtime] Greeting completed - barge-in now enabled`
            );

            // After greeting, request missing information
            this.requestMissingInformation(sessionId);
          }

          // Agent-requested hangup via explicit marker in TEXT output.
          // (We hang up only after the response is done so the goodbye audio finishes.)
          {
            const text = this.extractTextFromResponseDone(message);
            if (text && text.includes(END_CALL_MARKER)) {
              session.pendingHangupReason = "agent_requested";
              session.hangupAfterThisResponse = true;
            }
          }

          if (session.pendingHangupReason && session.hangupAfterThisResponse) {
            // Wait 2 seconds to ensure the goodbye audio finishes playing before hanging up
            console.log(
              `[TwilioRealtime] Waiting 2s for goodbye audio to complete before hanging up`
            );
            const hangupReason = session.pendingHangupReason; // Capture reason before timeout
            setTimeout(() => {
              this.hangupCall(sessionId, hangupReason);
            }, 2000);
          } else {
            // Set up silence detection - check if user responds within 20 seconds
            this.scheduleSilenceCheck(sessionId);
          }
          break;

        case "response.cancelled":
          session.responseInProgress = false;
          session.responseRequested = false;
          break;

        case "input_audio_buffer.speech_started":
          console.log(
            `[TwilioRealtime] User started speaking - attempting to interrupt`
          );

          session.heardUserSpeech = true;
          session.bargeInActive = true;
          session.lastUserSpeechTime = Date.now();
          session.silencePromptCount = 0; // Reset silence counter when user speaks

          // Clear any pending silence check
          if (session.silenceCheckTimeout) {
            clearTimeout(session.silenceCheckTimeout);
            session.silenceCheckTimeout = undefined;
          }

          // Do NOT interrupt if the initial greeting is still in progress
          if (session.greetingInProgress) {
            console.log(
              `[TwilioRealtime] Greeting in progress - barge-in disabled`
            );
            break;
          }

          // Clear Twilio's audio buffer to stop playback immediately
          if (session.twilioWs) {
            session.twilioWs.send(
              JSON.stringify({
                event: "clear",
                streamSid: session.streamSid,
              })
            );
          }

          // Interrupt AI response ONLY if there's actually an active response
          if (session.openaiWs && session.responseInProgress) {
            console.log(
              `[TwilioRealtime] Cancelling active response for barge-in`
            );
            session.responseInProgress = false;
            session.responseRequested = false;
            session.openaiWs.send(
              JSON.stringify({
                type: "response.cancel",
              })
            );
          }
          break;

        case "input_audio_buffer.speech_stopped":
          console.log(`[TwilioRealtime] User stopped speaking`);

          session.bargeInActive = false;
          session.lastUserSpeechTime = Date.now();

          // Only create a response if the user actually spoke.
          if (!session.heardUserSpeech) {
            break;
          }

          session.heardUserSpeech = false;

          // Create a response ONLY after the user finishes speaking.
          // This prevents the assistant from talking without user input.
          if (session.openaiWs) {
            // With server_vad, committing here can race with internal buffer management
            // and can trigger input_audio_buffer_commit_empty.
            session.responseRequested = true;

            if (session.pendingHangupReason) {
              session.hangupAfterThisResponse = true;
            }

            session.openaiWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                  // If the caller wants to end the call, have the model say a short goodbye.
                  ...(session.pendingHangupReason
                    ? {
                        instructions:
                          "The caller wants to end the call. Reply with a very short goodbye and confirm you are ending the call now.",
                      }
                    : {}),
                },
              })
            );
          }
          break;

        case "response.function_call_arguments.done":
          console.log(`[TwilioRealtime] Function call:`, message);
          this.handleFunctionCall(sessionId, message);
          break;

        case "error":
          console.error(
            `[TwilioRealtime] Error from OpenAI (session ${sessionId}):`,
            message.error
          );
          // If error is severe, it may cause the session to close
          if (
            message.error?.type === "server_error" ||
            message.error?.code === "session_expired"
          ) {
            console.error(
              `[TwilioRealtime] Fatal error detected, session may disconnect`
            );
          }
          break;
      }
    } catch (error) {
      console.error(`[TwilioRealtime] Error parsing OpenAI message:`, error);
    }
  }

  /**
   * Handle function calls from OpenAI
   */
  private async handleFunctionCall(
    sessionId: string,
    message: any
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const callId = message.call_id;
    const functionName = message.name;
    const argsString = message.arguments;

    try {
      const args = JSON.parse(argsString);
      console.log(
        `[TwilioRealtime] Function ${functionName} called with:`,
        args
      );

      if (functionName === "update_customer_info") {
        // Update workflow context with collected information
        if (!session.workflowContext) {
          session.workflowContext = {};
        }
        if (!session.workflowContext.customer) {
          session.workflowContext.customer = {};
        }

        // Track what information was just collected
        const collectedItems: string[] = [];

        // Update context with provided information
        if (args.name) {
          session.workflowContext.customer.name = args.name;
          collectedItems.push("name");
          session.workflowContext.identityVerified = true;
          console.log(`[TwilioRealtime] Saved customer name: ${args.name}`);
        }
        if (args.email) {
          session.workflowContext.customer.email = args.email;
          collectedItems.push("email");
          console.log(`[TwilioRealtime] Saved customer email: ${args.email}`);
        }
        if (args.phone) {
          session.workflowContext.customer.phone = args.phone;
          collectedItems.push("phone");
          console.log(`[TwilioRealtime] Saved customer phone: ${args.phone}`);
        }
        if (args.orderNumber) {
          if (!session.workflowContext.customer.metadata) {
            session.workflowContext.customer.metadata = {};
          }
          session.workflowContext.customer.metadata.orderNumber =
            args.orderNumber;
          collectedItems.push("orderNumber");
          console.log(
            `[TwilioRealtime] Saved order number: ${args.orderNumber}`
          );
        }
        if (args.reason) {
          if (!session.workflowContext.customer.metadata) {
            session.workflowContext.customer.metadata = {};
          }
          session.workflowContext.customer.metadata.callReason = args.reason;
          collectedItems.push("reason");
          console.log(`[TwilioRealtime] Saved call reason: ${args.reason}`);
        }

        // Send function call result back to OpenAI
        if (session.openaiWs) {
          session.openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  success: true,
                  message: "Information saved",
                }),
              },
            })
          );

          // Check if there are more items to collect
          this.promptForNextItem(sessionId, collectedItems);
        }
      }

      if (functionName === "normalize_email_spelling") {
        const result = normalizeEmailFromSpoken(args.spoken);

        if (result.success && result.email) {
          session.workflowContext = session.workflowContext || {};
          session.workflowContext.pendingEmailCandidate = result.email;
          session.workflowContext.emailConfirmed = false;
        }

        if (session.openaiWs) {
          session.openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify(result),
              },
            })
          );

          // Encourage read-back and confirmation.
          if (result.success && result.email) {
            session.responseRequested = true;
            session.openaiWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                  instructions: `Read back this email address slowly and ask the caller to confirm yes/no: ${result.email}. If they say it's wrong, ask them to spell it again using letters or phonetics.`,
                },
              })
            );
          }
        }
      }

      if (functionName === "book_appointment") {
        const result = await this.bookAppointment(session, {
          startTime: args.startTime,
          timeZone: args.timeZone,
          durationMinutes: args.durationMinutes,
          summary: args.summary,
          description: args.description,
          location: args.location,
          attendeeEmail: args.attendeeEmail,
          requireCalendarEvent: args.requireCalendarEvent,
          emailConfirmed: args.emailConfirmed,
        });

        if (session.openaiWs) {
          session.openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify(result),
              },
            })
          );

          // Prompt the assistant to confirm to the caller.
          session.responseRequested = true;
          session.openaiWs.send(
            JSON.stringify({
              type: "response.create",
              response: {
                modalities: ["audio", "text"],
                instructions: result.success
                  ? result.calendarEventCreated
                    ? `Confirm the appointment is booked on the connected calendar. Read back the email address (${result.attendeeEmail}) and confirm it is correct. Briefly restate the time and time zone. Mention that a confirmation email with a calendar invite was sent.`
                    : `Tell the caller you sent a confirmation email with a calendar invite to ${result.attendeeEmail}, but the calendar event was not created on the connected calendar. Ask if they'd like to try again after connecting Google Calendar, or if email-only is acceptable.`
                  : result.suggestions?.length
                  ? `Explain you couldn't book that time because it conflicts with the connected calendar. Offer these alternative times (in the caller's time zone) and ask which one they want: ${result.suggestions
                      .map((s) => s.startTime)
                      .join(", ")}.`
                  : `Apologize and explain you couldn't book the appointment: ${result.message}. If Google Calendar isn't available, explain that the appointment was NOT added to the calendar. Ask if they'd like to proceed with email-only confirmation (and then retry with requireCalendarEvent=false), or if they want to connect/enable Google Calendar first.`,
              },
            })
          );
        }
      }
    } catch (error) {
      console.error(`[TwilioRealtime] Error handling function call:`, error);
    }
  }

  /**
   * Prompt for the next item after collecting information
   */
  private promptForNextItem(sessionId: string, justCollected: string[]): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) return;

    const requestInfo = session.workflowContext?.trigger?.requestInfo || {};

    // Initialize collected tracker if not exists
    if (!session.workflowContext) session.workflowContext = {};
    if (!session.workflowContext.infoCollected) {
      session.workflowContext.infoCollected = [];
    }

    // If we already have customer info from context, treat it as collected
    // so we don't re-ask after the caller says "that's it".
    if (requestInfo.name === true && session.workflowContext?.customer?.name) {
      if (!session.workflowContext.infoCollected.includes("name")) {
        session.workflowContext.infoCollected.push("name");
      }
    }
    if (
      requestInfo.email === true &&
      session.workflowContext?.customer?.email
    ) {
      if (!session.workflowContext.infoCollected.includes("email")) {
        session.workflowContext.infoCollected.push("email");
      }
    }
    if (
      requestInfo.callbackNumber === true &&
      (session.workflowContext?.customer?.phone ||
        session.workflowContext?.call?.from)
    ) {
      if (!session.workflowContext.infoCollected.includes("phone")) {
        session.workflowContext.infoCollected.push("phone");
      }
    }

    // Add just collected items to the tracker
    session.workflowContext.infoCollected.push(...justCollected);
    console.log(
      `[TwilioRealtime] Info collected so far: ${session.workflowContext.infoCollected.join(
        ", "
      )}`
    );

    // Build list of what still needs to be collected based ONLY on configuration
    const stillNeeded: string[] = [];
    const stillNeededKeys: string[] = [];

    if (
      requestInfo.name === true &&
      !session.workflowContext.infoCollected.includes("name")
    ) {
      stillNeeded.push("their full name");
      stillNeededKeys.push("name");
    }
    if (
      requestInfo.email === true &&
      !session.workflowContext.infoCollected.includes("email")
    ) {
      stillNeeded.push("their email address");
      stillNeededKeys.push("email");
    }
    if (
      requestInfo.callbackNumber === true &&
      !session.workflowContext.infoCollected.includes("phone")
    ) {
      stillNeeded.push("a callback phone number");
      stillNeededKeys.push("phone");
    }
    if (
      requestInfo.orderNumber === true &&
      !session.workflowContext.infoCollected.includes("orderNumber")
    ) {
      stillNeeded.push("their order or account number");
      stillNeededKeys.push("orderNumber");
    }
    if (
      requestInfo.reason === true &&
      !session.workflowContext.infoCollected.includes("reason")
    ) {
      stillNeeded.push("the reason for their call");
      stillNeededKeys.push("reason");
    }

    if (stillNeeded.length > 0) {
      console.log(
        `[TwilioRealtime] Still need to collect: ${stillNeeded.join(
          ", "
        )} (${stillNeededKeys.join(", ")})`
      );

      // Prompt for the next item
      const nextItem = stillNeeded[0];
      const continueInstructions = `Thank the caller briefly, then ask for ${nextItem}. Use the update_customer_info function when they provide it.`;

      session.responseRequested = true;
      session.openaiWs.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions: continueInstructions,
          },
        })
      );
    } else {
      console.log(`[TwilioRealtime] All requested information collected`);

      // All info collected, proceed with normal conversation
      const doneInstructions =
        "Thank the caller for providing their information. Now ask how you can help them today.";

      session.responseRequested = true;
      session.openaiWs.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions: doneInstructions,
          },
        })
      );
    }
  }

  /**
   * Set Twilio WebSocket connection for bidirectional audio
   */
  setTwilioWebSocket(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.twilioWs = ws;
      console.log(
        `[TwilioRealtime] Twilio WebSocket attached to session ${sessionId}`
      );

      // If we have a greeting, trigger it once audio path is ready.
      if (session.openaiWs && !session.greetingSent) {
        this.sendGreetingIfNeeded(sessionId);
      }
    }
  }

  private sendGreetingIfNeeded(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs || !session.twilioWs) return;
    if (session.greetingSent) return;

    console.log(`[TwilioRealtime] Preparing to send greeting`);

    // User-configured greeting (from workflow trigger) always takes precedence.
    let greetingTemplate = session.greeting || "";

    // Resolve variables in greeting if context is available
    if (greetingTemplate && session.workflowContext) {
      try {
        greetingTemplate = variableResolver.resolve(
          greetingTemplate,
          session.workflowContext
        );
        console.log(`[TwilioRealtime] Resolved greeting variables`);
      } catch (error) {
        console.error(
          `[TwilioRealtime] Error resolving greeting variables:`,
          error
        );
      }
    }

    const greetingText = normalizeGreeting(greetingTemplate, session.agentName);

    session.greetingSent = true;
    session.greetingInProgress = true; // Mark greeting as in progress
    console.log(
      `[TwilioRealtime] Sending greeting: ${greetingText.substring(0, 80)}...`
    );

    // Build greeting instructions - just the greeting, info will be requested after
    let greetingInstructions = `Say this greeting to the caller: "${greetingText}". Then stop and listen for their response.`;

    // Ask OpenAI Realtime to speak the greeting immediately.
    // Mark as requested so barge-in can cancel right away.
    session.responseRequested = true;
    session.responseInProgress = false; // Ensure we can detect interruption immediately
    session.openaiWs.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          instructions: greetingInstructions,
        },
      })
    );
  }

  /**
   * Request missing customer information after greeting
   */
  private requestMissingInformation(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs || session.infoRequestSent) {
      console.log(
        `[TwilioRealtime] Skip info request - openaiWs: ${!!session?.openaiWs}, infoRequestSent: ${
          session?.infoRequestSent
        }`
      );
      return;
    }

    // Get request info configuration from workflow context
    const requestInfo = session.workflowContext?.trigger?.requestInfo || {};

    console.log(`[TwilioRealtime] requestMissingInformation called`);
    console.log(
      `[TwilioRealtime] Full workflow context:`,
      JSON.stringify(session.workflowContext, null, 2)
    );
    console.log(
      `[TwilioRealtime] Request info config:`,
      JSON.stringify(requestInfo, null, 2)
    );

    // Check if we have customer information (for logging purposes)
    const hasCustomerName = session.workflowContext?.customer?.name;
    const hasCustomerEmail = session.workflowContext?.customer?.email;
    const hasPhoneNumber =
      session.workflowContext?.customer?.phone ||
      session.workflowContext?.call?.from;

    console.log(
      `[TwilioRealtime] Customer info - name: ${hasCustomerName}, email: ${hasCustomerEmail}, phone: ${hasPhoneNumber}`
    );

    // Build list of information to request.
    // Voice calls should always confirm identity for known callers, and always collect a name for unknown callers.
    const infoToRequest: string[] = [];

    const identityVerified = Boolean(session.workflowContext?.identityVerified);

    // For voice calls, if customer was found in database by phone number and has a name,
    // consider them verified (they called from their registered number)
    const customerFoundByPhone =
      Boolean(hasCustomerName) && Boolean(hasPhoneNumber);
    const shouldSkipNameVerification = customerFoundByPhone || identityVerified;

    const shouldVerifyKnownName =
      Boolean(hasCustomerName) && !shouldSkipNameVerification;
    const shouldCollectUnknownName = !hasCustomerName;

    if (shouldVerifyKnownName || shouldCollectUnknownName) {
      infoToRequest.push("their full name");
      console.log(
        `[TwilioRealtime] Will request/verify name (have=${
          hasCustomerName || "none"
        }, verified=${shouldSkipNameVerification})`
      );
    }

    if (requestInfo.email === true && !hasCustomerEmail) {
      infoToRequest.push("their email address");
      console.log(
        `[TwilioRealtime] Will request email (currently have: ${
          hasCustomerEmail || "none"
        })`
      );
    }

    if (requestInfo.callbackNumber === true && !hasPhoneNumber) {
      infoToRequest.push("a callback phone number");
      console.log(
        `[TwilioRealtime] Will request callback number (currently have: ${
          hasPhoneNumber || "none"
        })`
      );
    }

    if (requestInfo.orderNumber === true) {
      infoToRequest.push("their order or account number");
      console.log(`[TwilioRealtime] Will request order number`);
    }

    if (requestInfo.reason === true) {
      infoToRequest.push("the reason for their call");
      console.log(`[TwilioRealtime] Will request call reason`);
    }

    // If no info to request, skip
    if (infoToRequest.length === 0) {
      console.log(
        `[TwilioRealtime] No missing information to request - requestInfo:`,
        requestInfo
      );

      // Mark existing values as collected so later prompts don't re-ask.
      session.workflowContext = session.workflowContext || {};
      session.workflowContext.infoCollected =
        session.workflowContext.infoCollected || [];
      if (requestInfo.name === true && hasCustomerName) {
        if (!session.workflowContext.infoCollected.includes("name")) {
          session.workflowContext.infoCollected.push("name");
        }
      }
      if (requestInfo.email === true && hasCustomerEmail) {
        if (!session.workflowContext.infoCollected.includes("email")) {
          session.workflowContext.infoCollected.push("email");
        }
      }
      if (requestInfo.callbackNumber === true && hasPhoneNumber) {
        if (!session.workflowContext.infoCollected.includes("phone")) {
          session.workflowContext.infoCollected.push("phone");
        }
      }

      // Prevent repeat prompts.
      session.infoRequestSent = true;
      return;
    }

    session.infoRequestSent = true;
    const infoList = infoToRequest.join(", ");
    console.log(`[TwilioRealtime] Requesting missing info: ${infoList}`);

    // Store the list of info to collect in session for tracking
    session.workflowContext = session.workflowContext || {};
    session.workflowContext.infoToCollect = infoToRequest;
    session.workflowContext.infoCollected =
      session.workflowContext.infoCollected || [];

    // Build collection instructions with verification if we have existing data
    let collectionInstructions = `You need to collect the following information from the caller: ${infoList}.\n\n`;

    // If we have existing customer name, ask for verification first
    if (
      hasCustomerName &&
      (shouldVerifyKnownName || requestInfo.name === true)
    ) {
      session.workflowContext = session.workflowContext || {};
      session.workflowContext.pendingIdentityName = String(hasCustomerName);
      collectionInstructions += `IMPORTANT IDENTITY CHECK: Our records show this number belongs to ${hasCustomerName}. Start by asking: "Are you ${hasCustomerName}?" If they say YES, immediately call update_customer_info with name "${hasCustomerName}" (even though we already have it) to mark it verified/collected. If they say NO, ask for their full name and call update_customer_info with the correct name.\n\n`;
    }

    if (
      (requestInfo.name === true || shouldVerifyKnownName) &&
      hasCustomerName
    ) {
      collectionInstructions +=
        "IMPORTANT: Even if the caller confirms the same name we already have, still call update_customer_info with the confirmed name so the system marks it collected.\n\n";
    }

    if (requestInfo.email === true && hasCustomerEmail) {
      collectionInstructions +=
        "IMPORTANT: If the caller confirms the same email we already have, still call update_customer_info with the confirmed email so the system marks it collected.\n\n";
    }

    collectionInstructions += `Ask for ONE piece of information at a time. After the caller provides each piece:
1. Use the update_customer_info function to save what they told you
2. Then ask for the NEXT piece of information on the list
3. Continue until you have collected ALL items: ${infoList}

Start by asking for the first item now.`;

    session.responseRequested = true;
    session.openaiWs.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          instructions: collectionInstructions,
        },
      })
    );
  }

  /**
   * Schedule a silence check after AI finishes speaking
   * Prompts user if no response, and disconnects after 3 failed prompts
   */
  private scheduleSilenceCheck(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) return;

    // Clear any existing timeout
    if (session.silenceCheckTimeout) {
      clearTimeout(session.silenceCheckTimeout);
    }

    // Wait 20 seconds for user response
    session.silenceCheckTimeout = setTimeout(() => {
      const currentSession = this.sessions.get(sessionId);
      if (!currentSession?.openaiWs) return;

      const timeSinceLastSpeech =
        Date.now() - (currentSession.lastUserSpeechTime || 0);

      // If user spoke recently (within last 20 seconds), don't prompt
      if (timeSinceLastSpeech < 20000) {
        return;
      }

      const promptCount = currentSession.silencePromptCount || 0;

      if (promptCount >= 3) {
        // After 3 prompts with no response, disconnect
        console.log(
          `[TwilioRealtime] No response after 3 prompts, disconnecting call ${sessionId}`
        );

        currentSession.responseRequested = true;
        currentSession.openaiWs.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio", "text"],
              instructions:
                "Say: 'I haven't heard from you, so I'm going to disconnect this call now. Goodbye!' Then include the marker [[END_CALL]] in your text output.",
            },
          })
        );
      } else {
        // Prompt the user
        console.log(
          `[TwilioRealtime] Silence detected, prompting user (attempt ${
            promptCount + 1
          }/3)`
        );

        currentSession.silencePromptCount = promptCount + 1;
        currentSession.responseRequested = true;

        const prompts = [
          "Are you still there? How can I help you?",
          "Hello? I'm still here if you need assistance.",
          "I haven't heard from you. Is there anything else I can help with?",
        ];

        currentSession.openaiWs.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio", "text"],
              instructions: `Say: "${prompts[promptCount]}"`,
            },
          })
        );
      }
    }, 20000); // 20 second timeout
  }

  /**
   * End session and cleanup
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`[TwilioRealtime] Ending session ${sessionId}`);

    // Clear any pending silence check
    if (session.silenceCheckTimeout) {
      clearTimeout(session.silenceCheckTimeout);
    }

    // Close OpenAI WebSocket
    if (session.openaiWs) {
      session.openaiWs.close();
    }

    // Don't close Twilio WebSocket (Twilio manages it)

    this.sessions.delete(sessionId);
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): TwilioRealtimeSession | undefined {
    return this.sessions.get(sessionId);
  }
}

// Singleton instance
export const twilioRealtimeVoiceService = new TwilioRealtimeVoiceService();
