export type WorkingHoursDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type WorkingHoursDay = { start: string; end: string } | null;

export type WorkingHoursConfig = Record<WorkingHoursDayKey, WorkingHoursDay>;

export type WorkingHoursCheckResult = {
  isOpen: boolean;
  dayKey: WorkingHoursDayKey;
};

export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  monday: { start: "09:00", end: "17:00" },
  tuesday: { start: "09:00", end: "17:00" },
  wednesday: { start: "09:00", end: "17:00" },
  thursday: { start: "09:00", end: "17:00" },
  friday: { start: "09:00", end: "17:00" },
  saturday: null,
  sunday: null,
};

export const isValidTimeZone = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const isValidTime = (t: string): boolean => {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [hh, mm] = t.split(":").map((v) => parseInt(v, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
};

export const normalizeWorkingHoursConfig = (
  raw: unknown | null | undefined
): WorkingHoursConfig | null => {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;

  const input = raw as any;
  const out: any = { ...DEFAULT_WORKING_HOURS };
  const keys = Object.keys(DEFAULT_WORKING_HOURS) as WorkingHoursDayKey[];

  for (const key of keys) {
    const day = input?.[key];
    if (day === null) {
      out[key] = null;
      continue;
    }
    if (!day || typeof day !== "object") continue;

    const start = typeof day.start === "string" ? day.start : "";
    const end = typeof day.end === "string" ? day.end : "";
    if (isValidTime(start) && isValidTime(end)) {
      out[key] = { start, end };
    }
  }

  return out as WorkingHoursConfig;
};

export const isNowWithinWorkingHours = (input: {
  workingHours: WorkingHoursConfig;
  timeZone: string;
  now?: Date;
}): WorkingHoursCheckResult => {
  const { workingHours, timeZone } = input;
  const now = input.now ? new Date(input.now) : new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const hourStr = parts.find((p) => p.type === "hour")?.value || "";
  const minuteStr = parts.find((p) => p.type === "minute")?.value || "";

  const dayKey = weekday.toLowerCase() as WorkingHoursDayKey;
  const hh = parseInt(hourStr, 10);
  const mm = parseInt(minuteStr, 10);
  const minutes =
    (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);

  const dayHours = (workingHours as any)?.[dayKey] as
    | WorkingHoursDay
    | undefined;
  if (!dayHours || !dayHours.start || !dayHours.end) {
    return { isOpen: false, dayKey };
  }

  if (!isValidTime(dayHours.start) || !isValidTime(dayHours.end)) {
    return { isOpen: false, dayKey };
  }

  const [startH, startM] = dayHours.start
    .split(":")
    .map((v) => parseInt(v, 10));
  const [endH, endM] = dayHours.end.split(":").map((v) => parseInt(v, 10));

  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  return { isOpen: minutes >= startMin && minutes <= endMin, dayKey };
};
