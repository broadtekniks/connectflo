import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  Clock,
  MessageSquare,
  Inbox,
  LogIn,
  Phone,
} from "lucide-react";
import { api } from "../services/api";

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-3xl font-bold text-slate-900">{value}</span>
        </div>
      </div>
      <div className="p-2 bg-slate-50 rounded-lg text-slate-400">{icon}</div>
    </div>
  </div>
);

const AgentDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<null | {
    assignedActiveConversations: number;
    assignedOpenConversations: number;
    assignedPendingConversations: number;
    resolvedToday: number;
    agentMessagesToday: number;
    voiceCallsToday: number;
    voiceMinutesToday: number;
    isCheckedIn: boolean;
    checkedInAt: string | null;
  }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.metrics.agent();
        setMetrics(data);
      } catch (e) {
        console.error("Failed to fetch agent metrics", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="flex-1 bg-slate-50 h-full flex flex-col overflow-hidden">
      <div className="px-8 pt-8 pb-4 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">My Metrics</h1>
              <p className="text-slate-500 mt-1">
                Your workload and performance for today.
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
                  metrics?.isCheckedIn
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <LogIn size={16} />
                {loading
                  ? "Loading…"
                  : metrics?.isCheckedIn
                  ? "Checked in"
                  : "Checked out"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              label="Assigned (Active)"
              value={loading ? "-" : metrics?.assignedActiveConversations ?? 0}
              icon={<Inbox size={20} />}
            />
            <MetricCard
              label="Assigned (Open)"
              value={loading ? "-" : metrics?.assignedOpenConversations ?? 0}
              icon={<Clock size={20} />}
            />
            <MetricCard
              label="Resolved Today"
              value={loading ? "-" : metrics?.resolvedToday ?? 0}
              icon={<CheckCircle size={20} />}
            />
            <MetricCard
              label="Messages Today"
              value={loading ? "-" : metrics?.agentMessagesToday ?? 0}
              icon={<MessageSquare size={20} />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricCard
              label="Voice Calls Today"
              value={loading ? "-" : metrics?.voiceCallsToday ?? 0}
              icon={<Phone size={20} />}
            />
            <MetricCard
              label="Voice Minutes Today"
              value={loading ? "-" : metrics?.voiceMinutesToday ?? 0}
              icon={<Phone size={20} />}
            />
          </div>

          {!loading && metrics && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-2">Notes</h3>
              <p className="text-sm text-slate-600">
                "Assigned (Active)" counts conversations assigned to you in
                OPEN/PENDING. "Resolved Today" is based on conversations updated
                to RESOLVED since midnight server time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;
