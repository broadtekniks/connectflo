import React, { useState, useEffect } from "react";
import {
  Phone,
  Search,
  MapPin,
  Check,
  Plus,
  Settings,
  Mic,
  MessageSquare,
  Image as ImageIcon,
  CreditCard,
  Loader2,
  LayoutGrid,
  List as ListIcon,
  RefreshCw,
} from "lucide-react";
import { PhoneNumber } from "../types";
import { api } from "../services/api";
import AlertModal from "../components/AlertModal";

const formatPhoneNumber = (phoneNumber: string) => {
  try {
    // If the number is masked (contains -), return as is or handle specifically
    if (phoneNumber.includes("---")) return phoneNumber;

    const cleaned = ("" + phoneNumber).replace(/\D/g, "");
    const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
    }
    return phoneNumber;
  } catch (e) {
    return phoneNumber;
  }
};

const PhoneNumbers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"my-numbers" | "buy">(
    "my-numbers"
  );
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCountry, setSearchCountry] = useState("US");
  const [selectedProvider, setSelectedProvider] = useState<"TELNYX" | "TWILIO">(
    "TELNYX"
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
  const [ownedNumbers, setOwnedNumbers] = useState<PhoneNumber[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [selectedNumberForTenant, setSelectedNumberForTenant] =
    useState<PhoneNumber | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testType, setTestType] = useState<"call" | "sms">("call");
  const [selectedNumberForTest, setSelectedNumberForTest] =
    useState<PhoneNumber | null>(null);
  const [testDestination, setTestDestination] = useState("");
  const [testMessage, setTestMessage] = useState(
    "This is a test message from ConnectFlo"
  );
  const [isTesting, setIsTesting] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  // Get user role from localStorage
  let isSuperAdmin = false;
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      isSuperAdmin = user?.role === "SUPER_ADMIN";
      console.log("User role:", user?.role, "isSuperAdmin:", isSuperAdmin);
    }
  } catch (error) {
    console.error("Failed to parse user from localStorage:", error);
  }

  useEffect(() => {
    loadOwnedNumbers();
    if (isSuperAdmin) {
      loadTenants();
    }
  }, []);

  const loadOwnedNumbers = async () => {
    try {
      const numbers = await api.phoneNumbers.list();
      setOwnedNumbers(numbers);

      // Auto-update regions if any numbers have Unknown or US as region
      const needsUpdate = numbers.some(
        (num) => num.region === "Unknown" || num.region === "US"
      );

      if (needsUpdate && process.env.NODE_ENV !== "development") {
        // Silently update regions in the background
        api.phoneNumbers
          .updateRegions()
          .then(() => {
            // Reload numbers after update
            return api.phoneNumbers.list();
          })
          .then((updatedNumbers) => {
            setOwnedNumbers(updatedNumbers);
          })
          .catch((err) => console.error("Failed to auto-update regions:", err));
      }
    } catch (error) {
      console.error("Failed to load numbers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      const tenantsData = await api.tenants.list();
      setTenants(tenantsData);
    } catch (error) {
      console.error("Failed to load tenants:", error);
    }
  };

  const handleAssignToTenant = async (tenantId: string) => {
    if (!selectedNumberForTenant) return;

    try {
      await api.phoneNumbers.assignToTenant(
        selectedNumberForTenant.id,
        tenantId
      );
      await loadOwnedNumbers();
      setShowTenantModal(false);
      setSelectedNumberForTenant(null);
      setModalState({
        isOpen: true,
        title: "Success",
        message: "Phone number assigned to tenant successfully",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to assign to tenant:", error);
      setModalState({
        isOpen: true,
        title: "Assignment Failed",
        message: "Failed to assign phone number to tenant",
        type: "error",
      });
    }
  };

  const handleTestCapability = async () => {
    if (!selectedNumberForTest || !testDestination) {
      setModalState({
        isOpen: true,
        title: "Validation Error",
        message: "Please enter a destination number",
        type: "error",
      });
      return;
    }

    setIsTesting(true);
    try {
      if (testType === "call") {
        await api.phoneNumbers.testCall(
          selectedNumberForTest.id,
          testDestination
        );
        setModalState({
          isOpen: true,
          title: "Call Initiated",
          message: `Test call from ${selectedNumberForTest.number} to ${testDestination} has been initiated`,
          type: "success",
        });
      } else {
        if (!testMessage) {
          setModalState({
            isOpen: true,
            title: "Validation Error",
            message: "Please enter a message",
            type: "error",
          });
          return;
        }
        await api.phoneNumbers.testSMS(
          selectedNumberForTest.id,
          testDestination,
          testMessage
        );
        setModalState({
          isOpen: true,
          title: "SMS Sent",
          message: `Test SMS from ${selectedNumberForTest.number} to ${testDestination} has been sent`,
          type: "success",
        });
      }
      setShowTestModal(false);
      setSelectedNumberForTest(null);
      setTestDestination("");
    } catch (error) {
      console.error("Failed to test capability:", error);
      setModalState({
        isOpen: true,
        title: "Test Failed",
        message: `Failed to ${
          testType === "call" ? "initiate call" : "send SMS"
        }`,
        type: "error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const results = await api.phoneNumbers.search(
        searchCountry,
        searchQuery,
        selectedProvider
      );
      // Map results to PhoneNumber type
      console.log("Search Results:", results);
      const mappedResults = results.map((r: any) => {
        let regionStr = "Unknown";
        let countryStr = searchCountry;

        if (Array.isArray(r.region_information)) {
          const city = r.region_information.find(
            (i: any) => i.region_type === "location"
          )?.region_name;
          const state = r.region_information.find(
            (i: any) => i.region_type === "state"
          )?.region_name;
          const country = r.region_information.find(
            (i: any) => i.region_type === "country_code"
          )?.region_name;

          if (city && state) regionStr = `${city}, ${state}`;
          else if (city) regionStr = city;
          else if (state) regionStr = state;

          if (country) countryStr = country;
        }

        return {
          id: r.phone_number, // Use phone number as temporary ID
          number: r.phone_number,
          friendlyName: r.phone_number,
          country: countryStr,
          region: regionStr,
          type: "local", // Default to local
          capabilities: {
            voice: r.features?.some((f: any) => f.name === "voice") || true, // Default true for now
            sms: r.features?.some((f: any) => f.name === "sms") || true,
            mms: r.features?.some((f: any) => f.name === "mms") || true,
          },
          monthlyCost: parseFloat(r.cost_information?.monthly_cost || "1.00"),
          setupCost: parseFloat(r.cost_information?.upfront_cost || "0.00"),
          status: "available",
        };
      });
      setSearchResults(mappedResults);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePurchase = async (phoneNumber: string) => {
    setIsPurchasing(phoneNumber);
    try {
      await api.phoneNumbers.purchase(phoneNumber, undefined, selectedProvider);
      await loadOwnedNumbers();
      setActiveTab("my-numbers");
      setSearchResults((prev) =>
        prev.filter((n) => n.phoneNumber !== phoneNumber)
      );
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setIsPurchasing(null);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await api.phoneNumbers.sync();
      await loadOwnedNumbers();
      setModalState({
        isOpen: true,
        title: "Sync Successful",
        message: `Synced ${result.synced} numbers from Telnyx. ${result.skipped} numbers were already in the database.`,
        type: "success",
      });
    } catch (error) {
      console.error("Sync failed:", error);
      setModalState({
        isOpen: true,
        title: "Sync Failed",
        message:
          "Failed to sync numbers from Telnyx. Please check your API configuration.",
        type: "error",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Phone Numbers
              </h1>
              <p className="text-slate-500 mt-1">
                Manage your inbound lines and purchase new numbers via Telnyx.
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Sync numbers from Telnyx"
              >
                <RefreshCw
                  size={14}
                  className={isSyncing ? "animate-spin" : ""}
                />
                {isSyncing ? "Syncing..." : "Sync Numbers"}
              </button>

              {/* View Toggle */}
              <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "list"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="List View"
                >
                  <ListIcon size={18} />
                </button>
                <button
                  onClick={() => setViewMode("card")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "card"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="Card View"
                >
                  <LayoutGrid size={18} />
                </button>
              </div>

              <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                <button
                  onClick={() => setActiveTab("my-numbers")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === "my-numbers"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  My Numbers
                </button>
                <button
                  onClick={() => setActiveTab("buy")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                    activeTab === "buy"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Plus size={16} />
                  Buy Numbers
                </button>
              </div>
            </div>
          </div>
        </div>

        {activeTab === "my-numbers" ? (
          viewMode === "list" ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Number</th>
                    <th className="px-6 py-3 font-semibold">Region</th>
                    <th className="px-6 py-3 font-semibold">Provider</th>
                    {isSuperAdmin && (
                      <th className="px-6 py-3 font-semibold">Tenant</th>
                    )}
                    <th className="px-6 py-3 font-semibold">Capabilities</th>
                    <th className="px-6 py-3 font-semibold">Cost / Month</th>
                    <th className="px-6 py-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ownedNumbers.map((num) => (
                    <tr
                      key={num.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 rounded text-indigo-600">
                            <Phone size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {formatPhoneNumber(num.number)}
                            </span>
                            <span className="text-xs text-slate-400">
                              {num.friendlyName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={`https://flagcdn.com/w20/${num.country.toLowerCase()}.png`}
                            alt={num.country}
                            className="w-4 rounded-sm"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                          {num.region && num.region !== "Unknown"
                            ? num.region
                            : num.country}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-bold rounded-full ${
                            num.provider === "TWILIO"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {num.provider || "TELNYX"}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-6 py-4 text-slate-600">
                          <div
                            className="inline-block cursor-help"
                            title={`Tenant ID: ${num.tenantId}`}
                          >
                            {tenants.find((t) => t.id === num.tenantId)?.name ||
                              "Unassigned"}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {num.capabilities.voice && (
                            <span
                              className="p-1.5 bg-purple-100 text-purple-600 rounded"
                              title="Voice"
                            >
                              <Mic size={14} />
                            </span>
                          )}
                          {num.capabilities.sms && (
                            <span
                              className="p-1.5 bg-green-100 text-green-600 rounded"
                              title="SMS"
                            >
                              <MessageSquare size={14} />
                            </span>
                          )}
                          {num.capabilities.mms && (
                            <span
                              className="p-1.5 bg-blue-100 text-blue-600 rounded"
                              title="MMS"
                            >
                              <ImageIcon size={14} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600">
                        ${num.monthlyCost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {num.capabilities.voice && (
                            <button
                              onClick={() => {
                                setSelectedNumberForTest(num);
                                setTestType("call");
                                setShowTestModal(true);
                              }}
                              className="text-purple-600 hover:text-purple-700 px-3 py-1.5 rounded border border-purple-200 hover:border-purple-300 text-xs font-medium transition-colors"
                              title="Test Voice Call"
                            >
                              Test Call
                            </button>
                          )}
                          {num.capabilities.sms && (
                            <button
                              onClick={() => {
                                setSelectedNumberForTest(num);
                                setTestType("sms");
                                setShowTestModal(true);
                              }}
                              className="text-green-600 hover:text-green-700 px-3 py-1.5 rounded border border-green-200 hover:border-green-300 text-xs font-medium transition-colors"
                              title="Test SMS"
                            >
                              Test SMS
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button
                              onClick={() => {
                                setSelectedNumberForTenant(num);
                                setShowTenantModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded border border-indigo-200 hover:border-indigo-300 text-xs font-medium transition-colors"
                            >
                              Assign Tenant
                            </button>
                          )}
                          <button className="text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded border border-slate-200 hover:border-indigo-200 text-xs font-medium transition-colors">
                            Configure Flow
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedNumbers.map((num) => (
                <div
                  key={num.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                      <Phone size={20} />
                    </div>
                    <div className="text-right">
                      <span className="block font-bold text-lg text-slate-900">
                        ${num.monthlyCost.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-400">/month</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-1">
                    {formatPhoneNumber(num.number)}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    {num.friendlyName}
                  </p>
                  <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                    <img
                      src={`https://flagcdn.com/w20/${num.country.toLowerCase()}.png`}
                      alt={num.country}
                      className="w-4 rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {num.region && num.region !== "Unknown"
                      ? num.region
                      : num.country}
                  </p>
                  {isSuperAdmin && (
                    <p
                      className="text-sm text-slate-600 mb-4 cursor-help"
                      title={`Tenant ID: ${num.tenantId}`}
                    >
                      <span className="font-medium">Tenant:</span>{" "}
                      {tenants.find((t) => t.id === num.tenantId)?.name ||
                        "Unknown Tenant"}
                    </p>
                  )}
                  <div className="flex gap-2 mb-6">
                    {num.capabilities.voice && (
                      <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded border border-purple-100">
                        Voice
                      </span>
                    )}
                    {num.capabilities.sms && (
                      <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded border border-green-100">
                        SMS
                      </span>
                    )}
                    {num.capabilities.mms && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-100">
                        MMS
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {num.capabilities.voice && (
                        <button
                          onClick={() => {
                            setSelectedNumberForTest(num);
                            setTestType("call");
                            setShowTestModal(true);
                          }}
                          className="flex-1 py-2 border border-purple-200 text-purple-600 rounded-lg font-bold hover:bg-purple-50 transition-all text-sm"
                        >
                          Test Call
                        </button>
                      )}
                      {num.capabilities.sms && (
                        <button
                          onClick={() => {
                            setSelectedNumberForTest(num);
                            setTestType("sms");
                            setShowTestModal(true);
                          }}
                          className="flex-1 py-2 border border-green-200 text-green-600 rounded-lg font-bold hover:bg-green-50 transition-all text-sm"
                        >
                          Test SMS
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isSuperAdmin && (
                        <button
                          onClick={() => {
                            setSelectedNumberForTenant(num);
                            setShowTenantModal(true);
                          }}
                          className="flex-1 py-2 border border-indigo-200 text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 transition-all"
                        >
                          Assign Tenant
                        </button>
                      )}
                      <button className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 hover:text-slate-900 transition-all text-sm">
                        Configure Flow
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-6">
            {/* Search Box */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-4">
                Search for Numbers
              </h2>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-1/5">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Provider
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => {
                      setSelectedProvider(
                        e.target.value as "TELNYX" | "TWILIO"
                      );
                      setSearchResults([]);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="TELNYX">Telnyx</option>
                    <option value="TWILIO">Twilio (OpenAI Voice)</option>
                  </select>
                </div>
                <div className="w-full md:w-1/5">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Country
                  </label>
                  <select
                    value={searchCountry}
                    onChange={(e) => {
                      setSearchCountry(e.target.value);
                      setSearchResults([]);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="US">United States (+1)</option>
                    <option value="GB">United Kingdom (+44)</option>
                    <option value="CA">Canada (+1)</option>
                    <option value="AU">Australia (+61)</option>
                  </select>
                </div>
                <div className="w-full md:w-2/5">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Search by Region or Area Code
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="e.g. New York, 415, London..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="w-full md:w-1/5">
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    {isSearching ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Search size={18} />
                    )}
                    Search
                  </button>
                </div>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 ? (
              viewMode === "list" ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Number</th>
                        <th className="px-6 py-3 font-semibold">Region</th>
                        <th className="px-6 py-3 font-semibold">
                          Capabilities
                        </th>
                        <th className="px-6 py-3 font-semibold">
                          Cost / Month
                        </th>
                        <th className="px-6 py-3 font-semibold text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {searchResults.map((num) => (
                        <tr
                          key={num.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 rounded text-slate-600">
                                {num.type === "mobile" ? (
                                  <Phone size={18} />
                                ) : (
                                  <MapPin size={18} />
                                )}
                              </div>
                              <span className="font-bold text-slate-800 block">
                                {formatPhoneNumber(num.number)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <img
                                src={`https://flagcdn.com/w20/${num.country.toLowerCase()}.png`}
                                alt={num.country}
                                className="w-4 rounded-sm"
                              />
                              {num.region}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {num.capabilities.voice && (
                                <span
                                  className="p-1.5 bg-purple-100 text-purple-600 rounded"
                                  title="Voice"
                                >
                                  <Mic size={14} />
                                </span>
                              )}
                              {num.capabilities.sms && (
                                <span
                                  className="p-1.5 bg-green-100 text-green-600 rounded"
                                  title="SMS"
                                >
                                  <MessageSquare size={14} />
                                </span>
                              )}
                              {num.capabilities.mms && (
                                <span
                                  className="p-1.5 bg-blue-100 text-blue-600 rounded"
                                  title="MMS"
                                >
                                  <ImageIcon size={14} />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-600">
                            ${num.monthlyCost.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handlePurchase(num.id)}
                              disabled={isPurchasing === num.id}
                              className="text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded border border-indigo-200 hover:border-indigo-300 text-xs font-bold transition-colors flex items-center gap-2 ml-auto"
                            >
                              {isPurchasing === num.id ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <CreditCard size={14} />
                              )}
                              {isPurchasing === num.id ? "..." : "Buy"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.map((num) => (
                    <div
                      key={num.id}
                      className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                          {num.type === "mobile" ? (
                            <Phone size={20} />
                          ) : (
                            <MapPin size={20} />
                          )}
                        </div>
                        <div className="text-right">
                          <span className="block font-bold text-lg text-slate-900">
                            ${num.monthlyCost.toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-400">/month</span>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-1">
                        {formatPhoneNumber(num.number)}
                      </h3>
                      <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                        <img
                          src={`https://flagcdn.com/w20/${num.country.toLowerCase()}.png`}
                          alt={num.country}
                          className="w-4 rounded-sm"
                        />
                        {num.region}
                      </p>
                      <div className="flex gap-2 mb-6">
                        {num.capabilities.voice && (
                          <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded border border-purple-100">
                            Voice
                          </span>
                        )}
                        {num.capabilities.sms && (
                          <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded border border-green-100">
                            SMS
                          </span>
                        )}
                        {num.capabilities.mms && (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-100">
                            MMS
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handlePurchase(num.id)}
                        disabled={isPurchasing === num.id}
                        className="w-full py-2 border border-indigo-600 text-indigo-600 rounded-lg font-bold hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        {isPurchasing === num.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <CreditCard size={16} />
                        )}
                        {isPurchasing === num.id
                          ? "Provisioning..."
                          : "Buy Number"}
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                <div className="bg-white p-4 rounded-full inline-flex mb-4 shadow-sm text-slate-400">
                  <Search size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-700">
                  No numbers found
                </h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-1">
                  Try searching for a different region or country code to see
                  available Telnyx inventory.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <AlertModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />

      {/* Tenant Assignment Modal */}
      {showTenantModal && selectedNumberForTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Assign to Tenant
              </h3>
              <p className="text-slate-500 mt-1">
                {formatPhoneNumber(selectedNumberForTenant.number)}
              </p>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleAssignToTenant(tenant.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:border-indigo-500 hover:bg-indigo-50 ${
                      selectedNumberForTenant.tenantId === tenant.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="font-semibold text-slate-900">
                      {tenant.name}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      Plan: {tenant.plan} • Status: {tenant.status}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTenantModal(false);
                  setSelectedNumberForTenant(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Capability Modal */}
      {showTestModal && selectedNumberForTest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                Test {testType === "call" ? "Voice Call" : "SMS"}
              </h3>
              <p className="text-slate-500 mt-1">
                From: {formatPhoneNumber(selectedNumberForTest.number)}
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Destination Number
                  </label>
                  <input
                    type="tel"
                    value={testDestination}
                    onChange={(e) => setTestDestination(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter the phone number to test with (include country code)
                  </p>
                </div>
                {testType === "sms" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Message
                    </label>
                    <textarea
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setSelectedNumberForTest(null);
                  setTestDestination("");
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                disabled={isTesting}
              >
                Cancel
              </button>
              <button
                onClick={handleTestCapability}
                disabled={isTesting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    {testType === "call" ? "Calling..." : "Sending..."}
                  </>
                ) : (
                  <>{testType === "call" ? "Make Call" : "Send SMS"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneNumbers;
