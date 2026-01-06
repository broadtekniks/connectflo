import React, { useEffect, useMemo, useState } from "react";
import { X, Clock } from "lucide-react";

type WorkingHoursDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type WorkingHoursConfig = Record<
  WorkingHoursDayKey,
  { start: string; end: string } | null
>;

const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  monday: { start: "09:00", end: "17:00" },
  tuesday: { start: "09:00", end: "17:00" },
  wednesday: { start: "09:00", end: "17:00" },
  thursday: { start: "09:00", end: "17:00" },
  friday: { start: "09:00", end: "17:00" },
  saturday: null,
  sunday: null,
};

const DAY_LABELS: Array<{ key: WorkingHoursDayKey; label: string }> = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

const isValidTime = (t: string): boolean => /^\d{2}:\d{2}$/.test(t);

const formatUtcOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const mm = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
};

const getTimeZoneOffsetMinutes = (timeZone: string, at: Date): number => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return Math.round((asUtc - at.getTime()) / 60000);
};

const getDetectedTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const FALLBACK_TIME_ZONES: string[] = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
];

interface WorkingHoursModalProps {
  isOpen: boolean;
  memberName: string;
  tenantTimeZone?: string | null;
  initialAgentTimeZone: string | null | undefined;
  initialWorkingHours:
    | null
    | Record<string, { start: string; end: string } | null>
    | undefined;
  canEdit: boolean;
  onCancel: () => void;
  onSave: (data: {
    agentTimeZone: string | null;
    workingHours: WorkingHoursConfig | null;
  }) => void;
}

const WorkingHoursModal: React.FC<WorkingHoursModalProps> = ({
  isOpen,
  memberName,
  tenantTimeZone,
  initialAgentTimeZone,
  initialWorkingHours,
  canEdit,
  onCancel,
  onSave,
}) => {
  const [useTenantDefault, setUseTenantDefault] = useState(true);
  const [agentTimeZone, setAgentTimeZone] = useState<string>("");
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig>({
    ...DEFAULT_WORKING_HOURS,
  });

  const timeZones = useMemo(() => {
    const now = new Date();
    try {
      const supportedValuesOf = (Intl as any)?.supportedValuesOf as
        | ((key: string) => string[])
        | undefined;
      if (typeof supportedValuesOf === "function") {
        const tzs = supportedValuesOf("timeZone");
        if (Array.isArray(tzs) && tzs.length > 0) {
          return tzs.map((tz) => {
            const offsetMinutes = getTimeZoneOffsetMinutes(tz, now);
            return {
              value: tz,
              label: `${tz} (${formatUtcOffset(offsetMinutes)})`,
            };
          });
        }
      }
    } catch {
      // ignore
    }
    return FALLBACK_TIME_ZONES.map((tz) => {
      const offsetMinutes = getTimeZoneOffsetMinutes(tz, now);
      return { value: tz, label: `${tz} (${formatUtcOffset(offsetMinutes)})` };
    });
  }, []);

  const tenantTimeZoneLabel = useMemo(() => {
    const tz =
      typeof tenantTimeZone === "string" && tenantTimeZone
        ? tenantTimeZone
        : getDetectedTimeZone();
    try {
      const offsetMinutes = getTimeZoneOffsetMinutes(tz, new Date());
      return `Tenant default — ${tz} (${formatUtcOffset(offsetMinutes)})`;
    } catch {
      return `Tenant default — ${tz}`;
    }
  }, [tenantTimeZone]);

  useEffect(() => {
    if (!isOpen) return;

    const hasCustom =
      initialWorkingHours && typeof initialWorkingHours === "object";
    setUseTenantDefault(!hasCustom);
    setAgentTimeZone(
      typeof initialAgentTimeZone === "string" ? initialAgentTimeZone : ""
    );

    if (hasCustom) {
      const next: any = { ...DEFAULT_WORKING_HOURS };
      for (const { key } of DAY_LABELS) {
        const day = (initialWorkingHours as any)?.[key];
        if (day === null) {
          next[key] = null;
        } else if (day && typeof day === "object") {
          const start = typeof day.start === "string" ? day.start : "";
          const end = typeof day.end === "string" ? day.end : "";
          next[key] =
            isValidTime(start) && isValidTime(end) ? { start, end } : next[key];
        }
      }
      setWorkingHours(next as WorkingHoursConfig);
    } else {
      setWorkingHours({ ...DEFAULT_WORKING_HOURS });
    }
  }, [isOpen, initialAgentTimeZone, initialWorkingHours]);

  const isSaveDisabled = useMemo(() => {
    if (!canEdit) return true;
    if (useTenantDefault) return false;
    // basic validation: enabled days must have valid start/end
    for (const { key } of DAY_LABELS) {
      const day = workingHours[key];
      if (day === null) continue;
      if (!isValidTime(day.start) || !isValidTime(day.end)) return true;
    }
    return false;
  }, [canEdit, useTenantDefault, workingHours]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-full shrink-0 bg-indigo-100 text-indigo-700">
                <Clock size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Working hours
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Set schedule for{" "}
                  <span className="font-semibold text-slate-700">
                    {memberName}
                  </span>
                  .
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {!canEdit && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You can view schedules, but you can only edit your own working
              hours.
            </div>
          )}

          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={useTenantDefault}
              disabled={!canEdit}
              onChange={(e) => setUseTenantDefault(e.target.checked)}
            />
            Use tenant business hours (fallback)
          </label>

          {!useTenantDefault && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Time zone (IANA)
                </label>
                <select
                  value={agentTimeZone}
                  disabled={!canEdit}
                  onChange={(e) => setAgentTimeZone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="">{tenantTimeZoneLabel}</option>
                  {timeZones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Leave blank to use tenant time zone.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
                  <div className="col-span-3">Day</div>
                  <div className="col-span-2">Open</div>
                  <div className="col-span-3">Start</div>
                  <div className="col-span-4">End</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {DAY_LABELS.map(({ key, label }) => {
                    const day = workingHours[key];
                    const enabled = day !== null;
                    return (
                      <div
                        key={key}
                        className="grid grid-cols-12 px-4 py-3 items-center"
                      >
                        <div className="col-span-3 text-sm font-medium text-slate-800">
                          {label}
                        </div>
                        <div className="col-span-2">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={enabled}
                            disabled={!canEdit}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setWorkingHours((prev) => ({
                                ...prev,
                                [key]: checked
                                  ? { start: "09:00", end: "17:00" }
                                  : null,
                              }));
                            }}
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="time"
                            value={enabled ? (day as any).start : ""}
                            disabled={!canEdit || !enabled}
                            onChange={(e) => {
                              const v = e.target.value;
                              setWorkingHours((prev) => ({
                                ...prev,
                                [key]: prev[key]
                                  ? { ...(prev[key] as any), start: v }
                                  : { start: v, end: "17:00" },
                              }));
                            }}
                            className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            type="time"
                            value={enabled ? (day as any).end : ""}
                            disabled={!canEdit || !enabled}
                            onChange={(e) => {
                              const v = e.target.value;
                              setWorkingHours((prev) => ({
                                ...prev,
                                [key]: prev[key]
                                  ? { ...(prev[key] as any), end: v }
                                  : { start: "09:00", end: v },
                              }));
                            }}
                            className="w-full px-2 py-1 border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isSaveDisabled}
            onClick={() =>
              onSave({
                agentTimeZone: useTenantDefault
                  ? null
                  : agentTimeZone.trim() || null,
                workingHours: useTenantDefault ? null : workingHours,
              })
            }
            className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkingHoursModal;
