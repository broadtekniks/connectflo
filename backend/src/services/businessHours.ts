import { DateTime } from "luxon";

export type BusinessHoursDayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export interface BusinessHoursDay {
  enabled: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface BusinessHoursConfig {
  days: Record<BusinessHoursDayKey, BusinessHoursDay>;
}

export interface TenantBusinessHoursInfo {
  timeZone?: string | null;
  businessHours?: unknown | null;
}

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  days: {
    mon: { enabled: true, start: "09:00", end: "17:00" },
    tue: { enabled: true, start: "09:00", end: "17:00" },
    wed: { enabled: true, start: "09:00", end: "17:00" },
    thu: { enabled: true, start: "09:00", end: "17:00" },
    fri: { enabled: true, start: "09:00", end: "17:00" },
    sat: { enabled: false, start: "09:00", end: "17:00" },
    sun: { enabled: false, start: "09:00", end: "17:00" },
  },
};

const weekdayToKey = (weekday: number): BusinessHoursDayKey => {
  // Luxon: 1=Monday ... 7=Sunday
  switch (weekday) {
    case 1:
      return "mon";
    case 2:
      return "tue";
    case 3:
      return "wed";
    case 4:
      return "thu";
    case 5:
      return "fri";
    case 6:
      return "sat";
    case 7:
    default:
      return "sun";
  }
};

const isValidTime = (t: string): boolean => /^\d{2}:\d{2}$/.test(t);

export function normalizeBusinessHoursConfig(
  raw: unknown | null | undefined
): BusinessHoursConfig {
  const input = raw as any;
  const days = input?.days;
  if (!days || typeof days !== "object") return DEFAULT_BUSINESS_HOURS;

  const out: any = { days: { ...DEFAULT_BUSINESS_HOURS.days } };
  for (const key of Object.keys(out.days) as BusinessHoursDayKey[]) {
    const d = days?.[key];
    if (!d || typeof d !== "object") continue;

    const enabled = Boolean(d.enabled);
    const start =
      typeof d.start === "string" && isValidTime(d.start)
        ? d.start
        : out.days[key].start;
    const end =
      typeof d.end === "string" && isValidTime(d.end)
        ? d.end
        : out.days[key].end;

    out.days[key] = { enabled, start, end };
  }

  return out as BusinessHoursConfig;
}

export function isTenantOpenNow(options: {
  tenant: TenantBusinessHoursInfo;
  now?: Date;
}): boolean {
  const tz = (options.tenant.timeZone || "").trim() || "UTC";

  let now = DateTime.fromJSDate(options.now || new Date());
  try {
    now = now.setZone(tz);
  } catch {
    now = now.setZone("UTC");
  }

  const config = normalizeBusinessHoursConfig(options.tenant.businessHours);
  const dayKey = weekdayToKey(now.weekday);
  const day = config.days[dayKey];

  if (!day?.enabled) return false;

  const [sh, sm] = day.start.split(":").map((v) => parseInt(v, 10));
  const [eh, em] = day.end.split(":").map((v) => parseInt(v, 10));

  const start = now.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
  const end = now.set({ hour: eh, minute: em, second: 0, millisecond: 0 });

  // Handle overnight shifts (e.g. 22:00-06:00)
  if (end <= start) {
    // Open if we're after the start time (same day) OR before the end time (same day).
    return now >= start || now <= end;
  }

  return now >= start && now <= end;
}
