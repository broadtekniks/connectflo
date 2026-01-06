import React, { useEffect, useState } from "react";
import { Loader, Plus, Trash2, Clock, PhoneForwarded } from "lucide-react";
import { User as UserType } from "../types";
import { api } from "../services/api";
import { socketService } from "../services/socket";
import WorkingHoursModal, {
  WorkingHoursConfig,
} from "../components/WorkingHoursModal";
import InputModal from "../components/InputModal";

type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Agent";
  status: "Checked in" | "Checked out" | "—";
  avatar: string;
  agentTimeZone?: string | null;
  workingHours?: Record<string, { start: string; end: string } | null> | null;
  forwardingPhoneNumber?: string | null;
};

const getDetectedTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

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

const formatTenantDefaultLabel = (tenantTimeZone: string | null): string => {
  const tz = tenantTimeZone || "UTC";
  try {
    const offsetMinutes = getTimeZoneOffsetMinutes(tz, new Date());
    return `Tenant default — ${tz} (${formatUtcOffset(offsetMinutes)})`;
  } catch {
    return `Tenant default — ${tz}`;
  }
};

const formatTimeZoneLabel = (timeZone: string): string => {
  try {
    const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, new Date());
    return `${timeZone} (${formatUtcOffset(offsetMinutes)})`;
  } catch {
    return timeZone;
  }
};

const summarizeWorkingHours = (
  workingHours: TeamMemberRow["workingHours"],
  tenantTimeZone: string | null
) => {
  if (!workingHours || typeof workingHours !== "object") {
    return formatTenantDefaultLabel(tenantTimeZone);
  }
  const enabledDays = Object.values(workingHours).filter(
    (v) => v && v.start && v.end
  );
  return enabledDays.length === 0
    ? "Closed"
    : enabledDays.length === 7
    ? "Daily"
    : `${enabledDays.length} days`;
};

