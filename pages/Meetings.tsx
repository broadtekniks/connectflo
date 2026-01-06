import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  User,
  Mail,
  ExternalLink,
  Video,
  AlertCircle,
  RefreshCw,
  Phone,
  Database,
} from "lucide-react";
import { api } from "../services/api";
import { DateTime } from "luxon";

interface Meeting {
  id: string;
  summary: string;
  startTime: string;
  endTime: string;
  htmlLink?: string;
  attendees: string[];
  customer?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  source?: string; // 'calendar' or 'voice' or 'chat'
  status?: string;
  notes?: string;
  eventId?: string;
}

interface MeetingsResponse {
  meetings: Meeting[];
  connected: boolean;
  total: number;
  message?: string;
}

interface AppointmentLog {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  appointmentTime: string;
  durationMinutes: number;
  status: string;
  eventId: string | null;
  source: string;
  notes: string | null;
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

const Meetings: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [appointmentLogs, setAppointmentLogs] = useState<AppointmentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "daily" | "monthly">("all");
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "calendar" | "logged"
  >("all");

  const loadMeetings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load both calendar meetings and appointment logs in parallel
      const [calendarData, logsData] = await Promise.all([
        api.meetings
          .list()
          .catch(() => ({
            meetings: [],
            connected: false,
            total: 0,
            message: undefined as string | undefined,
          })),
        api.appointmentLogs
          .list()
          .catch(() => ({ appointmentLogs: [], total: 0 })),
      ]);

      setMeetings(calendarData.meetings || []);
      setConnected(calendarData.connected);
      setAppointmentLogs(logsData.appointmentLogs || []);

