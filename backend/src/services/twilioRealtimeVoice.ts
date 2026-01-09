import WebSocket from "ws";
import { EventEmitter } from "events";
import { TwilioService } from "./twilio";
import { variableResolver } from "./variableResolver";
import { DateTime } from "luxon";
import prisma from "../lib/prisma";
import { buildIcsInvite } from "./calendarInvite";
import { EmailService } from "./email";
import { detectIntentFromConfiguredIntents } from "./intents/detectIntent";
import { GoogleCalendarService } from "./integrations/google/calendar";
import { CRMService } from "./crm";
import {
  normalizeWorkingHoursConfig,
  isNowWithinWorkingHours,
} from "./agentSchedule";
import { isTenantOpenNow } from "./businessHours";
import { isWebPhoneReady } from "./webPhonePresence";
import { toTwilioClientIdentity } from "./twilioClientIdentity";
import type { User } from "@prisma/client";

const END_CALL_MARKER = "[[END_CALL]]";

const VOICE_CALL_RUNTIME_INSTRUCTIONS = [
  "You are speaking with a caller on a live phone call.",
  "Keep responses concise and conversational.",
  "If the caller asks to speak with a human/agent/representative, acknowledge and say you are transferring them now.",
  "If the caller asks to end the call, respond with a brief goodbye and confirm you are ending the call.",
  `If you decide the call should be ended now, include the token ${END_CALL_MARKER} in your TEXT output only (do not say the token out loud).`,
  "If the caller says they are done (e.g. 'that's all', 'bye', 'goodbye', 'thank you'), you should thank them, say a short goodbye, and end the call.",
].join("\n");

