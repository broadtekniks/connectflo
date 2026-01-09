import React, { useState, useEffect } from "react";
import {
  Phone,
  Clock,
  User,
  PhoneIncoming,
  PhoneOutgoing,
  FileText,
  RefreshCw,
  Filter,
} from "lucide-react";
import { api } from "../services/api";
import { DateTime } from "luxon";

interface CallLog {
  id: string;
  callSid: string;
  direction: string;
  from: string;
  to: string;
  status: string;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcriptSummary: string | null;
  sentiment: string | null;
  outcome: string | null;
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
  };
  phoneNumber?: {
    id: string;
    number: string;
  };
}

const CallLogs: React.FC = () => {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadCallLogs = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (directionFilter !== "all") params.direction = directionFilter;
      if (statusFilter !== "all") params.status = statusFilter;

      const data = await api.callLogs.list(params);
      setCallLogs(data.callLogs || []);
    } catch (err) {
      console.error("Failed to load call logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCallLogs();
  }, [directionFilter, statusFilter]);

  const formatDate = (isoString: string) => {
    const dt = DateTime.fromISO(isoString);
    return dt.toLocaleString(DateTime.DATETIME_MED);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getSentimentColor = (sentiment: string | null) => {
    if (!sentiment) return "bg-slate-100 text-slate-700";
    switch (sentiment.toLowerCase()) {
      case "positive":
        return "bg-green-100 text-green-700";
      case "negative":
        return "bg-red-100 text-red-700";
      case "neutral":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCw
            className="mx-auto mb-4 animate-spin text-indigo-600"
            size={40}
          />
          <p className="text-slate-600">Loading call logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Phone size={28} className="text-indigo-600" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900">Call Logs</h1>
              </div>
              <p className="text-slate-600 text-lg ml-14">
                {callLogs.length} {callLogs.length === 1 ? "call" : "calls"}{" "}
                logged
              </p>
            </div>
            <button
              onClick={loadCallLogs}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md text-slate-700 font-medium transition-all"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direction Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Filter size={16} className="text-indigo-600" />
                Call Direction
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDirectionFilter("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    directionFilter === "all"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All Calls
                </button>
                <button
                  onClick={() => setDirectionFilter("inbound")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    directionFilter === "inbound"
                      ? "bg-green-600 text-white shadow-md shadow-green-200"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <PhoneIncoming size={16} />
                  Inbound
                </button>
                <button
                  onClick={() => setDirectionFilter("outbound")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    directionFilter === "outbound"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <PhoneOutgoing size={16} />
                  Outbound
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Filter size={16} className="text-indigo-600" />
                Call Status
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === "all"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All Status
                </button>
                <button
                  onClick={() => setStatusFilter("completed")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === "completed"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => setStatusFilter("no-answer")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === "no-answer"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-200"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  No Answer
                </button>
                <button
                  onClick={() => setStatusFilter("busy")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === "busy"
                      ? "bg-red-600 text-white shadow-md shadow-red-200"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Busy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Call Logs List */}
        {callLogs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Phone className="text-slate-400" size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">
                No call logs found
              </h3>
              <p className="text-slate-600 text-lg leading-relaxed">
                {directionFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters to see more results."
                  : "Call logs will appear here once calls are made or received."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {callLogs.map((call) => (
              <div
                key={call.id}
                className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-200 transition-all duration-200"
              >
                <div className="px-4 py-3">
                  {/* Single compact row with all info */}
                  <div className="flex items-center gap-3">
                    {/* Direction Icon - smaller */}
                    <div
                      className={`p-2 rounded-lg flex-shrink-0 ${
                        call.direction === "inbound"
                          ? "bg-green-100"
                          : "bg-blue-100"
                      }`}
                    >
                      {call.direction === "inbound" ? (
                        <PhoneIncoming className="text-green-600" size={16} />
                      ) : (
                        <PhoneOutgoing className="text-blue-600" size={16} />
                      )}
                    </div>

                    {/* Customer Name/From */}
                    <div className="min-w-[180px]">
                      <div className="font-semibold text-slate-900 text-sm truncate">
                        {call.customer?.name || call.from}
                      </div>
                      <div className="text-xs text-slate-500">
                        {call.direction === "inbound" ? "From" : "To"}:{" "}
                        {call.direction === "inbound" ? call.from : call.to}
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase ${
                          call.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : call.status === "no-answer"
                            ? "bg-amber-100 text-amber-700"
                            : call.status === "busy"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {call.status}
                      </span>
                      {call.recordingUrl && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-indigo-100 text-indigo-700 uppercase">
                          Voicemail
                        </span>
                      )}
                      {call.sentiment && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase ${getSentimentColor(
                            call.sentiment
                          )}`}
                        >
                          {call.sentiment}
                        </span>
                      )}
                    </div>

                    {/* Duration - compact */}
                    {call.durationSeconds !== null && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 flex-shrink-0">
                        <Clock size={12} className="text-slate-400" />
                        {formatDuration(call.durationSeconds)}
                      </div>
                    )}

                    {/* Date & Time - compact */}
                    <div className="flex items-center gap-1 text-xs text-slate-600 flex-shrink-0 ml-auto">
                      <Clock size={12} className="text-slate-400" />
                      {formatDate(call.createdAt)}
                    </div>

                    {/* Avatar - smaller */}
                    {call.customer && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                          <User size={16} className="text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Optional second line for outcome/transcript - only if present */}
                  {(call.outcome || call.transcriptSummary) && (
                    <div className="mt-2 pl-9 text-xs text-slate-600 truncate">
                      {call.outcome && (
                        <span className="font-medium">
                          Outcome:{" "}
                          <span className="text-blue-700">{call.outcome}</span>
                        </span>
                      )}
                      {call.outcome && call.transcriptSummary && (
                        <span className="mx-2">•</span>
                      )}
                      {call.transcriptSummary && (
                        <span className="italic">{call.transcriptSummary}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallLogs;
