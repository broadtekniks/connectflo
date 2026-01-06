import { DateTime } from "luxon";

export interface CalendarInviteInput {
  summary: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  timeZone?: string;
  organizerEmail?: string;
  attendees?: string[];
  uid?: string;
}

const escapeIcsText = (value: string) => {
  // RFC 5545 escaping: backslash, semicolon, comma, and newline
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
};

const formatUtc = (dt: DateTime) => dt.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");

export const buildIcsInvite = (input: CalendarInviteInput) => {
  const timeZone = String(input.timeZone || "UTC").trim() || "UTC";

  const start = DateTime.fromISO(String(input.startTime || "").trim(), {
    zone: timeZone,
  });
  const end = DateTime.fromISO(String(input.endTime || "").trim(), {
    zone: timeZone,
  });

  if (!start.isValid || !end.isValid) {
    throw new Error(
      `Invalid startTime/endTime for calendar invite (startTime=${input.startTime}, endTime=${input.endTime}, timeZone=${timeZone})`
    );
  }

  const uid =
    String(input.uid || "").trim() ||
    `connectflo_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}@connectflo`;

  const dtstamp = formatUtc(DateTime.utc());
  const dtstart = formatUtc(start);
  const dtend = formatUtc(end);

  const summary = escapeIcsText(String(input.summary || "Meeting").trim());
  const description = input.description
    ? escapeIcsText(String(input.description).trim())
    : undefined;
  const location = input.location
    ? escapeIcsText(String(input.location).trim())
    : undefined;

  const organizerEmail = String(input.organizerEmail || "").trim();
  const attendees = (input.attendees || [])
    .map((a) => String(a).trim())
    .filter(Boolean);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ConnectFlo//Calendar Invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
  ];

  if (description) lines.push(`DESCRIPTION:${description}`);
  if (location) lines.push(`LOCATION:${location}`);

  if (organizerEmail) {
    lines.push(`ORGANIZER:mailto:${escapeIcsText(organizerEmail)}`);
  }

  for (const email of attendees) {
    const safeEmail = escapeIcsText(email);
    lines.push(`ATTENDEE;RSVP=TRUE:mailto:${safeEmail}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  // Use CRLF per spec.
  return { uid, ics: lines.join("\r\n") + "\r\n" };
};