function escapeXmlAttr(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeXmlText(value: string): string {
  return escapeXmlAttr(value);
}

function normalizeTwilioSayText(raw: string): string {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const maxChars = 2000;
  return text.length > maxChars ? text.slice(0, maxChars).trim() : text;
}

function normalizeE164Like(raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return "";
  return v.replace(/[^+0-9]/g, "");
}

function normalizeDialNumber(raw: string): string {
  const v = normalizeE164Like(raw);
  if (!v) return "";
  if (v.startsWith("+") && v.length >= 11) return v;

  // Best-effort normalization for common US formats.
  const digits = v.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // If we can't confidently normalize, return as-is.
  return v;
}

function normalizeDialCallerId(raw: string): string {
  const v = normalizeDialNumber(raw);
  // Twilio expects a verified callerId (typically a Twilio number) and generally prefers +E164.
  if (!v.startsWith("+")) return "";
  return v;
}

function deriveTransferDialActionUrl(params: {
  fallback: "stream" | "voicemail";
  phoneNumberId?: string;
}): string {
  const base = String(process.env.TWILIO_WEBHOOK_URL || "").trim();
  // TWILIO_WEBHOOK_URL is commonly set to .../voice or .../webhooks/twilio
  let urlBase = "";
  if (base.endsWith("/voice")) urlBase = base.replace(/\/voice$/, "");
  else urlBase = base;

  const actionPath = urlBase.endsWith("/webhooks/twilio")
    ? `${urlBase}/transfer-dial-action`
    : urlBase
    ? urlBase.endsWith("/")
      ? `${urlBase}transfer-dial-action`
      : `${urlBase}/transfer-dial-action`
    : "";

  if (!actionPath) return "";
  const u = new URL(actionPath);
  u.searchParams.set("fallback", params.fallback);
  if (params.phoneNumberId)
    u.searchParams.set("phoneNumberId", params.phoneNumberId);
  return u.toString();
}

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
  transferInProgress?: boolean;
  transferRequested?: boolean;
  transferReason?: string;
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
    workingHours: any,
    workingHoursTimeZone: string
  ): boolean {
    if (!workingHours || typeof workingHours !== "object") return false;

    // Convert start/end to the working hours timezone
    let startInZone = start.setZone(workingHoursTimeZone);
    let endInZone = end.setZone(workingHoursTimeZone);

    // Support both formats:
    // 1) { days: { mon:{enabled,start,end}, ... } }  (current)
    // 2) { monday:{start,end}, ... }                (legacy)
    // 3) { mon:{start,end}, ... }                   (legacy)
    const hasDaysObject = (raw: any): raw is { days: Record<string, any> } =>
      Boolean(
        raw &&
          typeof raw === "object" &&
          raw.days &&
          typeof raw.days === "object"
      );

    const weekdayShort = startInZone.toFormat("ccc").toLowerCase(); // mon/tue/...
    const weekdayLong = (startInZone.weekdayLong || "").toLowerCase(); // monday/...

    let dayConfig: any;
    if (hasDaysObject(workingHours)) {
      dayConfig = workingHours.days?.[weekdayShort];
      if (!dayConfig?.enabled) return false;
    } else {
      dayConfig =
        workingHours?.[weekdayLong] ??
        workingHours?.[weekdayShort] ??
        workingHours?.[weekdayShort.slice(0, 3)];
    }

    const dayStart = String(dayConfig?.start || "").trim();
    const dayEnd = String(dayConfig?.end || "").trim();
    if (!dayStart || !dayEnd) return false;

    const [startHour, startMin] = dayStart.split(":").map(Number);
    const [endHour, endMin] = dayEnd.split(":").map(Number);
    if (
      Number.isNaN(startHour) ||
      Number.isNaN(startMin) ||
      Number.isNaN(endHour) ||
      Number.isNaN(endMin)
    ) {
      return false;
    }

    const workStart = startInZone.set({
      hour: startHour,
      minute: startMin,
      second: 0,
    });
    let workEnd = startInZone.set({ hour: endHour, minute: endMin, second: 0 });

    // Handle overnight shifts (e.g., 22:00 -> 06:00)
    if (workEnd <= workStart) {
      workEnd = workEnd.plus({ days: 1 });
      if (endInZone <= startInZone) {
        endInZone = endInZone.plus({ days: 1 });
      }
    }

    return startInZone >= workStart && endInZone <= workEnd;
  }

  /**
   * Check calendar availability for a specific date and suggest available time slots
   */
  private async checkCalendarAvailability(
    session: TwilioRealtimeSession,
    input: {
      date: string;
      durationMinutes?: number;
    }
  ): Promise<{
    success: boolean;
    message: string;
    date?: string;
    timeZone?: string;
    availableSlots?: Array<{ startTime: string; endTime: string }>;
  }> {
    // Determine requested timezone (used as a hint). Do not ask callers for this; prefer workflow/tenant settings.
    const assignedAgent = session.workflowContext?.workflow?.assignedAgent;
    const workflow = session.workflowContext?.workflow;
    const requestedTimeZone =
      String((workflow?.businessTimeZone || "").trim()) ||
      String((session.workflowContext?.tenant?.timeZone || "").trim()) ||
      assignedAgent?.agentTimeZone ||
      this.getDefaultTimeZone(session);

    const durationMinutes = input.durationMinutes || 30;

    // Parse the date
    const dateStr = String(input.date || "").trim();
    if (!dateStr) {
      return {
        success: false,
        message: "Missing date parameter",
      };
    }

    const tenantPrefs: any = await (prisma as any).tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        businessHours: true,
        businessTimeZone: true,
      },
    });

    const hasDaysObject = (raw: any): boolean => {
      if (!raw || typeof raw !== "object") return false;
      const days = (raw as any).days;
      return Boolean(days && typeof days === "object");
    };

    const workingHours = hasDaysObject(workflow?.businessHours)
      ? workflow?.businessHours
      : assignedAgent?.workingHours || tenantPrefs?.businessHours;

    const scheduleTimeZone =
      String((workflow?.businessTimeZone || "").trim()) ||
      assignedAgent?.timezone ||
      tenantPrefs?.businessTimeZone ||
      requestedTimeZone;

    const parsed = DateTime.fromISO(dateStr, { zone: scheduleTimeZone });
    if (!parsed.isValid) {
      return {
        success: false,
        message: "Invalid date format (expected YYYY-MM-DD)",
      };
    }

    if (!workingHours || typeof workingHours !== "object") {
      return {
        success: false,
        message: "Working hours not configured",
      };
    }

    // Get the day of week
    const dayOfWeek = parsed.toFormat("EEE").toLowerCase(); // 'mon', 'tue', etc.
    const days = (workingHours as any).days;
    const dayConfig = days?.[dayOfWeek];

    if (!dayConfig?.enabled) {
      return {
        success: false,
        message: `We are closed on ${parsed.toFormat(
          "EEEE"
        )}. Please choose a different date.`,
        date: dateStr,
        timeZone: scheduleTimeZone,
      };
    }

    // Parse working hours for this day
    const startParts = String(dayConfig.start || "09:00")
      .split(":")
      .map(Number);
    const endParts = String(dayConfig.end || "17:00")
      .split(":")
      .map(Number);
    const workStartHour = startParts[0] ?? 9;
    const workStartMin = startParts[1] ?? 0;
    const workEndHour = endParts[0] ?? 17;
    const workEndMin = endParts[1] ?? 0;

    // Generate time slots from working hours start to end
    const availableSlots: Array<{ startTime: string; endTime: string }> = [];
    let cursor = parsed.set({
      hour: workStartHour,
      minute: workStartMin,
      second: 0,
    });
    const workEnd = parsed.set({
      hour: workEndHour,
      minute: workEndMin,
      second: 0,
    });

    // Check every 30-minute slot across the full working window
    const maxSlotsToCheck = 96;
    let slotsChecked = 0;

    while (cursor < workEnd && slotsChecked < maxSlotsToCheck) {
      const slotEnd = cursor.plus({ minutes: durationMinutes });

      // Make sure the slot doesn't extend past working hours
      if (slotEnd <= workEnd) {
        const startTime = cursor.toISO();
        const endTime = slotEnd.toISO();

        if (startTime && endTime) {
          try {
            // Check calendar availability
            const availability = await this.googleCalendar.checkAvailability(
              session.tenantId,
              startTime,
              endTime,
              scheduleTimeZone
            );

            if (availability?.isFree) {
              availableSlots.push({ startTime, endTime });
            }
          } catch (error) {
            console.error(
              `[TwilioRealtime] Failed to check availability for ${startTime}:`,
              error
            );
          }
        }
      }

      cursor = cursor.plus({ minutes: 30 });
      slotsChecked++;
    }

    // If we found a lot of slots, return a spread across the day (not just morning).
    const maxReturn = 12;
    let returnedSlots = availableSlots;
    if (availableSlots.length > maxReturn) {
      const pick: Array<{ startTime: string; endTime: string }> = [];
      const first = availableSlots.slice(0, 4);
      const last = availableSlots.slice(-4);
      const midStart = Math.max(0, Math.floor(availableSlots.length / 2) - 2);
      const middle = availableSlots.slice(midStart, midStart + 4);
      for (const s of [...first, ...middle, ...last]) {
        if (!pick.find((p) => p.startTime === s.startTime)) pick.push(s);
      }
      returnedSlots = pick.slice(0, maxReturn);
    }

    if (availableSlots.length === 0) {
      return {
        success: false,
        message: `No available time slots found for ${parsed.toFormat(
          "MMMM d, yyyy"
        )}. Please try a different date.`,
        date: dateStr,
        timeZone: scheduleTimeZone,
      };
    }

    return {
      success: true,
      message: `Found ${
        returnedSlots.length
      } available time slots for ${parsed.toFormat("MMMM d, yyyy")}`,
      date: dateStr,
      timeZone: scheduleTimeZone,
      availableSlots: returnedSlots,
    };
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
    // Determine timezone: prefer workflow/tenant settings; do not require callers to state a timezone.
    const assignedAgent = session.workflowContext?.workflow?.assignedAgent;
    const workflow = session.workflowContext?.workflow;

    const tenantPrefs: any = await (prisma as any).tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        maxMeetingDurationMinutes: true,
        calendarAutoAddMeet: true,
        businessHours: true,
        businessTimeZone: true,
      },
    });

    const timeZone =
      String((workflow?.businessTimeZone || "").trim()) ||
      String((tenantPrefs?.businessTimeZone || "").trim()) ||
      assignedAgent?.agentTimeZone ||
      String(input.timeZone || "").trim() ||
      this.getDefaultTimeZone(session);

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

    // Validate against working hours - check workflow override first, then agent, then tenant
    const hasDaysObject = (raw: any): boolean => {
      if (!raw || typeof raw !== "object") return false;
      const days = (raw as any).days;
      return Boolean(days && typeof days === "object");
    };

    const workingHours = hasDaysObject(workflow?.businessHours)
      ? workflow?.businessHours
      : assignedAgent?.workingHours || tenantPrefs?.businessHours;

    const workingHoursTimeZone =
      String((workflow?.businessTimeZone || "").trim()) ||
      assignedAgent?.timezone ||
      tenantPrefs?.businessTimeZone ||
      timeZone;

    console.log("[TwilioRealtime] Working hours check:", {
      hasWorkflowBusinessHours: hasDaysObject(workflow?.businessHours),
      workflowBusinessTimeZone: workflow?.businessTimeZone,
      workingHoursTimeZone,
      startTime,
      endTime,
      workingHours: JSON.stringify(workingHours),
    });

    if (workingHours && typeof workingHours === "object") {
      const isWithinWorkingHours = this.checkWithinWorkingHours(
        start,
        end,
        workingHours as any,
        workingHoursTimeZone
      );

      console.log(
        "[TwilioRealtime] isWithinWorkingHours:",
        isWithinWorkingHours
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

    // Best-effort: execute any HubSpot Search/Create workflow nodes after a successful booking.
    // This keeps HubSpot in sync with calls that booked an appointment.
    void this.runHubSpotWorkflowNodes(session).catch((err) => {
      console.error(
        "[TwilioRealtime] HubSpot workflow node execution failed:",
        err
      );
    });

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

  private buildWorkflowResolverContext(session: TwilioRealtimeSession): any {
    const rawName = String(
      session.workflowContext?.customer?.name || ""
    ).trim();
    const nameParts = rawName ? rawName.split(/\s+/).filter(Boolean) : [];
    const firstName =
      String(session.workflowContext?.customer?.firstName || "").trim() ||
      (nameParts.length ? nameParts[0] : "");
    const lastName =
      String(session.workflowContext?.customer?.lastName || "").trim() ||
      (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");

    return {
      customer: {
        ...(session.workflowContext?.customer || {}),
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      },
      call: session.workflowContext?.call || {},
      tenant: session.workflowContext?.tenant || {},
      workflow: session.workflowContext?.workflow || {},
      variables: {
        workflow: {
          booking: session.workflowContext?.booking || {},
        },
        conversation: {},
        global: {},
      },
    };
  }

  private linearizeWorkflow(nodes: any[], edges: any[]): any[] {
    const byId = new Map<string, any>();
    for (const n of nodes) {
      if (n && typeof n.id === "string") byId.set(n.id, n);
    }

    const start =
      nodes.find(
        (n: any) => n?.type === "trigger" && n?.label === "Incoming Call"
      ) || nodes.find((n: any) => n?.type === "trigger");
    if (!start?.id) return [];

    const out: any[] = [];
    const visited = new Set<string>();
    let current: any = start;
    let steps = 0;

    while (current?.id && !visited.has(current.id) && steps < 50) {
      visited.add(current.id);
      out.push(current);

      const outgoing = edges.filter((e: any) => e?.source === current.id);
      if (!outgoing.length) break;

      // If this is the appointment gate, prefer the "yes" path.
      let nextEdge: any = outgoing[0];
      const label = String(current?.label || "").toLowerCase();
      if (label.includes("request") && label.includes("appointment")) {
        const yes = outgoing.find(
          (e: any) => String(e?.label || "").toLowerCase() === "yes"
        );
        if (yes) nextEdge = yes;
      }

      const nextNode = nextEdge?.target
        ? byId.get(String(nextEdge.target))
        : undefined;
      if (!nextNode) break;
      current = nextNode;
      steps += 1;
    }

    return out;
  }

  private async runHubSpotWorkflowNodes(
    session: TwilioRealtimeSession
  ): Promise<void> {
    const workflowId = String(
      session.workflowContext?.workflow?.id || ""
    ).trim();
    if (!workflowId) return;

    const workflow: any = await (prisma as any).workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, tenantId: true, nodes: true, edges: true },
    });
    if (!workflow) return;

    const nodes: any[] = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    const edges: any[] = Array.isArray(workflow.edges) ? workflow.edges : [];
    const ordered = this.linearizeWorkflow(nodes, edges);
    const hubspotNodes = ordered.filter((n: any) =>
      String(n?.label || "").startsWith("HubSpot")
    );
    if (!hubspotNodes.length) return;

    console.log("[TwilioRealtime] HubSpot workflow sync starting", {
      workflowId,
      hubspotNodeCount: hubspotNodes.length,
    });

    const connection = await (prisma as any).crmConnection.findFirst({
      where: {
        tenantId: session.tenantId,
        crmType: "hubspot",
        status: "active",
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!connection?.id) {
      console.warn(
        "[TwilioRealtime] HubSpot workflow nodes skipped: no active HubSpot connection"
      );
      return;
    }

    const provider = await CRMService.getProvider(connection.id);
    const resolverContext = this.buildWorkflowResolverContext(session);

    const clean = (v: any): string => {
      const s = String(v ?? "").trim();
      return s.includes("{{") ? "" : s;
    };

    for (const node of hubspotNodes) {
      const nodeId = String(node?.id || "").trim() || undefined;
      const resolvedConfig = variableResolver.resolveObject(
        node?.config || {},
        resolverContext
      );
      const action =
        String(resolvedConfig?.action || "").trim() ||
        String(node?.label || "");
      const objectType = String(resolvedConfig?.objectType || "contact")
        .trim()
        .toLowerCase();

      console.log("[TwilioRealtime] HubSpot node start", {
        workflowId,
        nodeId,
        label: node?.label,
        action,
        objectType,
      });

      // Persist last results into session.workflowContext.hubspot so other steps can reference them later.
      session.workflowContext = session.workflowContext || {};
      session.workflowContext.hubspot = session.workflowContext.hubspot || {};

      try {
        if (String(action).toLowerCase().includes("search")) {
          if (objectType === "contact") {
            const email = clean(
              resolvedConfig?.email || resolverContext?.customer?.email
            );
            const phone = clean(
              resolvedConfig?.phone || resolverContext?.customer?.phone
            );
            const name = clean(
              [resolvedConfig?.firstName, resolvedConfig?.lastName]
                .map((x: any) => clean(x))
                .filter(Boolean)
                .join(" ") || resolverContext?.customer?.name
            );

            console.log("[TwilioRealtime] HubSpot contact search criteria", {
              workflowId,
              nodeId,
              hasEmail: Boolean(email),
              hasPhone: Boolean(phone),
              hasName: Boolean(name),
            });

            const results = await provider.searchContacts({
              ...(email ? { email } : {}),
              ...(phone ? { phone } : {}),
              ...(!email && !phone && name ? { name } : {}),
            });
            session.workflowContext.hubspot.contactSearchResults = results;
            session.workflowContext.hubspot.contact = results?.[0] || null;

            const first = results?.[0];
            console.log("[TwilioRealtime] HubSpot contact search done", {
              workflowId,
              nodeId,
              count: Array.isArray(results) ? results.length : 0,
              firstId: first?.id || first?.hs_object_id || undefined,
            });
          }

          if (objectType === "company") {
            const name = clean(
              resolvedConfig?.companyName || resolvedConfig?.company
            );
            const domain = clean(resolvedConfig?.domain);

            console.log("[TwilioRealtime] HubSpot company search criteria", {
              workflowId,
              nodeId,
              hasName: Boolean(name),
              hasDomain: Boolean(domain),
            });

            const results = await provider.searchCompanies({
              ...(name ? { name } : {}),
              ...(domain ? { domain } : {}),
            });
            session.workflowContext.hubspot.companySearchResults = results;
            session.workflowContext.hubspot.company = results?.[0] || null;

            const first = results?.[0];
            console.log("[TwilioRealtime] HubSpot company search done", {
              workflowId,
              nodeId,
              count: Array.isArray(results) ? results.length : 0,
              firstId: first?.id || first?.hs_object_id || undefined,
            });
          }
        }

        if (String(action).toLowerCase().includes("create")) {
          if (objectType === "contact") {
            const email = clean(
              resolvedConfig?.email || resolverContext?.customer?.email
            );
            const firstName = clean(
              resolvedConfig?.firstName || resolverContext?.customer?.firstName
            );
            const lastName = clean(
              resolvedConfig?.lastName || resolverContext?.customer?.lastName
            );
            const phone = clean(
              resolvedConfig?.phone || resolverContext?.customer?.phone
            );
            const company = clean(resolvedConfig?.company);

            console.log("[TwilioRealtime] HubSpot contact create fields", {
              workflowId,
              nodeId,
              hasEmail: Boolean(email),
              hasFirstName: Boolean(firstName),
              hasLastName: Boolean(lastName),
              hasPhone: Boolean(phone),
              hasCompany: Boolean(company),
            });

            const created = await provider.createContact({
              ...(email ? { email } : {}),
              ...(firstName ? { firstName } : {}),
              ...(lastName ? { lastName } : {}),
              ...(phone ? { phone } : {}),
              ...(company ? { company } : {}),
            });
            session.workflowContext.hubspot.contact = created;

            console.log("[TwilioRealtime] HubSpot contact create done", {
              workflowId,
              nodeId,
              createdId: created?.id || created?.hs_object_id || undefined,
            });
          }

          if (objectType === "company") {
            const companyName = clean(
              resolvedConfig?.companyName ||
                resolvedConfig?.company ||
                "New Company"
            );
            const domain = clean(resolvedConfig?.domain);
            const phone = clean(resolvedConfig?.phone);

            console.log("[TwilioRealtime] HubSpot company create fields", {
              workflowId,
              nodeId,
              hasName: Boolean(companyName),
              hasDomain: Boolean(domain),
              hasPhone: Boolean(phone),
            });

            const created = await provider.createCompany({
              name: companyName,
              ...(domain ? { domain } : {}),
              ...(phone ? { phone } : {}),
            } as any);
            session.workflowContext.hubspot.company = created;

            console.log("[TwilioRealtime] HubSpot company create done", {
              workflowId,
              nodeId,
              createdId: created?.id || created?.hs_object_id || undefined,
            });
          }
        }

        console.log("[TwilioRealtime] HubSpot node done", {
          workflowId,
          nodeId,
          action,
          objectType,
        });
      } catch (err: any) {
        console.error("[TwilioRealtime] HubSpot node error", {
          workflowId,
          nodeId,
          label: node?.label,
          action,
          objectType,
          message: err?.message || String(err),
        });
      }
    }

    console.log("[TwilioRealtime] HubSpot workflow sync finished", {
      workflowId,
      hubspotNodeCount: hubspotNodes.length,
    });
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

  private async initiateHumanTransfer(
    sessionId: string,
    reason: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.workflowContext?.callbackRequested) {
      console.log(
        `[TwilioRealtime] Transfer suppressed in callback mode (reason=${reason})`
      );
      session.transferRequested = false;
      session.transferReason = undefined;
      return;
    }
    if (session.transferInProgress) return;
    session.transferInProgress = true;

    const transfer = (session.workflowContext?.call as any)?.humanTransfer;
    const nodeLabel = String(transfer?.nodeLabel || "").trim();
    const config = transfer?.config || {};

    const callerId = String(
      session.workflowContext?.trigger?.phoneNumber ||
        session.workflowContext?.call?.to ||
        ""
    ).trim();

    const callerIdForDial = normalizeDialCallerId(callerId);

    const phoneNumberId = String(
      session.workflowContext?.trigger?.phoneNumberId ||
        session.workflowContext?.call?.phoneNumberId ||
        ""
    ).trim();

    const ringToneConfigured = String(config?.ringTone || "").trim();
    const transferAnnouncement =
      normalizeTwilioSayText(String(config?.transferAnnouncement || "")) ||
      "Please hold while I transfer you to an agent.";
    const fallbackToVoicemail = Boolean(config?.fallbackToVoicemail ?? false);

    const timeoutSeconds = Number(config?.timeoutSeconds ?? 30);
    const timeout =
      Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
        ? Math.min(60, Math.max(5, timeoutSeconds))
        : 30;

    type ResolvedTargets = {
      numbers: string[];
      clients: string[];
      sequential?: boolean;
      orderedPairs?: Array<{ number?: string; client?: string }>; // preserve per-member pairing/order
      prioritizeWebPhone?: boolean;
      includeExternalNumbers?: boolean;
    };

    const tenantId = String(session.tenantId || "").trim();

    const tenant = tenantId
      ? await (prisma as any).tenant.findUnique({
          where: { id: tenantId },
          select: {
            businessTimeZone: true,
            businessHours: true,
            restrictExternalForwarding: true,
            externalForwardingAllowList: true,
          },
        })
      : null;

    const tenantTimeZone = String(tenant?.businessTimeZone || "").trim();
    const tenantHours = normalizeWorkingHoursConfig(
      (tenant as any)?.businessHours as any
    );

    const shouldRespectWorkingHours = Boolean(
      config?.respectWorkingHours ?? true
    );
    const onlyCheckedIn = Boolean(config?.onlyCheckedIn ?? true);
    const includeExternalNumbers = config?.includeExternalNumbers !== false;
    const prioritizeWebPhone = config?.prioritizeWebPhone ?? true;

    const isTenantOpen =
      tenantTimeZone && tenantHours && shouldRespectWorkingHours
        ? isTenantOpenNow({
            tenant: {
              timeZone: tenantTimeZone,
              businessHours: tenantHours as any,
            },
          })
        : true;

    const agentIsOpenNow = (user: any): boolean => {
      if (!shouldRespectWorkingHours) return true;
      const userTz = String(user?.agentTimeZone || "").trim();
      const userHours = normalizeWorkingHoursConfig(user?.workingHours);
      if (userTz && userHours) {
        return isNowWithinWorkingHours({
          workingHours: userHours,
          timeZone: userTz,
        }).isOpen;
      }
      if (tenantTimeZone && tenantHours) return isTenantOpen;
      return true;
    };

    const userTargets = (user: any): ResolvedTargets => {
      const numbers: string[] = [];
      const clients: string[] = [];

      const ready =
        tenantId && user?.id
          ? isWebPhoneReady({ tenantId, userId: String(user.id) })
          : false;
      if (ready) {
        clients.push(
          toTwilioClientIdentity({ tenantId, userId: String(user.id) })
        );
      }

      if (includeExternalNumbers) {
        const number = normalizeE164Like(
          user?.forwardingPhoneNumber ||
            (user as any)?.extensionForwardingNumber ||
            user?.phoneNumber ||
            ""
        );
        if (number) numbers.push(number);
      }

      const numberForPair = numbers[0];
      const clientForPair = clients[0];
      return {
        numbers,
        clients,
        orderedPairs: [{ number: numberForPair, client: clientForPair }],
        includeExternalNumbers,
        prioritizeWebPhone,
      };
    };

    const userIsAvailable = (user: any): boolean => {
      const ready =
        tenantId && user?.id
          ? isWebPhoneReady({ tenantId, userId: String(user.id) })
          : false;
      // Align with non-realtime routing: checked-in gating is independent of web phone readiness.
      if (onlyCheckedIn && !user?.isCheckedIn) return false;
      if (!agentIsOpenNow(user)) return false;
      const targets = userTargets(user);
      return targets.numbers.length > 0 || targets.clients.length > 0;
    };

    const isAllowedExternalNumber = (number: string): boolean => {
      if (!(tenant as any)?.restrictExternalForwarding) return true;
      const allowList = Array.isArray(
        (tenant as any)?.externalForwardingAllowList
      )
        ? (tenant as any).externalForwardingAllowList
        : [];
      const normalizedAllow = allowList
        .map((n: any) => normalizeE164Like(String(n || "")))
        .filter(Boolean);
      const normalizedNumber = normalizeE164Like(number);
      return normalizedAllow.includes(normalizedNumber);
    };

    const resolveFromWorkflowConfig =
      async (): Promise<ResolvedTargets | null> => {
        if (!nodeLabel) return null;

        // Call Forwarding
        if (nodeLabel === "Call Forwarding") {
          const overrideNumber = normalizeE164Like(
            String(
              config?.overrideNumber ?? config?.forwardingNumberOverride ?? ""
            )
          );
          if (overrideNumber) {
            if (!isAllowedExternalNumber(overrideNumber)) return null;
            return { numbers: [overrideNumber], clients: [] };
          }

          const targetType = String(config?.targetType || "external").trim();
          if (targetType === "external") {
            const number = normalizeE164Like(
              String(config?.externalNumber || "")
            );
            console.log(
              `[TwilioRealtime] Call Forwarding resolving external number: ${
                number || "(none)"
              }`
            );
            if (!number) {
              console.warn(
                `[TwilioRealtime] Call Forwarding: externalNumber is empty`
              );
              return null;
            }
            if (!isAllowedExternalNumber(number)) {
              console.warn(
                `[TwilioRealtime] Call Forwarding: external number ${number} blocked by allow-list`
              );
              return null;
            }
            console.log(
              `[TwilioRealtime] Call Forwarding: external number ${number} allowed, returning as target`
            );
            return { numbers: [number], clients: [] };
          }

          if (targetType === "user") {
            const userId = String(config?.userId || "").trim();
            if (!userId) return null;
            const user = await prisma.user.findFirst({
              where: {
                id: userId,
                tenantId,
                role: { in: ["TENANT_ADMIN", "AGENT"] },
              },
              select: {
                id: true,
                isCheckedIn: true,
                agentTimeZone: true,
                workingHours: true,
                extensionForwardingNumber: true,
                forwardingPhoneNumber: true,
                phoneNumber: true,
              } as any,
            });

            // Check if user is available
            if (user && userIsAvailable(user)) {
              return userTargets(user);
            }

            // User unavailable - check if fallback to external number is enabled
            const enableFallback = config?.enableFallbackExternal ?? false;
            if (!enableFallback) {
              return null;
            }

            // Use custom fallback number if provided, otherwise use user's extension forwarding number
            const customFallback = normalizeE164Like(
              String(config?.fallbackExternalNumber || "")
            );
            const userExtensionFallback = normalizeE164Like(
              String((user as any)?.extensionForwardingNumber || "")
            );
            const fallbackExternal = customFallback || userExtensionFallback;

            if (fallbackExternal) {
              console.log(
                `[TwilioRealtime] User unavailable, attempting fallback to external: ${fallbackExternal} (${
                  customFallback ? "custom" : "from extension"
                })`
              );
              if (!isAllowedExternalNumber(fallbackExternal)) {
                console.warn(
                  `[TwilioRealtime] Fallback external number ${fallbackExternal} blocked by allow-list`
                );
                return null;
              }
              return { numbers: [fallbackExternal], clients: [] };
            }

            return null;
          }

          if (targetType === "callGroup") {
            const callGroupId = String(config?.callGroupId || "").trim();
            if (!callGroupId) return null;
            const group = await (prisma as any).callGroup.findFirst({
              where: { id: callGroupId, tenantId },
              include: {
                members: {
                  orderBy: { order: "asc" },
                  include: {
                    user: {
                      select: {
                        id: true,
                        isCheckedIn: true,
                        agentTimeZone: true,
                        workingHours: true,
                        extensionForwardingNumber: true,
                        forwardingPhoneNumber: true,
                        phoneNumber: true,
                        role: true,
                      },
                    },
                  },
                },
              },
            });
            const members = (group?.members || [])
              .map((m: any) => m.user)
              .filter(
                (u: any) =>
                  u && (u.role === "TENANT_ADMIN" || u.role === "AGENT")
              );
            const numbers: string[] = [];
            const clients: string[] = [];
            const orderedPairs: Array<{ number?: string; client?: string }> =
              [];
            for (const u of members) {
              if (!userIsAvailable(u)) continue;
              const t = userTargets(u);
              numbers.push(...t.numbers);
              clients.push(...t.clients);
              orderedPairs.push({ number: t.numbers[0], client: t.clients[0] });
            }
            const sequential =
              String((group as any)?.ringStrategy || config?.ringStrategy || "")
                .trim()
                .toUpperCase() === "SEQUENTIAL";
            if (!numbers.length && !clients.length) return null;
            return {
              numbers,
              clients,
              sequential,
              orderedPairs,
              includeExternalNumbers,
              prioritizeWebPhone,
            };
          }

          return null;
        }

        // Call Group
        if (nodeLabel === "Call Group") {
          const callGroupId = String(config?.callGroupId || "").trim();
          if (!callGroupId) return null;

          const group = await (prisma as any).callGroup.findFirst({
            where: { id: callGroupId, tenantId },
            include: {
              members: {
                orderBy: { order: "asc" },
                include: {
                  user: {
                    select: {
                      id: true,
                      isCheckedIn: true,
                      agentTimeZone: true,
                      workingHours: true,
                      extensionForwardingNumber: true,
                      forwardingPhoneNumber: true,
                      phoneNumber: true,
                      role: true,
                    },
                  },
                },
              },
            },
          });

          const members = (group?.members || [])
            .map((m: any) => m.user)
            .filter(
              (u: any) => u && (u.role === "TENANT_ADMIN" || u.role === "AGENT")
            );

          const numbers: string[] = [];
          const clients: string[] = [];
          const orderedPairs: Array<{ number?: string; client?: string }> = [];
          for (const u of members) {
            if (!userIsAvailable(u)) continue;
            const t = userTargets(u);
            numbers.push(...t.numbers);
            clients.push(...t.clients);
            orderedPairs.push({ number: t.numbers[0], client: t.clients[0] });
          }

          const sequential =
            String((group as any)?.ringStrategy || config?.ringStrategy || "")
              .trim()
              .toUpperCase() === "SEQUENTIAL";

          if (!numbers.length && !clients.length) return null;
          return {
            numbers,
            clients,
            sequential,
            orderedPairs,
            includeExternalNumbers,
            prioritizeWebPhone,
          };
        }

        return null;
      };

    const resolveAssignedAgentFallback =
      async (): Promise<ResolvedTargets | null> => {
        const assignedAgent = session.workflowContext?.workflow?.assignedAgent;
        const assignedAgentId = String(assignedAgent?.id || "").trim();
        if (!assignedAgentId) return null;

        const user = await prisma.user.findFirst({
          where: {
            id: assignedAgentId,
            tenantId,
            role: { in: ["TENANT_ADMIN", "AGENT"] },
          },
          select: {
            id: true,
            isCheckedIn: true,
            agentTimeZone: true,
            workingHours: true,
            extensionForwardingNumber: true,
            forwardingPhoneNumber: true,
            phoneNumber: true,
          } as any,
        });
        if (!user || !userIsAvailable(user)) return null;
        return userTargets(user);
      };

    try {
      // Precedence:
      // 1) Workflow-configured transfer target (user/call group/external)
      // 2) Workflow assigned agent (if configured and available)
      // 3) If configured, voicemail fallback; else return to AI stream

      const resolved =
        (await resolveFromWorkflowConfig()) ||
        (await resolveAssignedAgentFallback());
      if (!resolved || (!resolved.numbers.length && !resolved.clients.length)) {
        if (fallbackToVoicemail && phoneNumberId) {
          const callbackBase = String(
            process.env.TWILIO_WEBHOOK_URL || ""
          ).trim();
          const voicemailUrl = callbackBase.endsWith("/voice")
            ? callbackBase.replace(/\/voice$/, "/voicemail")
            : callbackBase.endsWith("/webhooks/twilio")
            ? `${callbackBase}/voicemail`
            : callbackBase
            ? callbackBase.endsWith("/")
              ? `${callbackBase}voicemail`
              : `${callbackBase}/voicemail`
            : "";

          const actionAttr = voicemailUrl
            ? ` action="${escapeXmlAttr(
                voicemailUrl
              )}?phoneNumberId=${escapeXmlAttr(phoneNumberId)}" method="POST"`
            : "";

          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXmlText(
    "Sorry, no agents are available right now. Please leave a message after the beep."
  )}</Say>
  <Record${actionAttr} maxLength="120" playBeep="true" />
  <Say>Thank you. Goodbye.</Say>
  <Hangup/>
</Response>`;

          await this.twilioService.updateCallTwiml(session.callSid, twiml);
          // End the realtime session only after TwiML update succeeds.
          await this.endSession(sessionId);
          return;
        }

        console.warn(
          `[TwilioRealtime] Human transfer requested but no available target (reason=${reason}). Will notify AI after brief delay.`
        );

        // Mark that we're requesting a callback so we can create a conversation when phone is provided
        if (!session.workflowContext) {
          session.workflowContext = {};
        }
        session.workflowContext.callbackRequested = true;

        // Reset callback intake state so previously collected values don't satisfy callback requirements.
        session.workflowContext.callbackNameConfirmed = false;
        session.workflowContext.callbackNumberConfirmed = false;
        session.workflowContext.callbackMessageCollected = false;
        session.workflowContext.callbackRequestCreated = false;
        delete (session.workflowContext as any).pendingCallbackNumberCandidate;

        // Wait 3 seconds to simulate checking for agents, then notify AI
        // This creates a natural pause that simulates real PBX behavior
        setTimeout(() => {
          // Notify the AI that transfer failed so it can inform the caller
          if (session.openaiWs) {
            session.openaiWs.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "system",
                  content: [
                    {
                      type: "input_text",
                      text: `Transfer to agent failed - no agents are currently available. Politely inform the caller that no agents are available right now, apologize for the inconvenience, and ask if you can continue to help them or if they would prefer to leave a callback number.`,
                    },
                  ],
                },
              })
            );
            session.openaiWs.send(
              JSON.stringify({
                type: "response.create",
              })
            );
          }
        }, 3000);

        // Keep the realtime session alive
        session.transferInProgress = false;
        return;
      }

      // Normalize dial targets just before emitting TwiML.
      const dialNumbers = resolved.numbers
        .map((n) => normalizeDialNumber(n))
        .filter(Boolean);
      const dialClients = resolved.clients.filter(Boolean);

      if (!dialNumbers.length && !dialClients.length) {
        console.warn(
          `[TwilioRealtime] Human transfer requested but no dialable targets after normalization (reason=${reason}).`
        );
        session.transferInProgress = false;
        return;
      }

      const actionUrl = deriveTransferDialActionUrl({
        fallback: fallbackToVoicemail && phoneNumberId ? "voicemail" : "stream",
        phoneNumberId: phoneNumberId || undefined,
      });

      // If we have both client + number targets, force sequential to avoid simultaneous ringing.
      // Also used to ensure per-member client-first then number fallback.
      const effectiveSequential = Boolean(
        resolved.sequential ||
          (dialNumbers.length > 0 && dialClients.length > 0)
      );
      const sequentialAttr = effectiveSequential ? ` sequential="true"` : "";
      const ringToneEffective =
        ringToneConfigured || (dialNumbers.length ? "us" : "");
      const ringToneAttr = ringToneEffective
        ? ` ringTone="${escapeXmlAttr(ringToneEffective)}"`
        : "";
      const actionAttr = actionUrl
        ? ` action="${escapeXmlAttr(actionUrl)}" method="POST"`
        : "";

      const preferWeb = resolved.prioritizeWebPhone ?? prioritizeWebPhone;
      const allowExternal =
        resolved.includeExternalNumbers ?? includeExternalNumbers;

      // Build a deterministic sequential order:
      // - If we have per-member pairing, interleave (client -> number) per member.
      // - Otherwise, fall back to clients-first or numbers-first.
      const dialTargetsXml = (() => {
        const pairs = Array.isArray(resolved.orderedPairs)
          ? resolved.orderedPairs
          : [];
        if (pairs.length && effectiveSequential) {
          const parts: string[] = [];
          for (const p of pairs) {
            const client = String(p?.client || "").trim();
            const number = normalizeDialNumber(String(p?.number || "").trim());

            if (preferWeb) {
              if (client)
                parts.push(`<Client>${escapeXmlText(client)}</Client>`);
              if (allowExternal && number)
                parts.push(`<Number>${escapeXmlText(number)}</Number>`);
            } else {
              if (allowExternal && number)
                parts.push(`<Number>${escapeXmlText(number)}</Number>`);
              if (client)
                parts.push(`<Client>${escapeXmlText(client)}</Client>`);
            }
          }
          return parts.join("\n    ");
        }

        const numbersXml = dialNumbers
          .map((n) => `<Number>${escapeXmlText(n)}</Number>`)
          .join("\n    ");
        const clientsXml = dialClients
          .map((c) => `<Client>${escapeXmlText(c)}</Client>`)
          .join("\n    ");
        return preferWeb
          ? `${clientsXml}\n    ${numbersXml}`
          : `${numbersXml}\n    ${clientsXml}`;
      })();

      console.log(
        `[TwilioRealtime] Initiating human transfer for call ${session.callSid} (numbers=${dialNumbers.length}, clients=${dialClients.length}, reason=${reason})`
      );
      console.log(
        `[TwilioRealtime] Transfer context (nodeLabel=${
          nodeLabel || "(none)"
        }, callerId=${callerIdForDial || "(none)"}, actionUrl=${
          actionUrl || "(none)"
        })`
      );
      console.log(
        `[TwilioRealtime] Dial targets: numbers=[${dialNumbers.join(
          ", "
        )}], clients=[${dialClients.join(", ")}]`
      );

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXmlText(transferAnnouncement)}</Say>
  <Dial${
    callerIdForDial ? ` callerId="${escapeXmlAttr(callerIdForDial)}"` : ""
  } timeout="${timeout}" answerOnBridge="true"${sequentialAttr}${ringToneAttr}${actionAttr}>
    ${dialTargetsXml}
  </Dial>
</Response>`;

      await this.twilioService.updateCallTwiml(session.callSid, twiml);

      // End the realtime session once transfer TwiML is applied.
      await this.endSession(sessionId);
    } catch (error) {
      console.error(
        `[TwilioRealtime] Failed to initiate human transfer (call=${session.callSid}):`,
        error
      );
      // Keep the realtime session alive if we could not apply transfer TwiML.
      session.transferInProgress = false;
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

    const realtimeModel =
      process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";

    return new Promise((resolve, reject) => {
      const realtimeUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(
        realtimeModel
      )}`;
      const ws = new WebSocket(
        realtimeUrl,
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
            instructions: `${session.systemPrompt}\n\n${VOICE_CALL_RUNTIME_INSTRUCTIONS}\n\nWhen you learn the caller's name, email, phone number, order number, or reason for calling, use the update_customer_info function to save it.\n\nCALL CONTROL TOOLS (IMPORTANT):\n- If the caller asks for a human/agent/representative, call request_human_transfer (do not rely on keyword heuristics).\n- If you asked the caller to confirm their name or callback number and they answer yes/no, you MUST call confirm_callback_name or confirm_callback_number with confirmed=true/false before proceeding.\n- If you asked the caller to confirm an email address and they answer yes/no, you MUST call confirm_email with confirmed=true/false before proceeding.\n- If the caller wants to end the call now, call end_call (then give a very short goodbye).\n\nIDENTITY CHECK RULES:\n- If our records show a caller name, ask: "Are you <name>?" and wait for yes/no.\n- If the caller confirms, call update_customer_info with that same name to mark it verified.\n- If we do NOT have a name on file, always ask for their full name and save it.\n\nAPPOINTMENT BOOKING RULES:\n- Before calling book_appointment, ALWAYS confirm: date, time, and email address.\n- Do NOT ask the caller for their time zone. Use the workflow/tenant business time zone. Only capture a time zone if the caller explicitly provides one.\n- ALWAYS read back the email address slowly and ask the caller to confirm yes/no.\n- If the caller spells their email using patterns like "S for Sugar" or phonetics like "Tango", use normalize_email_spelling to reconstruct the email; then read it back and confirm.\n- Only call book_appointment AFTER email confirmation. Include emailConfirmed=true.\n- By default, require a Google Calendar event (requireCalendarEvent=true). If Google Calendar isn't available, ask if email-only is acceptable and only then set requireCalendarEvent=false.\n- If the caller says "tomorrow at 10", ask clarifying questions if date/time zone are ambiguous (do not ask for a time zone unless they brought it up).\n- Booking must respect the connected Google Calendar schedule; if busy, offer alternatives.\n\nIf the caller asks to book/schedule an appointment or call, follow the rules above and then use the book_appointment function to create the appointment and send a confirmation email (with an .ics invite).`,
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
                name: "request_human_transfer",
                description:
                  "Request transferring the caller to a human agent. Use when the caller asks to speak with a human/agent/representative.",
                parameters: {
                  type: "object",
                  properties: {
                    reason: {
                      type: "string",
                      description:
                        "Optional short reason/context for the transfer request.",
                    },
                  },
                  required: [],
                },
              },
              {
                type: "function",
                name: "end_call",
                description:
                  "End the call. Use when the caller explicitly wants to end the call, or after completing a callback intake flow.",
                parameters: {
                  type: "object",
                  properties: {
                    reason: {
                      type: "string",
                      description:
                        "Optional short reason for ending the call (e.g., caller_requested, callback_completed).",
                    },
                  },
                  required: [],
                },
              },
              {
                type: "function",
                name: "confirm_callback_name",
                description:
                  "Record whether the caller confirmed the name you read back during callback intake.",
                parameters: {
                  type: "object",
                  properties: {
                    confirmed: {
                      type: "boolean",
                      description:
                        "True if the caller confirmed the name is correct; false otherwise.",
                    },
                  },
                  required: ["confirmed"],
                },
              },
              {
                type: "function",
                name: "confirm_callback_number",
                description:
                  "Record whether the caller confirmed the callback phone number you read back during callback intake.",
                parameters: {
                  type: "object",
                  properties: {
                    confirmed: {
                      type: "boolean",
                      description:
                        "True if the caller confirmed the callback number is correct; false otherwise.",
                    },
                  },
                  required: ["confirmed"],
                },
              },
              {
                type: "function",
                name: "confirm_email",
                description:
                  "Record whether the caller confirmed an email address you read back.",
                parameters: {
                  type: "object",
                  properties: {
                    confirmed: {
                      type: "boolean",
                      description:
                        "True if the caller confirmed the email address is correct; false otherwise.",
                    },
                  },
                  required: ["confirmed"],
                },
              },
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
                        "Optional IANA timezone name (e.g. America/Los_Angeles) ONLY if the caller explicitly states it. If omitted, workflow/tenant business time zone is used.",
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
              {
                type: "function",
                name: "check_calendar_availability",
                description:
                  "Check if specific time slots are available on the connected calendar. Use this to suggest available times to the caller.",
                parameters: {
                  type: "object",
                  properties: {
                    date: {
                      type: "string",
                      description:
                        "Date to check availability for (YYYY-MM-DD format)",
                    },
                    durationMinutes: {
                      type: "number",
                      description:
                        "Desired appointment length in minutes (defaults to 30)",
                    },
                  },
                  required: ["date"],
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

          // Keep the transcript for debugging/observability only.
          // Call-control is handled via explicit tool calls (request_human_transfer/end_call/etc.).
          session.workflowContext = session.workflowContext || {};
          session.workflowContext.conversation =
            session.workflowContext.conversation || {};
          session.workflowContext.conversation.lastTranscript = transcript;
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
          if (message.delta && session.twilioWs && session.streamSid) {
            session.twilioWs.send(
              JSON.stringify({
                event: "media",
                streamSid: session.streamSid,
                media: {
                  payload: message.delta, // Base64 mulaw audio
                  track: "outbound",
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

          // Execute transfer if requested after AI finishes speaking
          if (
            session.transferRequested &&
            !session.transferInProgress &&
            !session.workflowContext?.callbackRequested
          ) {
            console.log(
              `[TwilioRealtime] AI response complete - waiting 2s for audio to finish before executing transfer (reason=${session.transferReason})`
            );
            const reason = session.transferReason || "user_request";
            session.transferRequested = false;
            session.transferReason = undefined;

            // Wait 2 seconds to ensure the transfer acknowledgment audio finishes playing
            setTimeout(() => {
              console.log(
                `[TwilioRealtime] Audio playback complete - executing transfer now (reason=${reason})`
              );
              void this.initiateHumanTransfer(sessionId, reason);
            }, 2000);
            return;
          } else if (session.workflowContext?.callbackRequested) {
            // Clear any stale transfer flags so we don't re-trigger during callback intake/confirmation.
            session.transferRequested = false;
            session.transferReason = undefined;
          }

          if (session.pendingHangupReason && session.hangupAfterThisResponse) {
            // Wait 3 seconds to ensure the goodbye audio finishes playing before hanging up
            console.log(
              `[TwilioRealtime] Waiting 3s for goodbye audio to complete before hanging up`
            );
            const hangupReason = session.pendingHangupReason; // Capture reason before timeout
            setTimeout(() => {
              this.hangupCall(sessionId, hangupReason);
            }, 3000);
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

      if (functionName === "request_human_transfer") {
        const callbackMode = Boolean(session.workflowContext?.callbackRequested);
        const reason = String(args?.reason || "").trim();

        if (callbackMode) {
          // In callback-request mode, do not attempt another transfer.
          session.transferRequested = false;
          session.transferReason = undefined;
          if (session.openaiWs) {
            session.openaiWs.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: JSON.stringify({
                    success: false,
                    message:
                      "Transfer is not allowed while collecting a callback request.",
                  }),
                },
              })
            );
          }
          return;
        }

        // No-op if already transferring.
        if (session.transferInProgress || session.transferRequested) {
          if (session.openaiWs) {
            session.openaiWs.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: JSON.stringify({
                    success: true,
                    message: "Transfer already in progress or queued.",
                  }),
                },
              })
            );
          }
          return;
        }

        session.transferRequested = true;
        session.transferReason = reason ? `tool:${reason}` : "tool:request_human_transfer";

        if (session.openaiWs) {
          session.openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  success: true,
                  message: "Transfer requested. Acknowledge briefly; transfer will start after your response.",
                }),
              },
            })
          );

          session.responseRequested = true;
          session.openaiWs.send(
            JSON.stringify({
              type: "response.create",
              response: {
                modalities: ["audio", "text"],
                instructions:
                  "Acknowledge you are transferring the caller to an agent now. Keep it brief.",
              },
            })
          );
        }
        return;
      }

      if (functionName === "end_call") {
        const reason = String(args?.reason || "tool_end_call").trim() || "tool_end_call";
        session.pendingHangupReason = reason;
        session.hangupAfterThisResponse = true;

        if (session.openaiWs) {
          session.openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({ success: true, message: "Ending call" }),
              },
            })
          );

          session.responseRequested = true;
          session.openaiWs.send(
            JSON.stringify({
              type: "response.create",
              response: {
                modalities: ["audio", "text"],
                instructions:
                  "Reply with a very short goodbye and confirm you are ending the call now.",
              },
            })
          );
        }
        return;
      }

      if (functionName === "confirm_callback_name") {
        const confirmed = Boolean(args?.confirmed);
        session.workflowContext = session.workflowContext || {};

        if (confirmed) {
          const pendingName = String(
            session.workflowContext?.pendingIdentityName || ""
          ).trim();
          if (pendingName) {
            session.workflowContext.customer = session.workflowContext.customer || {};
            session.workflowContext.customer.name = pendingName;
          }
          session.workflowContext.identityVerified = true;
          session.workflowContext.callbackNameConfirmed = true;
          session.workflowContext.infoCollected =
            session.workflowContext.infoCollected || [];
          if (!session.workflowContext.infoCollected.includes("name")) {
            session.workflowContext.infoCollected.push("name");
          }
          delete session.workflowContext.pendingIdentityName;
        } else {
          session.workflowContext.identityVerified = false;
          session.workflowContext.callbackNameConfirmed = false;
          delete session.workflowContext.pendingIdentityName;
        }

        if (session.openaiWs) {
          session.openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({ success: true, confirmed }),
              },
            })
          );

          if (confirmed) {
            this.promptForNextItem(sessionId, []);
          } else {
            session.responseRequested = true;
            session.openaiWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                  instructions:
                    "Okay. What is your full name? After they provide it, use update_customer_info with name.",
                },
              })
            );
          }
        }
        return;
      }

      if (functionName === "confirm_callback_number") {
        const confirmed = Boolean(args?.confirmed);
        session.workflowContext = session.workflowContext || {};

        if (confirmed) {
          const pendingNumber = String(
            session.workflowContext?.pendingCallbackNumberCandidate || ""
          ).trim();
          if (pendingNumber) {
            session.workflowContext.customer = session.workflowContext.customer || {};
            session.workflowContext.customer.phone = pendingNumber;
          }
          session.workflowContext.callbackNumberConfirmed = true;
          session.workflowContext.infoCollected =
            session.workflowContext.infoCollected || [];
          if (!session.workflowContext.infoCollected.includes("phone")) {
            session.workflowContext.infoCollected.push("phone");
          }
          delete session.workflowContext.pendingCallbackNumberCandidate;
        } else {
          session.workflowContext.callbackNumberConfirmed = false;
          delete session.workflowContext.pendingCallbackNumberCandidate;
        }

        if (session.openaiWs) {
          session.openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({ success: true, confirmed }),
              },
            })
          );

          if (confirmed) {
            this.promptForNextItem(sessionId, []);
          } else {
            session.responseRequested = true;
            session.openaiWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                  instructions:
                    "Okay. What is the best callback phone number to reach you? Please say the number slowly. After they provide it, use update_customer_info with phone.",
                },
              })
            );
          }
        }
        return;
      }

      if (functionName === "confirm_email") {
        const confirmed = Boolean(args?.confirmed);
        session.workflowContext = session.workflowContext || {};

        if (confirmed) {
          const pendingEmail = String(
            session.workflowContext?.pendingEmailCandidate || ""
          ).trim();
          if (pendingEmail) {
            session.workflowContext.customer = session.workflowContext.customer || {};
            session.workflowContext.customer.email = pendingEmail;
          }
          session.workflowContext.emailConfirmed = true;
          session.workflowContext.infoCollected =
            session.workflowContext.infoCollected || [];
          if (!session.workflowContext.infoCollected.includes("email")) {
            session.workflowContext.infoCollected.push("email");
          }
          delete session.workflowContext.pendingEmailCandidate;
        } else {
          session.workflowContext.emailConfirmed = false;
          delete session.workflowContext.pendingEmailCandidate;
        }

        if (session.openaiWs) {
          session.openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({ success: true, confirmed }),
              },
            })
          );

          if (!confirmed) {
            session.responseRequested = true;
            session.openaiWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                  instructions:
                    "Okay. Please spell your email address again slowly. You can say it as letters and words (like 'S as in Sam'), including 'at' and 'dot'. Then use normalize_email_spelling.",
                },
              })
            );
          }
        }

        return;
      }

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
        const callbackMode = Boolean(
          session.workflowContext?.callbackRequested
        );

        // Update context with provided information
        if (args.name) {
          session.workflowContext.customer.name = args.name;
          if (callbackMode) {
            session.workflowContext.pendingIdentityName = String(args.name);
            session.workflowContext.identityVerified = false;
            session.workflowContext.callbackNameConfirmed = false;
          } else {
            collectedItems.push("name");
            session.workflowContext.identityVerified = true;
          }
          console.log(`[TwilioRealtime] Saved customer name: ${args.name}`);
        }
        if (args.email) {
          session.workflowContext.customer.email = args.email;
          collectedItems.push("email");
          console.log(`[TwilioRealtime] Saved customer email: ${args.email}`);
        }
        if (args.phone) {
          if (callbackMode) {
            session.workflowContext.pendingCallbackNumberCandidate = String(
              args.phone
            );
            session.workflowContext.callbackNumberConfirmed = false;
          } else {
            session.workflowContext.customer.phone = args.phone;
            collectedItems.push("phone");
          }
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
          if (callbackMode) {
            session.workflowContext.callbackMessageCollected = true;
          }
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

          if (
            callbackMode &&
            session.workflowContext?.pendingIdentityName &&
            !session.workflowContext?.callbackNameConfirmed
          ) {
            session.responseRequested = true;
            session.openaiWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                  instructions: `Just to confirm, is your full name ${session.workflowContext.pendingIdentityName}? Please say yes or no.`,
                },
              })
            );
            return;
          }

          if (
            callbackMode &&
            session.workflowContext?.pendingCallbackNumberCandidate &&
            !session.workflowContext?.callbackNumberConfirmed
          ) {
            const pending = String(
              session.workflowContext.pendingCallbackNumberCandidate
            ).trim();
            session.responseRequested = true;
            session.openaiWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                  instructions: `Just to confirm, is your callback phone number ${pending}? Please say yes or no. Read the number slowly.`,
                },
              })
            );
            return;
          }

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

      if (functionName === "check_calendar_availability") {
        const result = await this.checkCalendarAvailability(session, {
          date: args.date,
          durationMinutes: args.durationMinutes,
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

          session.responseRequested = true;
          session.openaiWs.send(
            JSON.stringify({
              type: "response.create",
              response: {
                modalities: ["audio", "text"],
              },
            })
          );
        }
      }

      if (functionName === "book_appointment") {
        const currentIntent = String(
          session.workflowContext?.conversation?.intent || ""
        ).trim();

        if (
          !session.workflowContext?.callbackRequested &&
          (session.transferInProgress || currentIntent === "request_human")
        ) {
          if (!session.transferInProgress) {
            void this.initiateHumanTransfer(sessionId, "intent=request_human");
          }

          if (session.openaiWs) {
            session.openaiWs.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: JSON.stringify({
                    success: false,
                    message:
                      "Caller requested a human agent; booking is disabled. Transferring now.",
                  }),
                },
              })
            );
          }
          return;
        }

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

    const callbackMode = Boolean(session.workflowContext?.callbackRequested);
    const requestInfoRaw = session.workflowContext?.trigger?.requestInfo || {};
    const requestInfo = callbackMode
      ? {
          name: true,
          callbackNumber: true,
          reason: true,
        }
      : requestInfoRaw;

    // Initialize collected tracker if not exists
    if (!session.workflowContext) session.workflowContext = {};
    if (!session.workflowContext.infoCollected) {
      session.workflowContext.infoCollected = [];
    }

    // If we already have customer info from context, treat it as collected
    // so we don't re-ask after the caller says "that's it".
    // BUT: in callback mode, we must explicitly collect/confirm name + callback number,
    // so do not auto-mark them as collected.
    if (!callbackMode) {
      if (
        requestInfo.name === true &&
        session.workflowContext?.customer?.name
      ) {
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
    }

    // Add just collected items to the tracker
    session.workflowContext.infoCollected.push(...justCollected);
    console.log(
      `[TwilioRealtime] Info collected so far: ${session.workflowContext.infoCollected.join(
        ", "
      )}`
    );

    // Build list of what still needs to be collected.
    // In callback mode, base this on callback confirmation flags, not infoCollected.
    const stillNeeded: string[] = [];
    const stillNeededKeys: string[] = [];

    if (callbackMode) {
      const needName = !Boolean(session.workflowContext?.callbackNameConfirmed);
      const needPhone = !Boolean(
        session.workflowContext?.callbackNumberConfirmed
      );
      const needMessage = !Boolean(
        session.workflowContext?.callbackMessageCollected
      );

      if (needName) {
        stillNeeded.push("their full name");
        stillNeededKeys.push("name");
      } else if (needPhone) {
        stillNeeded.push("a callback phone number");
        stillNeededKeys.push("phone");
      } else if (needMessage) {
        stillNeeded.push("a short message about what they need");
        stillNeededKeys.push("reason");
      }
    } else {
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
    }

    if (stillNeeded.length > 0) {
      console.log(
        `[TwilioRealtime] Still need to collect: ${stillNeeded.join(
          ", "
        )} (${stillNeededKeys.join(", ")})`
      );

      // Prompt for the next item
      const nextItem = stillNeeded[0];
      const continueInstructions = `Ask the caller for ${nextItem}. Use the update_customer_info function when they provide it.`;

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

      // Callback-request flow: once we collected name + callback number + message,
      // create the callback request and close out the call.
      const isCallbackRequestReady =
        Boolean(session.workflowContext?.callbackRequested) &&
        Boolean(session.workflowContext?.callbackNameConfirmed) &&
        Boolean(session.workflowContext?.callbackNumberConfirmed) &&
        Boolean(session.workflowContext?.callbackMessageCollected);

      if (isCallbackRequestReady) {
        const callbackNumber = String(
          session.workflowContext?.customer?.phone || ""
        ).trim();
        const customerName = String(
          session.workflowContext?.customer?.name || ""
        ).trim();
        const message = String(
          session.workflowContext?.customer?.metadata?.callReason || ""
        ).trim();

        if (!session.workflowContext.callbackRequestCreated && callbackNumber) {
          session.workflowContext.callbackRequestCreated = true;
          this.createCallbackRequest(session, callbackNumber).catch((err) => {
            console.error(
              "[TwilioRealtime] Failed to create callback request:",
              err
            );
          });
        }

        const doneInstructions = `Read back the callback details and ask the caller to confirm they are correct.
- Name: ${customerName || "(missing)"}
- Callback number: ${callbackNumber || "(missing)"}
- Message: ${message || "(missing)"}

Read the callback number slowly and ask them to confirm yes/no. If they say it's wrong, ask for the corrected number and call update_customer_info with phone.
If they confirm, say: "Perfect! We've received your callback request. One of our agents will call you back as soon as possible. Thank you for your patience. Goodbye." Then include the token ${END_CALL_MARKER} in your text output (not spoken).`;

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
      } else {
        // Normal info collection - continue conversation
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
   * Create a callback request conversation when customer provides callback number
   */
  private async createCallbackRequest(
    session: TwilioRealtimeSession,
    callbackNumber: string
  ): Promise<void> {
    try {
      const tenantId = session.tenantId;
      const fromNumber = session.workflowContext?.call?.from || "unknown";
      const customerName =
        session.workflowContext?.customer?.name || `Caller ${fromNumber}`;
      const customerEmail = session.workflowContext?.customer?.email;

      if (!tenantId) {
        console.warn(
          "[TwilioRealtime] Cannot create callback request - no tenantId"
        );
        return;
      }

      console.log(
        `[TwilioRealtime] Creating callback request for ${customerName} at ${callbackNumber}`
      );

      // Find or create customer user
      const phoneDigits = fromNumber.replace(/\D/g, "");
      const tempEmail =
        customerEmail ||
        `voice-callback-${phoneDigits}-${Date.now()}@temp.connectflo.com`;

      let customer = await prisma.user.findFirst({
        where: {
          OR: [{ email: tempEmail }, { phoneNumber: fromNumber, tenantId }],
          tenantId,
        },
      });

      if (!customer) {
        customer = await prisma.user.create({
          data: {
            email: tempEmail,
            name: customerName,
            phoneNumber: fromNumber,
            role: "CUSTOMER",
            tenantId,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
              customerName
            )}`,
          },
        });
      }

      // Find existing open VOICE conversation or create new one
      let conversation = await prisma.conversation.findFirst({
        where: {
          tenantId,
          channel: "VOICE",
          customerId: customer.id,
          status: { not: "RESOLVED" },
        },
        orderBy: { lastActivity: "desc" },
      });

      if (!conversation) {
        // Get phone number for assignment
        const phoneNumberId = String(
          session.workflowContext?.trigger?.phoneNumberId ||
            session.workflowContext?.call?.phoneNumberId ||
            ""
        ).trim();

        const phoneNumber = phoneNumberId
          ? await prisma.phoneNumber.findUnique({
              where: { id: phoneNumberId },
              select: { afterHoursNotifyUserId: true },
            })
          : null;

        conversation = await prisma.conversation.create({
          data: {
            tenantId,
            channel: "VOICE",
            customerId: customer.id,
            assigneeId: phoneNumber?.afterHoursNotifyUserId || null,
            subject: `Callback Request from ${customerName}`,
            lastActivity: new Date(),
            tags: ["callback-requested"],
            status: "OPEN",
          },
        });
      }

      // Create message with callback request - format like voicemail, not chat
      const callReason =
        session.workflowContext?.customer?.metadata?.callReason ||
        "general inquiry";
      const messageContent = `Callback request received from ${fromNumber}${
        callbackNumber !== fromNumber
          ? ` - Customer provided callback number: ${callbackNumber}`
          : ""
      }\n\nCustomer Name: ${customerName}\nReason for Call: ${callReason}\n\nCustomer was unable to reach an agent and requested a callback.`;

      await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: conversation.id,
            tenantId,
            content: messageContent,
            sender: "CUSTOMER",
          },
        }),
        prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastActivity: new Date(),
            status: "PENDING", // Set to PENDING so it shows as requiring action
          },
        }),
      ]);

      console.log(
        `[TwilioRealtime] Callback request created in conversation ${conversation.id}`
      );

      // Note: Socket.IO notifications would be handled by the Express app, not this service
      // The conversation/message creation will be visible in the inbox once agents refresh
    } catch (error) {
      console.error("[TwilioRealtime] Error creating callback request:", error);
      throw error;
    }
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
    const requestInfoRaw = session.workflowContext?.trigger?.requestInfo || {};

    // If we're in callback-request mode (e.g., transfer failed and external calling isn't allowed),
    // force collection of callback info regardless of workflow trigger settings.
    const callbackMode = Boolean(session.workflowContext?.callbackRequested);
    const requestInfo = callbackMode
      ? {
          name: true,
          callbackNumber: true,
          reason: true,
        }
      : requestInfoRaw;

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

    const callbackNumberConfirmed = Boolean(
      session.workflowContext?.callbackNumberConfirmed
    );
    const callbackMessageCollected = Boolean(
      session.workflowContext?.callbackMessageCollected
    );

    const callbackNumberCandidate = String(
      session.workflowContext?.customer?.phone ||
        session.workflowContext?.call?.from ||
        ""
    ).trim();
    const hasPhoneNumber = callbackMode
      ? callbackNumberConfirmed
        ? callbackNumberCandidate
        : ""
      : callbackNumberCandidate;

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
          callbackNumberCandidate || "none"
        })`
      );
    }

    if (requestInfo.orderNumber === true) {
      infoToRequest.push("their order or account number");
      console.log(`[TwilioRealtime] Will request order number`);
    }

    if (requestInfo.reason === true) {
      if (!callbackMode || !callbackMessageCollected) {
        infoToRequest.push(
          callbackMode
            ? "a short message about what they need"
            : "the reason for their call"
        );
      }
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
    let collectionInstructions = callbackMode
      ? `We could not reach an agent. You must take a callback request and you MUST NOT offer to dial any other number unless the workflow explicitly enables external calling.\n\nCollect the following: ${infoList}.\n\nIMPORTANT: Confirm both the caller's name and callback phone number for correctness.\n\n`
      : `You need to collect the following information from the caller: ${infoList}.\n\n`;

    // If we have existing customer name, ask for verification first
    if (
      hasCustomerName &&
      (shouldVerifyKnownName || requestInfo.name === true)
    ) {
      session.workflowContext = session.workflowContext || {};
      session.workflowContext.pendingIdentityName = String(hasCustomerName);
      collectionInstructions += `IMPORTANT IDENTITY CHECK: Our records show this number belongs to ${hasCustomerName}. Start by asking: "Are you ${hasCustomerName}?" If they say YES, immediately call update_customer_info with name "${hasCustomerName}" (even though we already have it) to mark it verified/collected. If they say NO, ask for their full name and call update_customer_info with the correct name.\n\n`;
    }

    if (callbackMode && !hasCustomerName) {
      collectionInstructions += `IMPORTANT: After the caller gives their name, repeat it back and ask them to confirm yes/no. If they correct it, use update_customer_info with the corrected name.\n\n`;
    }

    if (
      callbackMode &&
      requestInfo.callbackNumber === true &&
      !callbackNumberConfirmed
    ) {
      if (callbackNumberCandidate) {
        session.workflowContext = session.workflowContext || {};
        session.workflowContext.pendingCallbackNumberCandidate = String(
          callbackNumberCandidate
        );
        collectionInstructions += `IMPORTANT CALLBACK CONFIRMATION: The caller ID shows ${callbackNumberCandidate}. Ask: "Is ${callbackNumberCandidate} the best number to call you back?" If YES, call update_customer_info with phone "${callbackNumberCandidate}". If NO, ask for the correct callback number and call update_customer_info with phone.\n\n`;
      } else {
        collectionInstructions += `IMPORTANT: After they give a callback number, read it back slowly and ask them to confirm yes/no. If they correct it, use update_customer_info with the corrected phone number.\n\n`;
      }
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

    const disableHangup = Boolean(
      (session.workflowContext?.call as any)?.disableSilenceHangup
    );

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
        // After 3 prompts with no response, disconnect (unless disabled)
        console.log(
          `[TwilioRealtime] No response after 3 prompts, disconnecting call ${sessionId}`
        );

        if (disableHangup) {
          currentSession.silencePromptCount = 0;
          currentSession.responseRequested = true;
          const callbackMode = Boolean(
            currentSession.workflowContext?.callbackRequested
          );
          currentSession.openaiWs.send(
            JSON.stringify({
              type: "response.create",
              response: {
                modalities: ["audio", "text"],
                instructions: callbackMode
                  ? "Say: 'Are you still there? I can take a callback request. Please tell me your name, the best phone number to call you back, and a short message about what you need.'"
                  : "Say: 'Are you still there? I can help you try a different number, or I can send you to voicemail.'",
              },
            })
          );
          return;
        }

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
