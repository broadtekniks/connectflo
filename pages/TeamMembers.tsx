import React, { useEffect, useState } from "react";
import { Loader, Plus, Trash2 } from "lucide-react";
import { User as UserType } from "../types";
import { api } from "../services/api";
import { socketService } from "../services/socket";

type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Agent";
  status: "Checked in" | "Checked out" | "—";
  avatar: string;
};

const TeamMembers: React.FC = () => {
  const [user, setUser] = useState<UserType | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teamMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
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
                    <td className="px-6 py-4 text-right">
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
    </div>
  );
};

export default TeamMembers;
