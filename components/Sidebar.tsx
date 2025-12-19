import React from "react";
import {
  LayoutDashboard,
  Inbox,
  Settings,
  Users,
  BookOpen,
  Workflow,
  Blocks,
  Phone,
  Building,
  LogOut,
  MessageSquare,
} from "lucide-react";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  userRole?: "SUPER_ADMIN" | "TENANT_ADMIN" | "AGENT" | "CUSTOMER";
  user?: any;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onLogout,
  userRole = "AGENT",
  user,
}) => {
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
      roles: ["TENANT_ADMIN", "AGENT"],
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
      roles: ["TENANT_ADMIN", "AGENT"],
    },
    {
      id: "customers",
      label: "Customers",
      icon: Users,
      roles: ["TENANT_ADMIN", "AGENT"],
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
      roles: ["TENANT_ADMIN", "AGENT"],
    },
   ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="w-16 lg:w-64 bg-slate-900 text-white flex flex-col h-full transition-all duration-300 border-r border-slate-800 shrink-0">
      <div
        className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800 cursor-pointer"
        onClick={() => onNavigate("dashboard")}
      >
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
          <span className="font-bold text-white">C</span>
        </div>
        <span className="ml-3 font-bold text-lg hidden lg:block">
          ConnectFlo
        </span>
      </div>

      <nav className="flex-1 py-6 space-y-1">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center px-3 lg:px-6 py-3 transition-colors duration-200 ${
              currentView === item.id
                ? "bg-indigo-600 text-white border-r-4 border-indigo-300"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            }`}
          >
            <item.icon size={20} className="shrink-0" />
            <span className="ml-3 font-medium hidden lg:block">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

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
            <div className="ml-3 hidden lg:block overflow-hidden">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-slate-400 truncate">{userRole}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="hidden lg:flex text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800"
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