      if (!calendarData.connected && calendarData.message) {
        setError(calendarData.message);
      }
    } catch (err) {
      console.error("Failed to load meetings:", err);
      setError("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const formatDateTime = (isoString: string) => {
    const dt = DateTime.fromISO(isoString);
    return dt.toLocaleString(DateTime.DATETIME_MED);
  };

  const formatTime = (isoString: string) => {
    const dt = DateTime.fromISO(isoString);
    return dt.toLocaleString(DateTime.TIME_SIMPLE);
  };

  const getDuration = (start: string, end: string) => {
    const startDt = DateTime.fromISO(start);
    const endDt = DateTime.fromISO(end);
    const diff = endDt.diff(startDt, ["hours", "minutes"]);

    if (diff.hours >= 1) {
      return `${Math.floor(diff.hours)}h ${Math.floor(diff.minutes % 60)}m`;
    }
    return `${Math.floor(diff.minutes)}m`;
  };

  const isUpcoming = (startTime: string) => {
    const dt = DateTime.fromISO(startTime);
    return dt > DateTime.now();
  };

  const isPast = (endTime: string) => {
    const dt = DateTime.fromISO(endTime);
    return dt < DateTime.now();
  };

  const isToday = (startTime: string) => {
    const dt = DateTime.fromISO(startTime);
    const now = DateTime.now();
    return dt.hasSame(now, "day");
  };

  const isThisMonth = (startTime: string) => {
    const dt = DateTime.fromISO(startTime);
    const now = DateTime.now();
    return dt.hasSame(now, "month") && dt.hasSame(now, "year");
  };

  // Merge calendar meetings and appointment logs
  const mergedMeetings: Meeting[] = [
    ...meetings.map((m) => ({ ...m, source: "calendar" as const })),
    ...appointmentLogs.map((log) => ({
      id: log.id,
      summary: `Appointment: ${log.customerName}`,
      startTime: log.appointmentTime,
      endTime:
        DateTime.fromISO(log.appointmentTime)
          .plus({ minutes: log.durationMinutes })
          .toISO() || "",
      attendees: log.customerEmail ? [log.customerEmail] : [],
      customer: log.customer
        ? {
            id: log.customer.id,
            name: log.customer.name,
            email: log.customer.email,
            phone: log.customer.phone,
          }
        : {
            id: "",
            name: log.customerName,
            email: log.customerEmail || "",
            phone: log.customerPhone || "",
          },
      source: log.source,
      status: log.status,
      notes: log.notes || undefined,
      eventId: log.eventId || undefined,
      htmlLink: log.eventId ? undefined : undefined, // Could link to conversation or details page
    })),
  ].sort((a, b) => {
    // Sort by start time, most recent first
    return (
      DateTime.fromISO(b.startTime).toMillis() -
      DateTime.fromISO(a.startTime).toMillis()
    );
  });

  const filteredMeetings = mergedMeetings.filter((meeting) => {
    // Apply time filter
    let passesTimeFilter = true;
    if (filter === "daily") passesTimeFilter = isToday(meeting.startTime);
    else if (filter === "monthly")
      passesTimeFilter = isThisMonth(meeting.startTime);

    // Apply source filter
    let passesSourceFilter = true;
    if (sourceFilter === "calendar")
      passesSourceFilter = meeting.source === "calendar";
    else if (sourceFilter === "logged")
      passesSourceFilter = meeting.source !== "calendar";

    return passesTimeFilter && passesSourceFilter;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCw
            className="mx-auto mb-4 animate-spin text-indigo-600"
            size={40}
          />
          <p className="text-slate-600">Loading meetings & appointments...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <AlertCircle className="mx-auto mb-4 text-amber-500" size={48} />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Google Calendar Not Connected
          </h2>
          <p className="text-slate-600 mb-4">
            Connect your Google Calendar to view and manage meeting invitations.
          </p>
          <button
            onClick={() => (window.location.href = "/integrations")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go to Integrations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={28} />
              Meetings & Appointments
            </h1>
            <p className="text-slate-600 mt-1">
              {filteredMeetings.length}{" "}
              {filteredMeetings.length === 1 ? "appointment" : "appointments"}{" "}
              {filter === "daily"
                ? "today"
                : filter === "monthly"
                ? "this month"
                : "total"}
              {sourceFilter !== "all" &&
                ` (${
                  sourceFilter === "calendar"
                    ? "from calendar"
                    : "logged internally"
                })`}
            </p>
          </div>
          <button
            onClick={loadMeetings}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="mb-4 space-y-3">
          {/* Time Filters */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700 mr-2">
              Time:
            </span>
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("daily")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "daily"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setFilter("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "monthly"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              This Month
            </button>
          </div>

          {/* Source Filters */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700 mr-2">
              Source:
            </span>
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sourceFilter === "all"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter("calendar")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                sourceFilter === "calendar"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Calendar size={16} />
              Google Calendar
            </button>
            <button
              onClick={() => setSourceFilter("logged")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                sourceFilter === "logged"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Database size={16} />
              Internal Logs
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle
              className="text-amber-600 flex-shrink-0 mt-0.5"
              size={20}
            />
            <div>
              <p className="text-sm font-medium text-amber-800">Warning</p>
              <p className="text-sm text-amber-700">{error}</p>
            </div>
          </div>
        )}

        {filteredMeetings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <Calendar className="mx-auto mb-4 text-slate-400" size={48} />
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              No appointments{" "}
              {filter === "daily"
                ? "today"
                : filter === "monthly"
                ? "this month"
                : "found"}
            </h3>
            <p className="text-slate-600">
              {(filter !== "all" || sourceFilter !== "all") &&
              (meetings.length > 0 || appointmentLogs.length > 0)
                ? "Try selecting different filters to view other appointments."
                : "Upcoming appointments will appear here once they are scheduled."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMeetings.map((meeting) => {
              const upcoming = isUpcoming(meeting.startTime);
              const past = isPast(meeting.endTime);
              const isCalendarEvent = meeting.source === "calendar";
              const statusColor = past
                ? "bg-slate-100 border-slate-200"
                : upcoming
                ? "bg-white border-indigo-200"
                : "bg-green-50 border-green-200";

              return (
                <div
                  key={`${meeting.source}-${meeting.id}`}
                  className={`border rounded-lg p-5 ${statusColor} transition-all hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Meeting Title */}
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-slate-800">
                          {meeting.summary}
                        </h3>
                        {!isCalendarEvent && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                            <Phone size={12} />
                            {meeting.source === "voice"
                              ? "Voice Call"
                              : meeting.source}
                          </span>
                        )}
                        {isCalendarEvent && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                            <Calendar size={12} />
                            Calendar
                          </span>
                        )}
                        {meeting.status && meeting.status !== "SCHEDULED" && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              meeting.status === "COMPLETED"
                                ? "bg-green-100 text-green-700"
                                : meeting.status === "CANCELLED"
                                ? "bg-red-100 text-red-700"
                                : meeting.status === "NO_SHOW"
                                ? "bg-orange-100 text-orange-700"
                                : meeting.status === "CONFIRMED"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {meeting.status}
                          </span>
                        )}
                        {!past && upcoming && !meeting.status && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                            Upcoming
                          </span>
                        )}
                        {!past && !upcoming && !meeting.status && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                            In Progress
                          </span>
                        )}
                        {past && !meeting.status && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded">
                            Past
                          </span>
                        )}
                      </div>

                      {/* Time & Duration */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-slate-400" />
                          <span>{formatDateTime(meeting.startTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">→</span>
                          <span>{formatTime(meeting.endTime)}</span>
                        </div>
                        <div className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">
                          {getDuration(meeting.startTime, meeting.endTime)}
                        </div>
                      </div>

                      {/* Notes (for logged appointments) */}
                      {meeting.notes && (
                        <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700">
                          <span className="font-medium">Notes:</span>{" "}
                          {meeting.notes}
                        </div>
                      )}

                      {/* Customer Info */}
                      {meeting.customer ? (
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            {meeting.customer.avatar ? (
                              <img
                                src={meeting.customer.avatar}
                                alt={meeting.customer.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <User size={16} className="text-indigo-600" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-slate-800">
                                {meeting.customer.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {meeting.customer.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        meeting.attendees.length > 0 && (
                          <div className="mb-3">
                            <div className="flex items-start gap-2">
                              <Mail
                                size={16}
                                className="text-slate-400 mt-0.5"
                              />
                              <div className="flex flex-wrap gap-2">
                                {meeting.attendees.map((email, idx) => (
                                  <span
                                    key={idx}
                                    className="text-sm text-slate-600 px-2 py-0.5 bg-slate-100 rounded"
                                  >
                                    {email}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {/* Action Button */}
                    {meeting.htmlLink && (
                      <a
                        href={meeting.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex-shrink-0"
                      >
                        <ExternalLink size={16} />
                        View in Calendar
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Meetings;
