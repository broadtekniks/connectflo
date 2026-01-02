import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Inbox from "./pages/Inbox";
import Dashboard from "./pages/Dashboard";
import AgentDashboard from "./pages/AgentDashboard";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import KnowledgeBase from "./pages/KnowledgeBase";
import PhoneNumbers from "./pages/PhoneNumbers";
import Workflows from "./pages/Workflows";
import WebsiteHome from "./pages/WebsiteHome";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Pricing from "./pages/Pricing";
import Privacy from "./pages/Privacy";
import Security from "./pages/Security";
import Terms from "./pages/Terms";
import Tenants from "./pages/Tenants";
import CustomerPortal from "./pages/CustomerPortal";
import TestChat from "./pages/TestChat";
import Customers from "./pages/Customers";
import TeamMembers from "./pages/TeamMembers";
import Billing from "./pages/Billing";

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Manage public pages navigation (home, login, signup, pricing, privacy, security, terms)
  const [publicView, setPublicView] = useState("home");
  const [userRole, setUserRole] = useState<
    "SUPER_ADMIN" | "TENANT_ADMIN" | "AGENT" | "CUSTOMER"
  >("AGENT");
  const [user, setUser] = useState<any>(null);

  const authenticatedViewFromPathname = (pathname: string): string => {
    const path = (pathname || "/").toLowerCase();
    if (path === "/" || path === "") return "dashboard";
    if (path.startsWith("/dashboard")) return "dashboard";
    if (path.startsWith("/integrations")) return "integrations";
    if (path.startsWith("/workflows")) return "workflows";
    if (path.startsWith("/phone-numbers")) return "phone-numbers";
    if (path.startsWith("/knowledge")) return "knowledge";
    if (path.startsWith("/inbox")) return "inbox";
    if (path.startsWith("/customers")) return "customers";
    if (path.startsWith("/team")) return "team";
    if (path.startsWith("/billing")) return "billing";
    if (path.startsWith("/settings")) return "settings";
    if (path.startsWith("/tenants")) return "tenants";
    if (path.startsWith("/test-chat")) return "test-chat";
    return "dashboard";
  };

  const publicViewFromPathname = (pathname: string): string => {
    const path = (pathname || "/").toLowerCase();
    if (path.startsWith("/login")) return "login";
    if (path.startsWith("/signup")) return "signup";
    if (path.startsWith("/pricing")) return "pricing";
    if (path.startsWith("/privacy")) return "privacy";
    if (path.startsWith("/security")) return "security";
    if (path.startsWith("/terms")) return "terms";
    return "home";
  };

  const pushAuthenticatedUrl = (view: string) => {
    const pathMap: Record<string, string> = {
      dashboard: "/dashboard",
      inbox: "/inbox",
      tenants: "/tenants",
      integrations: "/integrations",
      knowledge: "/knowledge",
      "phone-numbers": "/phone-numbers",
      workflows: "/workflows",
      customers: "/customers",
      team: "/team",
      billing: "/billing",
      settings: "/settings",
      "test-chat": "/test-chat",
    };

    const nextPath = pathMap[view];
    if (!nextPath) return;

    // Preserve existing query string (used by OAuth callbacks)
    const qs = window.location.search || "";
    window.history.pushState({}, "", `${nextPath}${qs}`);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        setIsLoggedIn(true);
        setUserRole(parsedUser.role);
        setUser(parsedUser);

        // Support deep links like /integrations after OAuth redirects.
        setCurrentView(authenticatedViewFromPathname(window.location.pathname));
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    } else {
      setPublicView(publicViewFromPathname(window.location.pathname));
    }
  }, []);

  useEffect(() => {
    // Keep view in sync with browser navigation (back/forward).
    const onPopState = () => {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      const loggedIn = Boolean(token && userStr);

      if (loggedIn) {
        setCurrentView(authenticatedViewFromPathname(window.location.pathname));
      } else {
        setPublicView(publicViewFromPathname(window.location.pathname));
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    // Default to collapsed on smaller screens.
    const setFromViewport = () => {
      setIsSidebarCollapsed(window.innerWidth < 1024);
    };

    setFromViewport();
    window.addEventListener("resize", setFromViewport);
    return () => window.removeEventListener("resize", setFromViewport);
  }, []);

  const handleLogin = () => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      setIsLoggedIn(true);
      setUserRole(parsedUser.role);
      setUser(parsedUser);
      const nextView = authenticatedViewFromPathname(window.location.pathname);
      setCurrentView(nextView);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    setCurrentView("dashboard");
    setPublicView("home");
  };

  const viewPermissions: Record<string, string[]> = {
    dashboard: ["SUPER_ADMIN", "TENANT_ADMIN", "AGENT"],
    tenants: ["SUPER_ADMIN"],
    inbox: ["TENANT_ADMIN", "AGENT"],
    "phone-numbers": ["SUPER_ADMIN", "TENANT_ADMIN"],
    workflows: ["TENANT_ADMIN"],
    integrations: ["TENANT_ADMIN"],
    knowledge: ["TENANT_ADMIN"],
    customers: ["TENANT_ADMIN", "AGENT"],
    team: ["TENANT_ADMIN"],
    billing: ["TENANT_ADMIN"],
    settings: ["SUPER_ADMIN", "TENANT_ADMIN", "AGENT"],
    "test-chat": ["TENANT_ADMIN"],
  };

  const renderAuthenticatedView = () => {
    const allowedRoles = viewPermissions[currentView];
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      return (
        <div className="flex items-center justify-center h-full flex-col bg-slate-50">
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-red-500 mb-2">
              Unauthorized Access
            </h2>
            <p className="text-slate-400">
              You do not have permission to view this page.
            </p>
            <button
              onClick={() => setCurrentView("dashboard")}
              className="mt-4 text-indigo-600 hover:underline"
            >
              Go back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case "inbox":
        return <Inbox />;
      case "dashboard":
        return userRole === "AGENT" ? <AgentDashboard /> : <Dashboard />;
      case "tenants":
        return <Tenants />;
      case "integrations":
        return <Integrations />;
      case "knowledge":
        return <KnowledgeBase />;
      case "phone-numbers":
        return <PhoneNumbers />;
      case "workflows":
        return <Workflows />;
      case "customers":
        return <Customers />;
      case "team":
        return <TeamMembers />;
      case "billing":
        return <Billing />;
      case "settings":
        return <Settings />;
      case "test-chat":
        return <TestChat />;
      default:
        return (
          <div className="flex items-center justify-center h-full flex-col bg-slate-50">
            <div className="p-8 text-center">
              <h2 className="text-2xl font-bold text-slate-400 mb-2">
                Work in Progress
              </h2>
              <p className="text-slate-400">
                The {currentView} module is coming soon.
              </p>
              <button
                onClick={() => setCurrentView("dashboard")}
                className="mt-4 text-indigo-600 hover:underline"
              >
                Go back Dashboard
              </button>
            </div>
          </div>
        );
    }
  };

  if (!isLoggedIn) {
    switch (publicView) {
      case "login":
        return <Login onLogin={handleLogin} onNavigate={setPublicView} />;
      case "signup":
        return <Signup onSignup={handleLogin} onNavigate={setPublicView} />;
      case "pricing":
        return <Pricing onNavigate={setPublicView} />;
      case "privacy":
        return <Privacy onNavigate={setPublicView} />;
      case "security":
        return <Security onNavigate={setPublicView} />;
      case "terms":
        return <Terms onNavigate={setPublicView} />;
      case "home":
      default:
        return <WebsiteHome onNavigate={setPublicView} />;
    }
  }

  if (userRole === "CUSTOMER") {
    return <CustomerPortal />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100 font-sans text-slate-900 overflow-hidden animate-fade-in">
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          pushAuthenticatedUrl(view);
        }}
        userRole={userRole}
        user={user}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((v) => !v)}
      />
      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        {isSidebarCollapsed && (
          <div className="h-12 bg-white border-b border-slate-200 flex items-center px-4 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentView("dashboard")}
              className="flex items-center gap-3 hover:opacity-90 transition-opacity"
              aria-label="Go to dashboard"
              title="Go to dashboard"
            >
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                <span className="font-bold text-white">C</span>
              </div>
              <span className="font-bold text-slate-900">ConnectFlo</span>
            </button>
          </div>
        )}
        {renderAuthenticatedView()}
      </main>
    </div>
  );
};

export default App;
