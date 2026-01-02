import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Inbox,
  Settings,
  Users,
  CreditCard,
  BookOpen,
  Workflow,
  Blocks,
  Phone,
  Building,
  LogOut,
  MessageSquare,
  Menu,
} from "lucide-react";

import { api } from "../services/api";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  userRole?: "SUPER_ADMIN" | "TENANT_ADMIN" | "AGENT" | "CUSTOMER";
  user?: any;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onLogout,
  userRole = "AGENT",
  user,
  isCollapsed,
  onToggleCollapsed,
}) => {
  const [agentCheckedIn, setAgentCheckedIn] = useState<boolean>(false);
  const [agentBusy, setAgentBusy] = useState<boolean>(false);

  useEffect(() => {
    if (userRole !== "AGENT") return;

    api.agents
      .me()
      .then((res) => setAgentCheckedIn(Boolean(res.isCheckedIn)))
      .catch((err) => {
        console.error("Failed to load agent check-in status", err);
      });
  }, [userRole]);

  const handleToggleCheckIn = async () => {
    if (userRole !== "AGENT") return;

    setAgentBusy(true);
    try {
      const next = agentCheckedIn
        ? await api.agents.checkOut()
        : await api.agents.checkIn();
      setAgentCheckedIn(Boolean(next.isCheckedIn));
    } catch (err) {
      console.error("Failed to toggle agent check-in", err);
    } finally {
      setAgentBusy(false);
    }
  };

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["SUPER_ADMIN", "TENANT_ADMIN", "AGENT"],
    },
    { id: "tenants", label: "Tenants", icon: Building, roles: ["SUPER_ADMIN"] },
    {
      id: "inbox",
      label: "Inbox",
      icon: Inbox,
      roles: ["TENANT_ADMIN", "AGENT"],
    },
    {
      id: "phone-numbers",
      label: "Phone Numbers",
      icon: Phone,
      roles: ["SUPER_ADMIN", "TENANT_ADMIN"],
    },
    {
      id: "workflows",
      label: "Workflows",
      icon: Workflow,
      roles: ["TENANT_ADMIN"],
    },
    {
      id: "integrations",
      label: "Integrations",
      icon: Blocks,
      roles: ["TENANT_ADMIN"],
    },
    {
      id: "knowledge",
      label: "Knowledge",
      icon: BookOpen,
      roles: ["TENANT_ADMIN"],
    },
    {
      id: "customers",
      label: "Customers",
      icon: Users,
      roles: ["TENANT_ADMIN", "AGENT"],
    },
    {
      id: "team",
      label: "Team",
      icon: Users,
      roles: ["TENANT_ADMIN"],
    },
    {
      id: "billing",
      label: "Billing",
      icon: CreditCard,
      roles: ["TENANT_ADMIN"],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      roles: ["SUPER_ADMIN", "TENANT_ADMIN", "AGENT"],
    },
    {
      id: "test-chat",
      label: "Test Chat",
      icon: MessageSquare,
      roles: ["TENANT_ADMIN"],
    },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div
      className={`${
        isCollapsed ? "w-16" : "w-64"
      } bg-slate-900 text-white flex flex-col h-full transition-all duration-300 border-r border-slate-800 shrink-0`}
    >
      <div
        className={`relative h-16 flex items-center border-b border-slate-800 ${
          isCollapsed ? "justify-center" : "justify-between px-4"
        }`}
      >
        {!isCollapsed && (
          <div
            className="flex items-center justify-start cursor-pointer"
            onClick={() => onNavigate("dashboard")}
          >
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
              <span className="font-bold text-white">C</span>
            </div>
            <span className="ml-3 font-bold text-lg">ConnectFlo</span>
          </div>
        )}

        <button
          type="button"
          className={`inline-flex rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors ${
            isCollapsed ? "absolute top-2 right-2 p-2 z-20" : "p-2"
          }`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapsed();
          }}
        >
          <Menu size={18} />
        </button>
      </div>

      <nav className="flex-1 py-6 space-y-1">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center px-3 py-3 transition-colors duration-200 ${
              currentView === item.id
                ? "bg-indigo-600 text-white border-r-4 border-indigo-300"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            }`}
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon size={20} className="shrink-0" />
            {!isCollapsed && (
              <span className="ml-3 font-medium">{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      {userRole === "AGENT" && (
        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={handleToggleCheckIn}
            disabled={agentBusy}
            className={`w-full flex items-center justify-center px-3 py-2 rounded-lg border text-sm font-bold transition-colors ${
              agentBusy
                ? "bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed"
                : agentCheckedIn
                ? "bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700"
                : "bg-slate-800 text-white border-slate-700 hover:bg-slate-700"
            } ${isCollapsed ? "px-0" : ""}`}
            title={
              agentCheckedIn
                ? "Check out (stop receiving new assignments)"
                : "Check in (start receiving new assignments)"
            }
          >
            {isCollapsed ? (
              <span className="text-xs">{agentCheckedIn ? "OUT" : "IN"}</span>
            ) : agentBusy ? (
              "Working…"
            ) : agentCheckedIn ? (
              "Check out"
            ) : (
              "Check in"
            )}
          </button>
        </div>
      )}

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center justify-center lg:justify-start cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
            onClick={() => onNavigate("settings")}
          >
            <img
              src={
                user?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user?.name || "User"
                )}`
              }
              alt="User"
              className="w-8 h-8 rounded-full border border-slate-600 shrink-0"
            />
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-slate-400 truncate">{userRole}</p>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
