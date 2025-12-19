import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Inbox from "./pages/Inbox";
import Dashboard from "./pages/Dashboard";
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

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState("dashboard");
  // Manage public pages navigation (home, login, signup, pricing, privacy, security, terms)
  const [publicView, setPublicView] = useState("home");
  const [userRole, setUserRole] = useState<
    "SUPER_ADMIN" | "TENANT_ADMIN" | "AGENT" | "CUSTOMER"
  >("AGENT");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        setIsLoggedIn(true);
        setUserRole(parsedUser.role);
        setUser(parsedUser);
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
  }, []);

  const handleLogin = () => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      setIsLoggedIn(true);
      setUserRole(parsedUser.role);
      setUser(parsedUser);
      setCurrentView("dashboard");
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
    workflows: ["TENANT_ADMIN", "AGENT"],
    integrations: ["TENANT_ADMIN"],
    knowledge: ["TENANT_ADMIN", "AGENT"],
    customers: ["TENANT_ADMIN", "AGENT"],
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
        return <Dashboard />;
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
        onNavigate={setCurrentView}
        userRole={userRole}
        user={user}
        onLogout={handleLogout}
      />
      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        {renderAuthenticatedView()}
      </main>
    </div>
  );
};

export default App;
