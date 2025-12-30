import React, { useState, useEffect } from "react";
import { MOCK_INTEGRATIONS } from "../constants";
import { Check, Plus, Trash2, Search, Box, Loader2 } from "lucide-react";
import { Integration } from "../types";
import { api } from "../services/api";
import AlertModal from "../components/AlertModal";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "ALL", label: "All Apps" },
  { id: "ECOMMERCE", label: "E-Commerce" },
  { id: "CRM", label: "CRM & ERP" },
  { id: "TICKETING", label: "Ticketing" },
  { id: "COMMUNICATION", label: "Communication" },
  { id: "DATABASE", label: "Databases" },
  { id: "ACCOUNTING", label: "Accounting" },
  { id: "STORAGE", label: "Storage" },
];

// Component to handle icon loading errors gracefully
const IntegrationIcon: React.FC<{ integration: Integration }> = ({
  integration,
}) => {
  const [imgError, setImgError] = useState(false);

  if (imgError || !integration.icon) {
    return <Box size={24} className="text-slate-400" />;
  }

  return (
    <img
      src={integration.icon}
      alt={integration.name}
      className="w-full h-full object-contain"
      onError={() => setImgError(true)}
    />
  );
};

const Integrations: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [connectedIntegrations, setConnectedIntegrations] = useState<
    Set<string>
  >(new Set());
  const [loading, setLoading] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  // Map integration ID to Google type
  const getGoogleType = (intId: string): string | null => {
    const googleMap: Record<string, string> = {
      "int-gcal": "calendar",
      "int-gmail": "gmail",
      "int-drive": "drive",
      "int-sheets": "sheets",
    };
    return googleMap[intId] || null;
  };

  // Fetch connected integrations on mount
  useEffect(() => {
    fetchConnectedIntegrations();

    // Check for OAuth callback success
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "google") {
      if (params.get("success") === "true") {
        setAlertModal({
          isOpen: true,
          title: "Success",
          message: "Google integration connected successfully!",
          type: "success",
        });
      } else {
        setAlertModal({
          isOpen: true,
          title: "Connection Failed",
          message: "Failed to connect Google integration. Please try again.",
          type: "error",
        });
      }
      // Clean up URL
      window.history.replaceState({}, "", "/integrations");
      fetchConnectedIntegrations();
    }
  }, []);

  const fetchConnectedIntegrations = async () => {
    try {
      const response = await api.get("/integrations");
      const connected = new Set<string>(
        response.integrations
          .map((int: any) => {
            // Map Google types back to integration IDs
            if (int.provider === "google") {
              const typeMap: Record<string, string> = {
                calendar: "int-gcal",
                gmail: "int-gmail",
                drive: "int-drive",
                sheets: "int-sheets",
              };
              return typeMap[int.type];
            }
            return int.id;
          })
          .filter(Boolean)
      );
      setConnectedIntegrations(connected);
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message:
          "Failed to load connected integrations. Please refresh the page.",
        type: "error",
      });
    }
  };

  const handleConnect = async (integration: Integration) => {
    const googleType = getGoogleType(integration.id);

    if (!googleType) {
      setAlertModal({
        isOpen: true,
        title: "Coming Soon",
        message: "This integration is not yet available.",
        type: "info",
      });
      return;
    }

    setConnectingId(integration.id);
    try {
      const response = await api.post("/integrations/google/connect", {
        integrationType: googleType,
      });

      if (response.authUrl) {
        // Redirect to Google OAuth
        window.location.href = response.authUrl;
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (error) {
      console.error("Failed to initiate Google connection:", error);
      setAlertModal({
        isOpen: true,
        title: "Connection Failed",
        message:
          "Failed to connect. Please ensure Google OAuth credentials are configured in the backend.",
        type: "error",
      });
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    const googleType = getGoogleType(integration.id);

    if (!googleType) return;

    if (!confirm(`Disconnect ${integration.name}?`)) return;

    setLoading(true);
    try {
      await api.post("/integrations/google/disconnect", {
        integrationType: googleType,
      });

      setConnectedIntegrations((prev) => {
        const next = new Set(prev);
        next.delete(integration.id);
        return next;
      });

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `${integration.name} disconnected successfully!`,
        type: "success",
      });
    } catch (error) {
      console.error("Failed to disconnect:", error);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Failed to disconnect. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredIntegrations = MOCK_INTEGRATIONS.filter((int) => {
    const matchesCategory =
      selectedCategory === "ALL" || int.category === selectedCategory;
    const matchesSearch =
      int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      int.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            App Integrations
          </h1>
          <p className="text-slate-500 mt-1">
            Connect your tools to power agent workflows and AI responses.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="w-full lg:w-64 shrink-0 space-y-1">
            <div className="relative mb-6">
              <Search
                className="absolute left-3 top-2.5 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Search apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Categories
            </h3>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Integrations Grid */}
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredIntegrations.map((int) => {
                const isConnected = connectedIntegrations.has(int.id);
                const isConnecting = connectingId === int.id;
                const googleType = getGoogleType(int.id);

                return (
                  <div
                    key={int.id}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 border border-slate-100 shrink-0 overflow-hidden">
                        <IntegrationIcon integration={int} />
                      </div>
                      {isConnected ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                          <Check size={10} /> CONNECTED
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnect(int)}
                          disabled={isConnecting || !googleType}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors flex items-center gap-1 ${
                            !googleType
                              ? "text-slate-400 bg-slate-50 cursor-not-allowed"
                              : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                          }`}
                        >
                          {isConnecting ? (
                            <>
                              <Loader2 size={10} className="animate-spin" />
                              Connecting...
                            </>
                          ) : googleType ? (
                            "Connect"
                          ) : (
                            "Coming Soon"
                          )}
                        </button>
                      )}
                    </div>
                    <div className="mb-2">
                      <h3 className="font-bold text-slate-900">{int.name}</h3>
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                        {int.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-4 flex-1 leading-relaxed">
                      {int.description}
                    </p>
                    {isConnected && (
                      <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-auto">
                        <span className="text-xs font-medium text-green-600">
                          Active
                        </span>
                        <button
                          onClick={() => handleDisconnect(int)}
                          disabled={loading}
                          className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Disconnect"
                        >
                          {loading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:border-indigo-300 hover:bg-slate-100 cursor-pointer transition-all min-h-[180px]">
                <Plus size={24} className="mb-2 opacity-50" />
                <span className="text-sm font-medium">Request App</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() =>
          setAlertModal({ isOpen: false, title: "", message: "", type: "info" })
        }
      />
    </div>
  );
};

export default Integrations;
