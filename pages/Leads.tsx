import React, { useState, useEffect } from "react";
import {
  Users,
  Mail,
  Phone,
  ExternalLink,
  RefreshCw,
  Filter,
  Clock,
  Tag,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "../services/api";
import { DateTime } from "luxon";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  notes: string | null;
  spreadsheetId: string | null;
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

const STATUS_OPTIONS = [
  { value: "NEW", label: "New", color: "bg-blue-100 text-blue-700" },
  {
    value: "CONTACTED",
    label: "Contacted",
    color: "bg-yellow-100 text-yellow-700",
  },
  {
    value: "QUALIFIED",
    label: "Qualified",
    color: "bg-purple-100 text-purple-700",
  },
  {
    value: "CONVERTED",
    label: "Converted",
    color: "bg-green-100 text-green-700",
  },
  { value: "LOST", label: "Lost", color: "bg-red-100 text-red-700" },
];

const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const loadLeads = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (sourceFilter !== "all") params.source = sourceFilter;

      const data = await api.leads.list(params);
      setLeads(data.leads || []);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter, sourceFilter]);

  const updateStatus = async (leadId: string, newStatus: string) => {
    try {
      await api.leads.updateStatus(leadId, newStatus);
      // Refresh the lead in the list
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );
    } catch (err) {
      console.error("Failed to update lead status:", err);
      alert("Failed to update lead status");
    }
  };

  const formatDate = (isoString: string) => {
    const dt = DateTime.fromISO(isoString);
    return dt.toLocaleString(DateTime.DATETIME_MED);
  };

  const getStatusColor = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return statusOption?.color || "bg-slate-100 text-slate-700";
  };

  const uniqueSources = Array.from(new Set(leads.map((l) => l.source)));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCw
            className="mx-auto mb-4 animate-spin text-indigo-600"
            size={40}
          />
          <p className="text-slate-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Users size={28} />
              Lead Captures
            </h1>
            <p className="text-slate-600 mt-1">
              {leads.length} {leads.length === 1 ? "lead" : "leads"} captured
            </p>
          </div>
          <button
            onClick={loadLeads}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Status:</span>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              All
            </button>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>

          {uniqueSources.length > 1 && (
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-700">
                Source:
              </span>
              <button
                onClick={() => setSourceFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sourceFilter === "all"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                All
              </button>
              {uniqueSources.map((source) => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sourceFilter === source
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Leads List */}
        {leads.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <Users className="mx-auto mb-4 text-slate-400" size={48} />
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              No leads found
            </h3>
            <p className="text-slate-600">
              {statusFilter !== "all" || sourceFilter !== "all"
                ? "Try adjusting your filters."
                : "Leads captured through workflows will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Lead Name & Status */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {lead.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(
                          lead.status
                        )}`}
                      >
                        {lead.status}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                        {lead.source}
                      </span>
                    </div>

                    {/* Contact Info */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3 text-sm text-slate-600">
                      {lead.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={16} className="text-slate-400" />
                          <a
                            href={`mailto:${lead.email}`}
                            className="hover:text-indigo-600"
                          >
                            {lead.email}
                          </a>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={16} className="text-slate-400" />
                          <a
                            href={`tel:${lead.phone}`}
                            className="hover:text-indigo-600"
                          >
                            {lead.phone}
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        <span>{formatDate(lead.createdAt)}</span>
                      </div>
                    </div>

                    {/* Notes */}
                    {lead.notes && (
                      <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700">
                        <span className="font-medium">Notes:</span> {lead.notes}
                      </div>
                    )}

                    {/* Spreadsheet Link */}
                    {lead.spreadsheetId && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileSpreadsheet size={16} className="text-green-600" />
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${lead.spreadsheetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 flex items-center gap-1"
                        >
                          View in Google Sheets
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Status Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Change Status
                    </label>
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;
