import React, { useState, useEffect } from "react";
import { MOCK_INTEGRATIONS } from "../constants";
import {
  Check,
  Plus,
  Unplug,
  Search,
  Box,
  Loader2,
  Settings,
  Database,
  AlertCircle,
  RefreshCw,
  Trash2,
  BookOpen,
} from "lucide-react";
import { Integration } from "../types";
import { api } from "../services/api";
import AlertModal from "../components/AlertModal";
import ConfirmationModal from "../components/ConfirmationModal";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "CONNECTED", label: "Connected" },
  { id: "ALL", label: "All Apps" },
  { id: "ECOMMERCE", label: "E-Commerce" },
  { id: "CRM", label: "CRM & ERP" },
  { id: "TICKETING", label: "Ticketing" },
  { id: "COMMUNICATION", label: "Communication" },
  { id: "DATABASE", label: "Databases" },
  { id: "ACCOUNTING", label: "Accounting" },
  { id: "STORAGE", label: "Storage" },
];

// CRM providers that require credential input
const CRM_PROVIDERS: Record<string, string> = {
  "int-hub": "hubspot",
  "int-sf": "salesforce",
  "int-zoho": "zoho",
  "int-odoo": "odoo",
};

// Integrations that have setup guides
const INTEGRATION_GUIDES: Record<string, boolean> = {
  "int-hub": true,
  "int-sf": true,
  // Add more as guides are created
};

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
  const [disconnectTarget, setDisconnectTarget] = useState<Integration | null>(
    null
  );
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [crmDisconnectTarget, setCrmDisconnectTarget] = useState<any | null>(
    null
  );
  const [showCrmDisconnectModal, setShowCrmDisconnectModal] = useState(false);
  const [crmDisconnecting, setCrmDisconnecting] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  // CRM Connection state
  const [crmConnections, setCrmConnections] = useState<any[]>([]);
  const [showCrmModal, setShowCrmModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [selectedCrm, setSelectedCrm] = useState<any>(null);
  const [crmCredentials, setCrmCredentials] = useState<any>({});
  const [crmLoading, setCrmLoading] = useState(false);

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

    // Allow deep link selection (e.g. category=CONNECTED)
    const initialParams = new URLSearchParams(window.location.search);
    if (initialParams.get("category") === "CONNECTED") {
      setSelectedCategory("CONNECTED");
    }

    // Check for OAuth callback success
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "google") {
      // After OAuth, default to showing connected apps
      setSelectedCategory("CONNECTED");
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

  const fetchCrmConnections = async () => {
    try {
      const connections = await api.crmConnections.list();
      setCrmConnections(connections);

      // Mark CRM integrations as connected
      const crmIds = new Set<string>();
      connections
        .filter(
          (conn: any) => String(conn?.status || "").toLowerCase() === "active"
        )
        .forEach((conn: any) => {
          const intId = Object.keys(CRM_PROVIDERS).find(
            (key) => CRM_PROVIDERS[key] === conn.crmType
          );
          if (intId) crmIds.add(intId);
        });

      setConnectedIntegrations((prev) => {
        const next = new Set(prev);
        // First remove any CRM integration IDs, then add back active ones.
        Object.keys(CRM_PROVIDERS).forEach((id) => next.delete(id));
        crmIds.forEach((id) => next.add(id));
        return next;
      });
    } catch (error) {
      console.error("Failed to fetch CRM connections:", error);
    }
  };

  useEffect(() => {
    fetchCrmConnections();
  }, []);

  const handleConnect = async (integration: Integration) => {
    const googleType = getGoogleType(integration.id);
    const crmProvider = CRM_PROVIDERS[integration.id];

    // Handle CRM connections
    if (crmProvider) {
      setSelectedCrm({
        integrationId: integration.id,
        provider: crmProvider,
        name: integration.name,
        credentials: {},
      });
      setShowCrmModal(true);
      return;
    }

    // Handle Google OAuth
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
    const crmProvider = CRM_PROVIDERS[integration.id];

    // Handle CRM disconnection
    if (crmProvider) {
      const connection = crmConnections.find(
        (c) =>
          (c as any).crmType === crmProvider ||
          (c as any).provider === crmProvider
      );
      if (connection) {
        setCrmDisconnectTarget(connection);
        setShowCrmDisconnectModal(true);
      } else {
        setAlertModal({
          isOpen: true,
          title: "Not Connected",
          message: "No active CRM connection was found for this provider.",
          type: "info",
        });
      }
      return;
    }

    setDisconnectTarget(integration);
    setShowDisconnectModal(true);
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectTarget) return;

    const googleType = getGoogleType(disconnectTarget.id);
    if (!googleType) {
      setShowDisconnectModal(false);
      setDisconnectTarget(null);
      return;
    }

    setLoading(true);
    try {
      await api.post("/integrations/google/disconnect", {
        integrationType: googleType,
      });

      setConnectedIntegrations((prev) => {
        const next = new Set(prev);
        next.delete(disconnectTarget.id);
        return next;
      });

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: `${disconnectTarget.name} disconnected successfully!`,
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
      setShowDisconnectModal(false);
      setDisconnectTarget(null);
    }
  };

  const handleCancelCrmDisconnect = () => {
    setShowCrmDisconnectModal(false);
    setCrmDisconnectTarget(null);
  };

  const handleCancelDisconnect = () => {
    setShowDisconnectModal(false);
    setDisconnectTarget(null);
  };

  const handleConnectCrm = (provider: string) => {
    setSelectedCrm({ provider, name: "", credentials: {} });
    setShowCrmModal(true);
  };

  const handleSaveCrmConnection = async () => {
    if (!selectedCrm) return;

    setCrmLoading(true);
    try {
      await api.crmConnections.create({
        crmType: selectedCrm.provider as any,
        name: selectedCrm.name,
        credentials: crmCredentials,
      });

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "CRM connection created successfully!",
        type: "success",
      });

      setShowCrmModal(false);
      setSelectedCrm(null);
      setCrmCredentials({});
      fetchCrmConnections();
    } catch (error: any) {
      console.error("Failed to create CRM connection:", error);
      setAlertModal({
        isOpen: true,
        title: "Connection Failed",
        message:
          error.response?.data?.error ||
          "Failed to connect to CRM. Please check your credentials and try again.",
        type: "error",
      });
    } finally {
      setCrmLoading(false);
    }
  };

  const handleUpdateCrmCredentials = async () => {
    if (!selectedCrm?.id) return;

    setCrmLoading(true);
    try {
      await api.crmConnections.updateCredentials(
        selectedCrm.id,
        crmCredentials
      );

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Credentials updated successfully!",
        type: "success",
      });

      setShowCredentialsModal(false);
      setSelectedCrm(null);
      setCrmCredentials({});
      fetchCrmConnections();
    } catch (error: any) {
      console.error("Failed to update credentials:", error);
      setAlertModal({
        isOpen: true,
        title: "Update Failed",
        message:
          error.response?.data?.error ||
          "Failed to update credentials. Please try again.",
        type: "error",
      });
    } finally {
      setCrmLoading(false);
    }
  };

  const handleConfirmCrmDisconnect = async () => {
    if (!crmDisconnectTarget?.id || crmDisconnecting) return;

    setCrmDisconnecting(true);
    try {
      await api.crmConnections.delete(crmDisconnectTarget.id);

      // Optimistically update UI immediately (avoid requiring a manual refresh)
      setCrmConnections((prev) =>
        prev.map((c: any) =>
          c?.id === crmDisconnectTarget.id ? { ...c, status: "disabled" } : c
        )
      );
      setConnectedIntegrations((prev) => {
        const next = new Set(prev);
        const crmType =
          crmDisconnectTarget?.crmType || crmDisconnectTarget?.provider;
        const intId = Object.keys(CRM_PROVIDERS).find(
          (key) => CRM_PROVIDERS[key] === crmType
        );
        if (intId) next.delete(intId);
        return next;
      });

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "CRM disconnected successfully!",
        type: "success",
      });

      setShowCrmDisconnectModal(false);
      setCrmDisconnectTarget(null);
      fetchCrmConnections();
    } catch (error) {
      console.error("Failed to delete CRM connection:", error);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Failed to disconnect CRM. Please try again.",
        type: "error",
      });
    } finally {
      setCrmDisconnecting(false);
    }
  };

  const handleTestCrmConnection = async (id: string) => {
    try {
      await api.crmConnections.test(id);

      setAlertModal({
        isOpen: true,
        title: "Success",
        message: "Connection test successful!",
        type: "success",
      });
    } catch (error: any) {
      console.error("Connection test failed:", error);
      setAlertModal({
        isOpen: true,
        title: "Test Failed",
        message:
          error.response?.data?.error ||
          "Failed to connect. Please check your credentials.",
        type: "error",
      });
    }
  };

  const handleViewGuide = (integration: Integration) => {
    const crmProvider = CRM_PROVIDERS[integration.id];
    if (crmProvider) {
      window.history.pushState({}, "", `/integrations/guide/${crmProvider}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const filteredIntegrations = MOCK_INTEGRATIONS.filter((int) => {
    const matchesCategory =
      selectedCategory === "ALL" ||
      (selectedCategory === "CONNECTED"
        ? connectedIntegrations.size === 0 || connectedIntegrations.has(int.id)
        : int.category === selectedCategory);
    const matchesSearch =
      int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      int.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedIntegrations = (() => {
    const connected: Integration[] = [];
    const disconnected: Integration[] = [];

    for (const int of filteredIntegrations) {
      if (connectedIntegrations.has(int.id)) connected.push(int);
      else disconnected.push(int);
    }

    return [...connected, ...disconnected];
  })();

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
              {sortedIntegrations.map((int) => {
                const isConnected = connectedIntegrations.has(int.id);
                const isConnecting = connectingId === int.id;
                const googleType = getGoogleType(int.id);
                const crmProvider = CRM_PROVIDERS[int.id];
                const isAvailable = googleType || crmProvider;
                const hasGuide = INTEGRATION_GUIDES[int.id];

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
                          disabled={isConnecting || !isAvailable}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors flex items-center gap-1 ${
                            !isAvailable
                              ? "text-slate-400 bg-slate-50 cursor-not-allowed"
                              : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                          }`}
                        >
                          {isConnecting ? (
                            <>
                              <Loader2 size={10} className="animate-spin" />
                              Connecting...
                            </>
                          ) : isAvailable ? (
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

                    {/* Setup Guide Link */}
                    {hasGuide && !isConnected && (
                      <button
                        onClick={() => handleViewGuide(int)}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium mb-3 transition-colors"
                      >
                        <BookOpen size={14} />
                        View Setup Guide
                      </button>
                    )}

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
                            <Unplug size={14} />
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

      <ConfirmationModal
        isOpen={showDisconnectModal}
        title="Disconnect integration?"
        message={
          disconnectTarget
            ? `Disconnect ${disconnectTarget.name} from this tenant?`
            : "Disconnect this integration from this tenant?"
        }
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
        isDestructive
        onConfirm={handleConfirmDisconnect}
        onCancel={handleCancelDisconnect}
      />

      <ConfirmationModal
        isOpen={showCrmDisconnectModal}
        title="Disconnect CRM?"
        message={
          crmDisconnectTarget?.name
            ? `Disconnect ${crmDisconnectTarget.name} from this tenant? Sync history will be preserved.`
            : "Disconnect this CRM from this tenant? Sync history will be preserved."
        }
        confirmLabel={crmDisconnecting ? "Disconnecting..." : "Disconnect"}
        cancelLabel="Cancel"
        isDestructive
        onConfirm={handleConfirmCrmDisconnect}
        onCancel={handleCancelCrmDisconnect}
      />

      {/* CRM Connection Modal */}
      {showCrmModal && selectedCrm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Connect {selectedCrm.name}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Connection Name
                </label>
                <input
                  type="text"
                  value={selectedCrm.name}
                  onChange={(e) =>
                    setSelectedCrm({ ...selectedCrm, name: e.target.value })
                  }
                  placeholder="My HubSpot Connection"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {selectedCrm.provider === "hubspot" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Access Token
                    </label>
                    <input
                      type="password"
                      value={crmCredentials.accessToken || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          accessToken: e.target.value,
                        })
                      }
                      placeholder="pat-na1-..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Get this from HubSpot Settings → Integrations → Private
                      Apps
                    </p>
                  </div>
                </>
              )}

              {selectedCrm.provider === "salesforce" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Instance URL
                    </label>
                    <input
                      type="text"
                      value={crmCredentials.instanceUrl || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          instanceUrl: e.target.value,
                        })
                      }
                      placeholder="https://yourinstance.salesforce.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Access Token
                    </label>
                    <input
                      type="password"
                      value={crmCredentials.accessToken || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          accessToken: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {selectedCrm.provider === "zoho" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Access Token
                    </label>
                    <input
                      type="password"
                      value={crmCredentials.accessToken || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          accessToken: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Refresh Token
                    </label>
                    <input
                      type="password"
                      value={crmCredentials.refreshToken || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          refreshToken: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {selectedCrm.provider === "odoo" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      URL
                    </label>
                    <input
                      type="text"
                      value={crmCredentials.url || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          url: e.target.value,
                        })
                      }
                      placeholder="https://yourcompany.odoo.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Database
                    </label>
                    <input
                      type="text"
                      value={crmCredentials.database || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          database: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={crmCredentials.username || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          username: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={crmCredentials.apiKey || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          apiKey: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCrmModal(false);
                  setSelectedCrm(null);
                  setCrmCredentials({});
                }}
                disabled={crmLoading}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCrmConnection}
                disabled={crmLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {crmLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update CRM Credentials Modal */}
      {showCredentialsModal && selectedCrm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Update Credentials
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Update credentials for <strong>{selectedCrm.name}</strong>
            </p>
            <div className="space-y-4">
              {selectedCrm.provider === "hubspot" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={crmCredentials.accessToken || ""}
                    onChange={(e) =>
                      setCrmCredentials({
                        ...crmCredentials,
                        accessToken: e.target.value,
                      })
                    }
                    placeholder="pat-na1-..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {selectedCrm.provider === "salesforce" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Instance URL
                    </label>
                    <input
                      type="text"
                      value={crmCredentials.instanceUrl || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          instanceUrl: e.target.value,
                        })
                      }
                      placeholder="https://yourinstance.salesforce.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Access Token
                    </label>
                    <input
                      type="password"
                      value={crmCredentials.accessToken || ""}
                      onChange={(e) =>
                        setCrmCredentials({
                          ...crmCredentials,
                          accessToken: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setSelectedCrm(null);
                  setCrmCredentials({});
                }}
                disabled={crmLoading}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCrmCredentials}
                disabled={crmLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {crmLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Integrations;