const TeamMembers: React.FC = () => {
  const [detectedTimeZone] = useState(() => getDetectedTimeZone());
  const [user, setUser] = useState<UserType | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantTimeZone, setTenantTimeZone] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMemberRow | null>(
    null
  );
  const [forwardingModalOpen, setForwardingModalOpen] = useState(false);
  const [forwardingMember, setForwardingMember] =
    useState<TeamMemberRow | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) return;

    const userData = JSON.parse(userStr);
    setUser(userData);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // Tenant business timezone is used as the "Tenant default" label in schedule UI.
        // Prefer a lightweight endpoint that agents can call, with an admin-only fallback.
        const tzPromise = api.tenants
          .getBusinessTimeZone()
          .then((tz) => tz.timeZone ?? null)
          .catch(async () => {
            try {
              const data = await api.tenants.getBusinessHours();
              return (data as any)?.timeZone ?? null;
            } catch {
              return null;
            }
          });

        const members = await api.teamMembers.list();
        const tz = await tzPromise;
        setTenantTimeZone(tz);
        setTeamMembers(
          members.map((m) => ({
            id: m.id,
            name: m.name || m.email,
            email: m.email,
            role: m.role === "TENANT_ADMIN" ? "Admin" : "Agent",
            status:
              m.role === "AGENT"
                ? m.isCheckedIn
                  ? "Checked in"
                  : "Checked out"
                : "—",
            avatar:
              m.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                m.name || "User"
              )}`,
            agentTimeZone: m.agentTimeZone ?? null,
            workingHours: (m as any).workingHours ?? null,
            forwardingPhoneNumber: (m as any).forwardingPhoneNumber ?? null,
          }))
        );
      } catch (e) {
        console.error("Failed to load team members", e);
        setError(
          e instanceof Error ? e.message : "Failed to load team members"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    // Realtime updates for agent check-in/out
    socketService.connect();

    const refresh = async () => {
      const members = await api.teamMembers.list();
      setTeamMembers(
        members.map((m) => ({
          id: m.id,
          name: m.name || m.email,
          email: m.email,
          role: m.role === "TENANT_ADMIN" ? "Admin" : "Agent",
          status:
            m.role === "AGENT"
              ? m.isCheckedIn
                ? "Checked in"
                : "Checked out"
              : "—",
          avatar:
            m.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              m.name || "User"
            )}`,
          agentTimeZone: m.agentTimeZone ?? null,
          workingHours: (m as any).workingHours ?? null,
          forwardingPhoneNumber: (m as any).forwardingPhoneNumber ?? null,
        }))
      );
    };

    socketService.onTeamMemberCheckinUpdated(() => {
      // Simple + correct: refetch the list (keeps it accurate if other fields change)
      refresh().catch((e) =>
        console.error("Failed to refresh team members", e)
      );
    });

    return () => {
      socketService.offTeamMemberCheckinUpdated();
      socketService.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
            <p className="text-slate-500 mt-1">
              Manage access and roles for your support team.
            </p>
          </div>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
            <Plus size={16} /> Invite Member
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 font-semibold">User</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Hours</th>
                <th className="px-6 py-3 font-semibold">Forwarding</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teamMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No team members found.
                  </td>
                </tr>
              ) : (
                teamMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatar}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <div className="font-bold text-slate-800">
                            {member.name}
                            {user?.email === member.email ? " (You)" : ""}
                          </div>
                          <div className="text-xs text-slate-500">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          member.status === "Checked in"
                            ? "bg-green-50 text-green-700"
                            : member.status === "Checked out"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-slate-50 text-slate-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            member.status === "Checked in"
                              ? "bg-green-500"
                              : member.status === "Checked out"
                              ? "bg-slate-500"
                              : "bg-slate-300"
                          }`}
                        />
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-medium">
                        {summarizeWorkingHours(
                          member.workingHours,
                          tenantTimeZone || detectedTimeZone
                        )}
                      </div>
                      {member.workingHours &&
                        typeof member.workingHours === "object" && (
                          <div className="text-xs text-slate-500 mt-1">
                            {member.agentTimeZone
                              ? formatTimeZoneLabel(member.agentTimeZone)
                              : formatTenantDefaultLabel(
                                  tenantTimeZone || detectedTimeZone
                                )}
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800 font-medium">
                        {member.forwardingPhoneNumber || "—"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Used for call forwarding
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="mr-3 inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
                        onClick={() => {
                          setSelectedMember(member);
                          setScheduleModalOpen(true);
                        }}
                        title="Edit working hours"
                      >
                        <Clock size={16} />
                        <span className="text-xs font-semibold">Hours</span>
                      </button>

                      {(user?.role === "TENANT_ADMIN" ||
                        (user?.role === "AGENT" && user?.id === member.id)) && (
                        <button
                          className="mr-3 inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
                          onClick={() => {
                            setForwardingMember(member);
                            setForwardingModalOpen(true);
                          }}
                          title="Edit call forwarding number"
                        >
                          <PhoneForwarded size={16} />
                          <span className="text-xs font-semibold">Forward</span>
                        </button>
                      )}

                      <button className="text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <WorkingHoursModal
        isOpen={scheduleModalOpen}
        memberName={selectedMember?.name || ""}
        tenantTimeZone={tenantTimeZone || detectedTimeZone}
        initialAgentTimeZone={selectedMember?.agentTimeZone}
        initialWorkingHours={selectedMember?.workingHours}
        canEdit={
          Boolean(user?.role === "TENANT_ADMIN") ||
          Boolean(
            user?.role === "AGENT" && user?.id && user.id === selectedMember?.id
          )
        }
        onCancel={() => {
          setScheduleModalOpen(false);
          setSelectedMember(null);
        }}
        onSave={async (data) => {
          if (!selectedMember) return;
          try {
            setError(null);
            await api.teamMembers.updateSchedule(selectedMember.id, {
              agentTimeZone: data.agentTimeZone,
              workingHours: data.workingHours as WorkingHoursConfig | null,
            });
            const members = await api.teamMembers.list();
            setTeamMembers(
              members.map((m) => ({
                id: m.id,
                name: m.name || m.email,
                email: m.email,
                role: m.role === "TENANT_ADMIN" ? "Admin" : "Agent",
                status:
                  m.role === "AGENT"
                    ? m.isCheckedIn
                      ? "Checked in"
                      : "Checked out"
                    : "—",
                avatar:
                  m.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    m.name || "User"
                  )}`,
                agentTimeZone: m.agentTimeZone ?? null,
                workingHours: (m as any).workingHours ?? null,
              }))
            );
            setScheduleModalOpen(false);
            setSelectedMember(null);
          } catch (e) {
            console.error("Failed to update schedule", e);
            setError(
              e instanceof Error ? e.message : "Failed to update schedule"
            );
          }
        }}
      />

      <InputModal
        isOpen={forwardingModalOpen}
        title="Call forwarding number"
        message="Set the number used when this team member is selected in Call Forwarding / Call Group workflows. Use E.164 format (e.g., +15551234567). Leave blank to clear."
        placeholder="+15551234567"
        initialValue={forwardingMember?.forwardingPhoneNumber || ""}
        confirmLabel="Save"
        confirmDisabled={false}
        onCancel={() => {
          setForwardingModalOpen(false);
          setForwardingMember(null);
        }}
        onConfirm={async (value) => {
          if (!forwardingMember) return;
          try {
            setError(null);
            const cleaned = String(value || "").trim();
            await api.teamMembers.updateForwardingNumber(forwardingMember.id, {
              forwardingPhoneNumber: cleaned ? cleaned : null,
            });

            const members = await api.teamMembers.list();
            setTeamMembers(
              members.map((m) => ({
                id: m.id,
                name: m.name || m.email,
                email: m.email,
                role: m.role === "TENANT_ADMIN" ? "Admin" : "Agent",
                status:
                  m.role === "AGENT"
                    ? m.isCheckedIn
                      ? "Checked in"
                      : "Checked out"
                    : "—",
                avatar:
                  m.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    m.name || "User"
                  )}`,
                agentTimeZone: m.agentTimeZone ?? null,
                workingHours: (m as any).workingHours ?? null,
                forwardingPhoneNumber: (m as any).forwardingPhoneNumber ?? null,
              }))
            );

            setForwardingModalOpen(false);
            setForwardingMember(null);
          } catch (e) {
            console.error("Failed to update forwarding number", e);
            setError(
              e instanceof Error
                ? e.message
                : "Failed to update forwarding number"
            );
          }
        }}
      />
    </div>
  );
};

export default TeamMembers;
