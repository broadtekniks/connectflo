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
} from "lucide-react";
import { PhoneNumber } from "../types";
import { api } from "../services/api";

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
  const [isSearching, setIsSearching] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);
  const [ownedNumbers, setOwnedNumbers] = useState<PhoneNumber[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOwnedNumbers();
  }, []);

  const loadOwnedNumbers = async () => {
    try {
      const numbers = await api.phoneNumbers.list();
      setOwnedNumbers(numbers);
    } catch (error) {
      console.error("Failed to load numbers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const results = await api.phoneNumbers.search(searchCountry, searchQuery);
      // Map Telnyx results to PhoneNumber type
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
      await api.phoneNumbers.purchase(phoneNumber);
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
            <div className="flex gap-4">
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
                        <button className="text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded border border-slate-200 hover:border-indigo-200 text-xs font-medium transition-colors">
                          Configure Flow
                        </button>
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
                  <button className="w-full py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 hover:text-slate-900 transition-all">
                    Configure Flow
                  </button>
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
                <div className="w-full md:w-1/4">
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
                <div className="w-full md:w-1/2">
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
                <div className="w-full md:w-1/4">
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
    </div>
  );
};

export default PhoneNumbers;
