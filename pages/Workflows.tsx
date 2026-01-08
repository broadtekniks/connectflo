import React, { useState, useRef, useEffect } from "react";
import { MOCK_WORKFLOWS } from "../constants";
import { Workflow, WorkflowNode, WorkflowEdge, PhoneNumber } from "../types";
import { api } from "../services/api";
import ConfirmationModal from "../components/ConfirmationModal";
import AlertModal from "../components/AlertModal";
import {
  Zap,
  Play,
  Menu,
  MoreHorizontal,
  Trash2,
  Plus,
  ArrowRight,
  Layout,
  ShoppingBag,
  Mail,
  UserPlus,
  Tag,
  XCircle,
  MousePointer2,
  Settings2,
  X,
  Phone,
  Shield,
  Clock,
  GitBranch,
  Repeat,
  MessageSquare,
  FileText,
  Link,
  Bot,
  Save,
  Check,
  Loader2,
  Calendar,
  Upload,
  Database,
  PhoneOff,
  UserCheck,
  Users,
  PhoneForwarded,
} from "lucide-react";

const API_URL = "http://localhost:3002/api";

const authHeader = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const getMissingSendEmailFields = (node: WorkflowNode) => {
  const missing: string[] = [];
  const to = String((node as any)?.config?.to ?? "").trim();
  const subject = String((node as any)?.config?.subject ?? "").trim();
  const body = String((node as any)?.config?.body ?? "").trim();

  if (!to) missing.push("Recipient Email");
  if (!subject) missing.push("Subject Line");
  if (!body) missing.push("Email Body");
  return missing;
};

const isSendEmailFieldMissing = (
  node: WorkflowNode,
  field: "to" | "subject" | "body"
) => {
  const config = (node as any)?.config ?? {};
  const value = String(config?.[field] ?? "").trim();
  return value.length === 0;
};

const getDetectedTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const getTimeZoneOptions = (preferred?: string): string[] => {
  const intlAny: any = Intl as any;
  if (typeof intlAny.supportedValuesOf === "function") {
    try {
      const zones = intlAny.supportedValuesOf("timeZone");
      if (Array.isArray(zones) && zones.length > 0) {
        if (preferred && !zones.includes(preferred)) {
          return [preferred, ...zones];
        }
        return zones;
      }
    } catch {
      // fall through
    }
  }

  const fallback = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Toronto",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "Europe/Madrid",
    "Africa/Lagos",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];

  if (preferred && !fallback.includes(preferred)) {
    return [preferred, ...fallback];
  }
  return fallback;
};

type BusinessHoursDayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

type BusinessHoursConfig = {
  days: Record<
    BusinessHoursDayKey,
    { enabled: boolean; start: string; end: string }
  >;
};

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  days: {
    mon: { enabled: true, start: "09:00", end: "17:00" },
    tue: { enabled: true, start: "09:00", end: "17:00" },
    wed: { enabled: true, start: "09:00", end: "17:00" },
    thu: { enabled: true, start: "09:00", end: "17:00" },
    fri: { enabled: true, start: "09:00", end: "17:00" },
    sat: { enabled: false, start: "09:00", end: "17:00" },
    sun: { enabled: false, start: "09:00", end: "17:00" },
  },
};

const normalizeBusinessHoursConfig = (raw: any): BusinessHoursConfig => {
  const days = raw?.days;
  if (!days || typeof days !== "object") return DEFAULT_BUSINESS_HOURS;

  const out: BusinessHoursConfig = {
    days: { ...DEFAULT_BUSINESS_HOURS.days },
  };

  (Object.keys(out.days) as BusinessHoursDayKey[]).forEach((k) => {
    const d = days?.[k];
    if (!d || typeof d !== "object") return;

    const enabled = Boolean(d.enabled);
    const start = typeof d.start === "string" ? d.start : out.days[k].start;
    const end = typeof d.end === "string" ? d.end : out.days[k].end;
    out.days[k] = { enabled, start, end };
  });

  return out;
};

// --- Component Library Definition ---

const CONFIG_CATEGORY_NAME = "Configuration";
const CONFIG_NODE_LABELS = new Set([
  "Knowledge Base",
  "AI Configuration",
  "Agent Assignment",
  "Time Settings",
]);

const COMPONENT_LIBRARY = [
  {
    category: "Triggers",
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
    items: [
      {
        label: "Incoming Message",
        icon: MessageSquare,
        type: "trigger",
        subLabel: "Chat or Email",
      },
      {
        label: "Incoming Call",
        icon: Phone,
        type: "trigger",
        subLabel: "Voice Channel",
      },
    ],
  },
  {
    category: "Configuration",
    color: "text-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
    items: [
      {
        label: "Knowledge Base",
        icon: FileText,
        type: "config",
        subLabel: "Assign documents",
      },
      {
        label: "AI Configuration",
        icon: Bot,
        type: "config",
        subLabel: "Set AI behavior",
      },
      {
        label: "Agent Assignment",
        icon: UserCheck,
        type: "config",
        subLabel: "Assign agent & hours",
      },
      {
        label: "Time Settings",
        icon: Clock,
        type: "config",
        subLabel: "Timezone & business hours",
      },
    ],
  },
  {
    category: "Logic",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    items: [
      {
        label: "Condition",
        icon: GitBranch,
        type: "condition",
        subLabel: "If / Else",
      },
      {
        label: "Wait / Delay",
        icon: Clock,
        type: "condition",
        subLabel: "Pause workflow",
      },
      {
        label: "Loop",
        icon: Repeat,
        type: "condition",
        subLabel: "Iterate list",
      },
      {
        label: "A/B Split",
        icon: GitBranch,
        type: "condition",
        subLabel: "Random distribution",
      },
    ],
  },
  {
    category: "Actions",
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    items: [
      {
        label: "Send Reply",
        icon: MessageSquare,
        type: "action",
        subLabel: "To Customer",
      },
      { label: "Send Email", icon: Mail, type: "action", subLabel: "Outbound" },
      {
        label: "Create Calendar Event",
        icon: Calendar,
        type: "action",
        subLabel: "Email .ics invite",
      },
      {
        label: "Assign Agent",
        icon: UserPlus,
        type: "action",
        subLabel: "Route conversation",
      },
      { label: "Add Tag", icon: Tag, type: "action", subLabel: "Categorize" },
      {
        label: "AI Generate",
        icon: Zap,
        type: "action",
        subLabel: "Draft response",
      },
      {
        label: "End Chat",
        icon: XCircle,
        type: "action",
        subLabel: "Close conversation",
      },
      {
        label: "End Call",
        icon: PhoneOff,
        type: "action",
        subLabel: "Hang up call",
      },
      {
        label: "Say/Play",
        icon: Phone,
        type: "action",
        subLabel: "TTS or hold music",
      },
      {
        label: "Call Group",
        icon: Users,
        type: "action",
        subLabel: "Ring multiple agents",
      },
      {
        label: "Call Forwarding",
        icon: PhoneForwarded,
        type: "action",
        subLabel: "Transfer call",
      },
    ],
  },
  {
    category: "Available Integrations",
    color: "text-blue-600",
    bg: "bg-white",
    border: "border-blue-200",
    items: [
      {
        label: "Send Gmail",
        icon: Mail,
        type: "integration",
        subLabel: "Via Google",
        provider: "google",
      },
      {
        label: "Upload to Drive",
        icon: Upload,
        type: "integration",
        subLabel: "Google Drive",
        provider: "google",
      },
      {
        label: "Add Row to Sheet",
        icon: FileText,
        type: "integration",
        subLabel: "Google Sheets",
        provider: "google",
      },
      {
        label: "Shopify Get Order",
        iconUrl: "https://cdn.simpleicons.org/shopify",
        type: "integration",
        subLabel: "Fetch order details",
      },
      {
        label: "Stripe Refund",
        iconUrl: "https://cdn.simpleicons.org/stripe",
        type: "integration",
        subLabel: "Process full refund",
      },
      {
        label: "Salesforce Lookup",
        iconUrl: "https://cdn.simpleicons.org/salesforce",
        type: "integration",
        subLabel: "Find customer",
        provider: "salesforce",
      },
      {
        label: "HubSpot",
        iconUrl: "https://cdn.simpleicons.org/hubspot",
        type: "integration",
        subLabel: "CRM operations",
        provider: "hubspot",
      },
      {
        label: "Jira Issue",
        iconUrl: "https://cdn.simpleicons.org/jira",
        type: "integration",
        subLabel: "Create bug ticket",
      },
      {
        label: "Slack Message",
        iconUrl: "https://cdn.simpleicons.org/slack",
        type: "integration",
        subLabel: "Notify channel",
        provider: "slack",
      },
      {
        label: "Teams Notify",
        iconUrl: "https://cdn.simpleicons.org/microsoftteams",
        type: "integration",
        subLabel: "Send alert",
      },
      {
        label: "Postgres Query",
        iconUrl: "https://cdn.simpleicons.org/postgresql",
        type: "integration",
        subLabel: "Execute SQL",
      },
      {
        label: "Zendesk Ticket",
        iconUrl: "https://cdn.simpleicons.org/zendesk",
        type: "integration",
        subLabel: "Create support ticket",
      },
      {
        label: "Twilio SMS",
        iconUrl: "https://cdn.simpleicons.org/twilio",
        type: "integration",
        subLabel: "Send text",
      },
      {
        label: "SendGrid Email",
        iconUrl: "https://cdn.simpleicons.org/sendgrid",
        type: "integration",
        subLabel: "Send transactional",
      },
      {
        label: "Odoo Update",
        iconUrl: "https://cdn.simpleicons.org/odoo",
        type: "integration",
        subLabel: "Update record",
      },
    ],
  },
];

// --- Helper Functions ---

const generateId = () =>
  `node-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

type PhoneVoiceOption = {
  id: string;
  name: string;
  gender?: string;
  language?: string;
  description?: string;
};

// --- Condition Builder Component ---

interface FieldSchema {
  path: string;
  label: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object";
  category: string;
  description?: string;
  allowedOperators: string[];
  examples?: string[];
}

interface ConditionBuilderProps {
  node: WorkflowNode;
  onUpdate: (config: any) => void;
}

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  node,
  onUpdate,
}) => {
  const [availableFields, setAvailableFields] = useState<FieldSchema[]>([]);
  const [groupedFields, setGroupedFields] = useState<
    Record<string, FieldSchema[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [availableIntents, setAvailableIntents] = useState<
    Array<{ id: string; name?: string; enabled?: boolean }>
  >([]);

  // Load available fields from API
  useEffect(() => {
    const loadFields = async () => {
      try {
        const response = await fetch(`${API_URL}/condition-schema`, {
          headers: authHeader(),
        });
        const data = await response.json();
        setAvailableFields(data.fields || []);
        setGroupedFields(data.grouped || {});
      } catch (error) {
        console.error("Failed to load condition fields:", error);
      } finally {
        setLoading(false);
      }
    };
    loadFields();
  }, []);

  useEffect(() => {
    const loadIntents = async () => {
      try {
        const response = await fetch(`${API_URL}/ai-config/intents`, {
          headers: authHeader(),
        });
        if (!response.ok) return;
        const data = await response.json();
        const intents = Array.isArray(data?.intents) ? data.intents : [];
        setAvailableIntents(intents);
      } catch (error) {
        // Non-blocking: conditions still work with manual input.
        console.error("Failed to load intents:", error);
      }
    };

    loadIntents();
  }, []);

  // Initialize condition config if not exists
  const conditionConfig = node.config?.condition || {
    evaluationType: "simple",
    simple: {
      leftOperand: { type: "variable", value: "" },
      operator: "equals",
      rightOperand: { type: "literal", value: "" },
    },
  };

  const updateCondition = (newConfig: any) => {
    onUpdate({
      ...node.config,
      condition: newConfig,
    });
  };

  const addCondition = () => {
    if (conditionConfig.evaluationType === "simple") {
      // Convert to compound
      updateCondition({
        evaluationType: "compound",
        compound: {
          logic: "AND",
          conditions: [
            conditionConfig,
            {
              evaluationType: "simple",
              simple: {
                leftOperand: { type: "variable", value: "" },
                operator: "equals",
                rightOperand: { type: "literal", value: "" },
              },
            },
          ],
        },
      });
    } else {
      // Add to existing compound
      updateCondition({
        ...conditionConfig,
        compound: {
          ...conditionConfig.compound,
          conditions: [
            ...conditionConfig.compound.conditions,
            {
              evaluationType: "simple",
              simple: {
                leftOperand: { type: "variable", value: "" },
                operator: "equals",
                rightOperand: { type: "literal", value: "" },
              },
            },
          ],
        },
      });
    }
  };

  const removeCondition = (index: number) => {
    if (conditionConfig.evaluationType === "compound") {
      const newConditions = conditionConfig.compound.conditions.filter(
        (_: any, i: number) => i !== index
      );

      if (newConditions.length === 1) {
        // Convert back to simple
        updateCondition(newConditions[0]);
      } else {
        updateCondition({
          ...conditionConfig,
          compound: {
            ...conditionConfig.compound,
            conditions: newConditions,
          },
        });
      }
    }
  };

  const updateSimpleCondition = (path: string, value: any, index?: number) => {
    if (conditionConfig.evaluationType === "simple") {
      const keys = path.split(".");
      const updated = { ...conditionConfig };
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      updateCondition(updated);
    } else if (index !== undefined) {
      const conditions = [...conditionConfig.compound.conditions];
      const keys = path.split(".");
      let current: any = conditions[index];

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      updateCondition({
        ...conditionConfig,
        compound: {
          ...conditionConfig.compound,
          conditions,
        },
      });
    }
  };

  const toggleLogic = () => {
    if (conditionConfig.evaluationType === "compound") {
      updateCondition({
        ...conditionConfig,
        compound: {
          ...conditionConfig.compound,
          logic: conditionConfig.compound.logic === "AND" ? "OR" : "AND",
        },
      });
    }
  };

  const renderSimpleCondition = (simple: any, index?: number) => {
    const selectedField = availableFields.find(
      (f) => f.path === simple.leftOperand?.value
    );
    const operators =
      selectedField?.path === "conversation.intent"
        ? (selectedField?.allowedOperators || []).filter(
            (op) => op !== "in" && op !== "not_in"
          )
        : selectedField?.allowedOperators || [
            "equals",
            "not_equals",
            "greater_than",
            "less_than",
            "contains",
          ];

    const intentOptions = availableIntents.filter((i) => i?.enabled !== false);
    const showIntentPicker = selectedField?.path === "conversation.intent";

    return (
      <div
        key={index}
        className="space-y-3 p-4 bg-white border border-slate-200 rounded-lg"
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-3">
            {/* Field Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Field
              </label>
              <select
                value={simple.leftOperand?.value || ""}
                onChange={(e) =>
                  updateSimpleCondition(
                    "simple.leftOperand.value",
                    e.target.value,
                    index
                  )
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select field...</option>
                {Object.entries(groupedFields).map(([category, fields]) => (
                  <optgroup key={category} label={category}>
                    {fields.map((field) => (
                      <option key={field.path} value={field.path}>
                        {field.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Operator Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Operator
              </label>
              <select
                value={simple.operator || "equals"}
                onChange={(e) =>
                  updateSimpleCondition(
                    "simple.operator",
                    e.target.value,
                    index
                  )
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Value Input */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Value
              </label>
              {showIntentPicker && intentOptions.length > 0 ? (
                <select
                  value={simple.rightOperand?.value || ""}
                  onChange={(e) =>
                    updateSimpleCondition(
                      "simple.rightOperand.value",
                      e.target.value,
                      index
                    )
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select intent...</option>
                  {intentOptions.map((intent) => (
                    <option key={intent.id} value={intent.id}>
                      {intent.name || intent.id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={simple.rightOperand?.value || ""}
                  onChange={(e) =>
                    updateSimpleCondition(
                      "simple.rightOperand.value",
                      e.target.value,
                      index
                    )
                  }
                  placeholder={
                    showIntentPicker
                      ? "Enter intent id (e.g. cancel_subscription)"
                      : "Enter value or {{variable}}"
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
              {selectedField?.examples && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Examples: {selectedField.examples.join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Remove button for compound conditions */}
          {index !== undefined && (
            <button
              onClick={() => removeCondition(index)}
              className="mt-7 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="pt-6 border-t border-slate-100">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-slate-400" size={24} />
          <span className="ml-2 text-sm text-slate-500">Loading fields...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6 border-t border-slate-100 space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
          Condition Rules
        </label>

        {conditionConfig.evaluationType === "simple" ? (
          renderSimpleCondition(conditionConfig.simple)
        ) : (
          <div className="space-y-3">
            {/* Logic Toggle */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-600">Match</span>
              <button
                onClick={toggleLogic}
                className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-md text-xs font-bold hover:bg-indigo-200 transition-colors"
              >
                {conditionConfig.compound.logic}
              </button>
              <span className="text-xs font-medium text-slate-600">
                of the following:
              </span>
            </div>

            {/* Conditions List */}
            {conditionConfig.compound.conditions.map(
              (cond: any, index: number) => (
                <div key={index}>
                  {renderSimpleCondition(cond.simple, index)}
                  {index < conditionConfig.compound.conditions.length - 1 && (
                    <div className="flex items-center justify-center py-2">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                        {conditionConfig.compound.logic}
                      </span>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Add Condition Button */}
        <button
          onClick={addCondition}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors"
        >
          <Plus size={16} />
          Add {conditionConfig.evaluationType === "compound"
            ? "Another"
            : ""}{" "}
          Condition
        </button>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Tip:</strong> Connect edges from this node and label them
            "yes" or "no" to route based on the condition result.
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Components for the Visual Builder ---

interface NodeProps {
  node: WorkflowNode;
  isActive: boolean;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onPortMouseDown: (
    e: React.MouseEvent,
    nodeId: string,
    type: "source" | "target"
  ) => void;
  onDelete: (nodeId: string) => void;
  ownedNumbers: PhoneNumber[];
}

const Node: React.FC<NodeProps> = ({
  node,
  isActive,
  isSelected,
  onMouseDown,
  onPortMouseDown,
  ownedNumbers,
}) => {
  const getNodeStyles = (type: string) => {
    switch (type) {
      case "trigger":
        return "border-orange-400 bg-orange-50 text-orange-900 shadow-orange-100";
      case "action":
        return "border-indigo-400 bg-white text-indigo-900 shadow-indigo-50";
      case "condition":
        return "border-slate-400 bg-slate-50 text-slate-900 shadow-slate-100";
      case "integration":
        return "border-blue-400 bg-blue-50 text-blue-900 shadow-blue-50";
      default:
        return "border-slate-200 bg-white";
    }
  };

  return (
    <div
      style={{ left: node.x, top: node.y, position: "absolute" }}
      className={`w-64 p-3 rounded-lg border-2 transition-shadow duration-200 select-none group ${getNodeStyles(
        node.type
      )} ${
        isActive
          ? "ring-4 ring-green-400 ring-opacity-50 scale-105 z-20"
          : "z-10"
      } ${isSelected ? "ring-2 ring-indigo-500 shadow-lg" : "hover:shadow-md"}`}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onClick={(e) => e.stopPropagation()} // Prevent canvas click from deselecting immediately
    >
      <div className="flex items-center gap-3 pointer-events-none">
        <div
          className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
            node.type === "trigger"
              ? "bg-orange-100"
              : "bg-white border border-slate-100 overflow-hidden p-1.5"
          }`}
        >
          {node.icon ? (
            <img
              src={node.icon}
              alt=""
              className="w-full h-full object-contain"
            />
          ) : node.type === "trigger" ? (
            <Zap size={20} className="text-orange-500" />
          ) : node.type === "condition" ? (
            <GitBranch size={20} className="text-slate-500" />
          ) : (
            <Layout size={20} className="text-indigo-500" />
          )}
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">{node.label}</p>
          {node.subLabel && (
            <p className="text-xs opacity-70 mt-0.5">{node.subLabel}</p>
          )}
          {/* Show configured phone number if applicable */}
          {node.label === "Incoming Call" && node.config?.phoneNumberId && (
            <p className="text-[10px] text-indigo-600 font-medium mt-0.5 bg-indigo-50 px-1 rounded inline-block border border-indigo-100">
              {
                ownedNumbers.find((n) => n.id === node.config.phoneNumberId)
                  ?.number
              }
            </p>
          )}
        </div>
      </div>

      {/* Input Port (Top) */}
      {node.type !== "trigger" && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-slate-400 rounded-full hover:bg-indigo-100 hover:border-indigo-500 hover:scale-125 transition-all cursor-crosshair z-30"
          onMouseDown={(e) => onPortMouseDown(e, node.id, "target")}
          title="Connect to here"
        ></div>
      )}

      {/* Output Port (Bottom) */}
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-slate-400 rounded-full hover:bg-indigo-100 hover:border-indigo-500 hover:scale-125 transition-all cursor-crosshair z-30"
        onMouseDown={(e) => onPortMouseDown(e, node.id, "source")}
        title="Connect from here"
      ></div>
    </div>
  );
};

interface ConnectionLineProps {
  start: { x: number; y: number };
  end: { x: number; y: number };
  label?: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  start,
  end,
  label,
  isSelected,
  onClick,
  onDelete,
}) => {
  // Calculate Bezier curve for smooth connection
  const path = `M ${start.x} ${start.y} C ${start.x} ${start.y + 50}, ${
    end.x
  } ${end.y - 50}, ${end.x} ${end.y}`;

  return (
    <g onClick={onClick} className="group pointer-events-auto">
      {/* Thick transparent stroke for easier hovering/selecting */}
      <path
        d={path}
        stroke="transparent"
        strokeWidth="20"
        fill="none"
        className="cursor-pointer"
      />
      {/* Visible stroke */}
      <path
        d={path}
        stroke={isSelected ? "#6366f1" : "#94a3b8"}
        strokeWidth={isSelected ? "3" : "2"}
        fill="none"
        markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
        className="transition-colors duration-200 group-hover:stroke-indigo-400"
      />

      {label && (
        <g>
          <rect
            x={(start.x + end.x) / 2 - 20}
            y={(start.y + end.y) / 2 - 10}
            width="40"
            height="20"
            rx="4"
            fill={isSelected ? "#e0e7ff" : "white"}
            stroke={isSelected ? "#6366f1" : "#e2e8f0"}
          />
          <text
            x={(start.x + end.x) / 2}
            y={(start.y + end.y) / 2 + 4}
            textAnchor="middle"
            className={`text-[10px] font-medium pointer-events-none ${
              isSelected ? "fill-indigo-700" : "fill-slate-500"
            } uppercase`}
          >
            {label}
          </text>
        </g>
      )}

      {/* Delete Button (Visible when selected) */}
      {isSelected && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="cursor-pointer hover:opacity-80"
        >
          <circle
            cx={(start.x + end.x) / 2}
            cy={(start.y + end.y) / 2}
            r="10"
            fill="#ef4444"
            stroke="white"
            strokeWidth="1"
          />
          <Trash2
            size={12}
            x={(start.x + end.x) / 2 - 6}
            y={(start.y + end.y) / 2 - 6}
            color="white"
          />
        </g>
      )}
    </g>
  );
};

// --- Main Page Component ---

const Workflows: React.FC = () => {
  const [view, setView] = useState<"list" | "builder">("list");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowMeta, setSelectedWorkflowMeta] =
    useState<Workflow | null>(null);
  const [connectedIntegrations, setConnectedIntegrations] = useState<
    Array<{ provider: string; type: string; name: string }>
  >([]);
  const [filterLabel, setFilterLabel] = useState<string>("");
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [editingLabels, setEditingLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadWorkflows();
    fetchConnectedIntegrations();
    fetchTenantBusinessHours();
  }, []);

  const fetchTenantBusinessHours = async () => {
    try {
      const data = await api.tenants.getBusinessHours();
      if (typeof data?.maxMeetingDurationMinutes === "number") {
        setTenantMaxMeetingDuration(data.maxMeetingDurationMinutes);
      }

      if (typeof data?.timeZone === "string" && data.timeZone.trim()) {
        setTenantBusinessTimeZone(String(data.timeZone).trim());
      } else {
        setTenantBusinessTimeZone(getDetectedTimeZone());
      }

      if (data?.businessHours) {
        setTenantBusinessHours(data.businessHours);
      }
    } catch (error) {
      console.error("Failed to fetch tenant business hours:", error);
    }
  };

  const loadWorkflows = async () => {
    try {
      const data = await api.workflows.list();
      setWorkflows(data);
    } catch (error) {
      console.error("Failed to load workflows:", error);
    }
  };

  const fetchConnectedIntegrations = async () => {
    try {
      const response = await api.get("/integrations");
      console.log("[Workflows] Fetched integrations:", response);
      console.log("[Workflows] Integrations array:", response.integrations);
      // Only keep connected integrations
      const connectedOnly = Array.isArray(response.integrations)
        ? response.integrations.filter((i: any) => i?.connected === true)
        : [];

      // Also fetch CRM connections
      try {
        const crmConnections = await api.crmConnections.list();
        console.log("[Workflows] Fetched CRM connections:", crmConnections);

        // Add CRM connections to the list (they all count as connected)
        crmConnections.forEach((conn: any) => {
          connectedOnly.push({
            provider: conn.crmType,
            type: "crm",
            name: conn.crmType,
          });
        });
      } catch (crmError) {
        console.error("Failed to fetch CRM connections:", crmError);
      }

      setConnectedIntegrations(connectedOnly);
      console.log(
        "[Workflows] Connected integrations state set to:",
        connectedOnly
      );
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
    }
  };

  // Builder State
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showMobileLibrary, setShowMobileLibrary] = useState(false);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);

  const [gmailSenderStatus, setGmailSenderStatus] = useState<{
    state: "idle" | "loading" | "loaded" | "error";
    email?: string;
  }>({ state: "idle" });

  const [calendarConferenceStatus, setCalendarConferenceStatus] = useState<{
    state: "idle" | "loading" | "loaded" | "error";
    connected?: boolean;
    allowedTypes?: string[];
  }>({ state: "idle" });

  const [tenantMaxMeetingDuration, setTenantMaxMeetingDuration] =
    useState<number>(60);
  const [tenantBusinessTimeZone, setTenantBusinessTimeZone] = useState<string>(
    getDetectedTimeZone()
  );
  const [tenantBusinessHours, setTenantBusinessHours] = useState<any>(null);

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState<number>(320); // 320px = w-80 default
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      // Constrain width between 280px and 800px
      const constrainedWidth = Math.max(280, Math.min(800, newWidth));
      setSidebarWidth(constrainedWidth);
    };

    const handleResizeMoveTouch = (e: TouchEvent) => {
      if (!isResizing) return;
      const touch = e.touches?.[0];
      if (!touch) return;
      const newWidth = window.innerWidth - touch.clientX;
      const constrainedWidth = Math.max(280, Math.min(800, newWidth));
      setSidebarWidth(constrainedWidth);
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      document.addEventListener("touchmove", handleResizeMoveTouch, {
        passive: false,
      });
      document.addEventListener("touchend", handleResizeEnd);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
        document.removeEventListener("touchmove", handleResizeMoveTouch);
        document.removeEventListener("touchend", handleResizeEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizing]);

  // Workflow-level configuration (persistent resources, not canvas nodes)
  const [activeWorkflowConfigPanel, setActiveWorkflowConfigPanel] = useState<
    null | "knowledgeBase" | "aiConfig" | "agentAssignment" | "timeSettings"
  >(null);

  const [workflowOverrideTimeZone, setWorkflowOverrideTimeZone] =
    useState<boolean>(false);
  const [workflowOverrideBusinessHours, setWorkflowOverrideBusinessHours] =
    useState<boolean>(false);
  const [workflowTimeZoneDraft, setWorkflowTimeZoneDraft] = useState<string>(
    tenantBusinessTimeZone || getDetectedTimeZone()
  );
  const [workflowBusinessHoursDraft, setWorkflowBusinessHoursDraft] =
    useState<BusinessHoursConfig>(DEFAULT_BUSINESS_HOURS);
  const [workflowAfterHoursMode, setWorkflowAfterHoursMode] =
    useState<string>("USE_ORG");
  const [workflowAfterHoursMessage, setWorkflowAfterHoursMessage] =
    useState<string>("");
  const [workflowAfterHoursWorkflowId, setWorkflowAfterHoursWorkflowId] =
    useState<string | null>(null);
  const [savingTimeSettings, setSavingTimeSettings] = useState(false);

  const configCategory = COMPONENT_LIBRARY.find(
    (c) => c.category === CONFIG_CATEGORY_NAME
  );
  const workflowConfigItems = configCategory?.items ?? [];

  // Filter integrations to only show connected ones
  const componentLibraryNonConfig = COMPONENT_LIBRARY.filter(
    (c) => c.category !== CONFIG_CATEGORY_NAME
  ).map((category) => {
    if (category.category === "Available Integrations") {
      console.log(
        "[Workflows] Filtering integrations. connectedIntegrations:",
        connectedIntegrations
      );

      return {
        ...category,
        items: category.items.filter((item: any) => {
          // If item has a provider property, check if it's connected
          if (item.provider) {
            const isConnected = connectedIntegrations.some(
              (i) =>
                String(i.provider || "").toLowerCase() ===
                String(item.provider || "").toLowerCase()
            );
            console.log(
              `[Workflows] ${item.label} (${item.provider}) is connected:`,
              isConnected
            );
            return isConnected;
          }
          // For items without provider (future integrations), hide for now
          return false;
        }),
      };
    }
    return category;
  });

  // Interaction State
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeSimNodeId, setActiveSimNodeId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<{
    state: "idle" | "running" | "success" | "error";
    message?: string;
  }>({ state: "idle" });
  const simulationStatusResetTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const lastSavedSnapshotRef = useRef<string>("");

  useEffect(() => {
    return () => {
      if (simulationStatusResetTimeoutRef.current) {
        clearTimeout(simulationStatusResetTimeoutRef.current);
        simulationStatusResetTimeoutRef.current = null;
      }
    };
  }, []);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const buildWorkflowSnapshot = (
    workflowMeta: Workflow | null,
    snapshotNodes: WorkflowNode[],
    snapshotEdges: WorkflowEdge[]
  ) => {
    const normalizedNodes = [...snapshotNodes]
      .map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        x: n.x,
        y: n.y,
        config: (n as any).config ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const normalizedEdges = [...snapshotEdges]
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label ?? "",
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return JSON.stringify({
      workflowId: workflowMeta?.id ?? null,
      meta: {
        name: workflowMeta?.name ?? "",
        description: (workflowMeta as any)?.description ?? "",
      },
      nodes: normalizedNodes,
      edges: normalizedEdges,
    });
  };

  useEffect(() => {
    if (!selectedWorkflowMeta?.id) {
      setIsDirty(false);
      return;
    }

    const currentSnapshot = buildWorkflowSnapshot(
      selectedWorkflowMeta,
      nodes,
      edges
    );
    const dirty = currentSnapshot !== lastSavedSnapshotRef.current;
    setIsDirty(dirty);

    if (dirty && simulationStatus.state !== "idle") {
      setSimulationStatus({ state: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedWorkflowMeta?.id,
    selectedWorkflowMeta?.name,
    (selectedWorkflowMeta as any)?.description,
    nodes,
    edges,
  ]);

  // Dragging Nodes
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connecting Nodes
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(
    null
  );
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Canvas zoom
  const [canvasScale, setCanvasScale] = useState(1);
  const CANVAS_SCALE_MIN = 0.5;
  const CANVAS_SCALE_MAX = 1.5;
  const CANVAS_SCALE_STEP = 0.1;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const setCanvasScaleClamped = (next: number) => {
    const snapped = Math.round(next / CANVAS_SCALE_STEP) * CANVAS_SCALE_STEP;
    setCanvasScale(clamp(snapped, CANVAS_SCALE_MIN, CANVAS_SCALE_MAX));
  };

  const getCanvasPointFromClient = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const bounds = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - bounds.left) / canvasScale,
      y: (clientY - bounds.top) / canvasScale,
    };
  };

  const [ownedNumbers, setOwnedNumbers] = useState<PhoneNumber[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(
    null
  );
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [workflowResources, setWorkflowResources] = useState<any>({
    phoneNumbers: [],
    documents: [],
    integrations: [],
    aiConfig: null,
    toneOfVoice: null,
    assignedAgent: null,
    businessTimeZone: null,
    businessHours: null,
  });
  const [availableDocuments, setAvailableDocuments] = useState<any[]>([]);
  const [availableIntegrations, setAvailableIntegrations] = useState<any[]>([]);
  const [availableAiConfigs, setAvailableAiConfigs] = useState<any[]>([]);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [availableCallGroups, setAvailableCallGroups] = useState<any[]>([]);
  const [availablePhoneVoices, setAvailablePhoneVoices] = useState<
    PhoneVoiceOption[]
  >([]);
  const [planLimits, setPlanLimits] = useState<any>({
    maxPhoneNumbersPerWorkflow: 2,
    maxDocumentsPerWorkflow: 10,
    maxIntegrationsPerWorkflow: 3,
  });
  const [isGeneratingGreeting, setIsGeneratingGreeting] = useState(false);
  const [workflowSaveState, setWorkflowSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const saveStateResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    const fetchNumbers = async () => {
      try {
        const numbers = await api.phoneNumbers.list();
        setOwnedNumbers(numbers);
      } catch (error) {
        console.error("Failed to fetch numbers for workflow:", error);
      }
    };
    fetchNumbers();
  }, []);

  useEffect(() => {
    const fetchPhoneVoices = async () => {
      try {
        const response = await api.voiceConfig.getVoices();
        setAvailablePhoneVoices(
          Array.isArray(response?.voices) ? response.voices : []
        );
      } catch (error) {
        console.error("Failed to fetch phone voices:", error);
      }
    };
    fetchPhoneVoices();
  }, []);

  useEffect(() => {
    if (selectedWorkflowMeta?.id) {
      loadWorkflowResources();
      loadAvailableResources();
    }
  }, [selectedWorkflowMeta?.id]);

  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  useEffect(() => {
    const controller = new AbortController();

    const fetchGmailSender = async () => {
      if (!selectedNode || selectedNode.label !== "Send Gmail") {
        setGmailSenderStatus({ state: "idle" });
        return;
      }

      setGmailSenderStatus({ state: "loading" });
      try {
        const response = await fetch(
          `${API_URL}/integrations/google/gmail/profile`,
          {
            headers: authHeader(),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          setGmailSenderStatus({ state: "error" });
          return;
        }

        const data = await response.json();
        if (data?.connected && data?.email) {
          setGmailSenderStatus({ state: "loaded", email: data.email });
        } else {
          setGmailSenderStatus({ state: "error" });
        }
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        setGmailSenderStatus({ state: "error" });
      }
    };

    fetchGmailSender();

    return () => controller.abort();
  }, [selectedNodeId, selectedNode?.label]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchConferenceSolutions = async () => {
      if (!selectedNode || selectedNode.label !== "Create Calendar Event") {
        setCalendarConferenceStatus({ state: "idle" });
        return;
      }

      setCalendarConferenceStatus({ state: "loading" });
      try {
        const response = await fetch(
          `${API_URL}/integrations/google/calendar/conference-solutions`,
          {
            headers: authHeader(),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          setCalendarConferenceStatus({ state: "error" });
          return;
        }

        const data = await response.json();
        const allowedTypes = Array.isArray(data?.allowedConferenceSolutionTypes)
          ? data.allowedConferenceSolutionTypes
          : [];
        setCalendarConferenceStatus({
          state: "loaded",
          connected: Boolean(data?.connected),
          allowedTypes,
        });
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        setCalendarConferenceStatus({ state: "error" });
      }
    };

    fetchConferenceSolutions();

    return () => controller.abort();
  }, [selectedNodeId, selectedNode?.label]);

  // --- Resource Management Functions ---

  const loadWorkflowResources = async () => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/resources`,
        {
          headers: authHeader(),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setWorkflowResources(data);
      }
    } catch (error) {
      console.error("Failed to load workflow resources:", error);
    }
  };

  const loadAvailableResources = async () => {
    try {
      // Load documents
      const docsResponse = await fetch(`${API_URL}/knowledge-base`, {
        headers: authHeader(),
      });
      if (docsResponse.ok) {
        const docs = await docsResponse.json();
        setAvailableDocuments(docs);
      }

      // Load integrations
      // const integrationsResponse = await fetch(`${API_URL}/integrations`, {
      //   headers: authHeader(),
      // });
      // if (integrationsResponse.ok) {
      //   const integrations = await integrationsResponse.json();
      //   setAvailableIntegrations(integrations);
      // }

      // Load AI configs
      const aiConfigsResponse = await fetch(`${API_URL}/ai-config`, {
        headers: authHeader(),
      });
      if (aiConfigsResponse.ok) {
        const config = await aiConfigsResponse.json();
        // The endpoint returns a single config, wrap it in an array
        setAvailableAiConfigs(config ? [config] : []);
      }

      // Load assignable users (admins + agents; excludes customers)
      const agentsResponse = await fetch(`${API_URL}/team-members`, {
        headers: authHeader(),
      });
      if (agentsResponse.ok) {
        const agents = await agentsResponse.json();
        setAvailableAgents(Array.isArray(agents) ? agents : []);
      }
      // Load call groups
      const callGroupsResponse = await fetch(`${API_URL}/call-groups`, {
        headers: authHeader(),
      });
      if (callGroupsResponse.ok) {
        const groups = await callGroupsResponse.json();
        setAvailableCallGroups(Array.isArray(groups) ? groups : []);
      }
    } catch (error) {
      console.error("Failed to load available resources:", error);
    }
  };

  const assignDocument = async (documentId: string) => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/documents/${documentId}`,
        {
          method: "POST",
          headers: authHeader(),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      } else {
        const error = await response.json();
        setAlertModal({
          isOpen: true,
          title: "Unable to assign document",
          message: error?.error || "Failed to assign document.",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Failed to assign document:", error);
    }
  };

  const removeDocument = async (documentId: string) => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/documents/${documentId}`,
        {
          method: "DELETE",
          headers: authHeader(),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      }
    } catch (error) {
      console.error("Failed to remove document:", error);
    }
  };

  const assignPhoneNumber = async (phoneNumberId: string) => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/phone-numbers/${phoneNumberId}`,
        {
          method: "POST",
          headers: authHeader(),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      } else {
        const error = await response.json();
        setAlertModal({
          isOpen: true,
          title: "Unable to assign phone number",
          message: error?.error || "Failed to assign phone number.",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Failed to assign phone number:", error);
    }
  };

  const removePhoneNumber = async (phoneNumberId: string) => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/phone-numbers/${phoneNumberId}`,
        {
          method: "DELETE",
          headers: authHeader(),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      }
    } catch (error) {
      console.error("Failed to remove phone number:", error);
    }
  };

  const setAiConfig = async (aiConfigId: string) => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/ai-config/${aiConfigId}`,
        {
          method: "PUT",
          headers: authHeader(),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      }
    } catch (error) {
      console.error("Failed to set AI config:", error);
    }
  };

  const removeAiConfig = async () => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/ai-config`,
        {
          method: "DELETE",
          headers: authHeader(),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      }
    } catch (error) {
      console.error("Failed to remove AI config:", error);
    }
  };

  const setWorkflowToneOfVoice = async (toneOfVoice: string) => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/tone-of-voice`,
        {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify({ toneOfVoice }),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      }
    } catch (error) {
      console.error("Failed to set workflow tone of voice:", error);
    }
  };

  const clearWorkflowToneOfVoice = async () => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/tone-of-voice`,
        {
          method: "DELETE",
          headers: authHeader(),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      }
    } catch (error) {
      console.error("Failed to clear workflow tone of voice:", error);
    }
  };

  const assignAgent = async (agentId: string | null) => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await api.workflows.update(selectedWorkflowMeta.id, {
        assignedAgentId: agentId,
      });
      await loadWorkflows();
      await loadWorkflowResources();
    } catch (error) {
      console.error("Failed to assign agent:", error);
    }
  };

  const removeAgent = async () => {
    await assignAgent(null);
  };

  const getWorkflowConfigPanelKey = (
    label: string
  ): "knowledgeBase" | "aiConfig" | "agentAssignment" | "timeSettings" => {
    if (label === "Knowledge Base") return "knowledgeBase";
    if (label === "Agent Assignment") return "agentAssignment";
    if (label === "Time Settings") return "timeSettings";
    return "aiConfig";
  };

  const saveWorkflowTimeSettings = async () => {
    if (!selectedWorkflowMeta?.id) return;

    const payload = {
      businessTimeZone: workflowOverrideTimeZone
        ? String(workflowTimeZoneDraft || "").trim() || null
        : null,
      businessHours: workflowOverrideBusinessHours
        ? workflowBusinessHoursDraft
        : null,
      afterHoursMode:
        workflowAfterHoursMode === "USE_ORG" ? null : workflowAfterHoursMode,
      afterHoursMessage:
        workflowAfterHoursMode === "CUSTOM_VOICEMAIL"
          ? String(workflowAfterHoursMessage || "").trim() || null
          : null,
      afterHoursWorkflowId:
        workflowAfterHoursMode === "REDIRECT_WORKFLOW"
          ? workflowAfterHoursWorkflowId
          : null,
    };

    setSavingTimeSettings(true);
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/time-settings`,
        {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setAlertModal({
          isOpen: true,
          title: "Save failed",
          message: err?.error || "Failed to save workflow time settings.",
          type: "error",
        });
        return;
      }

      await loadWorkflowResources();
      setAlertModal({
        isOpen: true,
        title: "Saved",
        message: "Workflow time settings updated.",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to save workflow time settings", error);
      setAlertModal({
        isOpen: true,
        title: "Save failed",
        message: "Failed to save workflow time settings.",
        type: "error",
      });
    } finally {
      setSavingTimeSettings(false);
    }
  };

  const clearWorkflowTimeSettings = async () => {
    if (!selectedWorkflowMeta?.id) return;
    setSavingTimeSettings(true);
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/time-settings`,
        {
          method: "DELETE",
          headers: authHeader(),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setAlertModal({
          isOpen: true,
          title: "Clear failed",
          message: err?.error || "Failed to clear workflow time settings.",
          type: "error",
        });
        return;
      }

      await loadWorkflowResources();
      setAlertModal({
        isOpen: true,
        title: "Cleared",
        message:
          "Workflow time settings cleared (using organization settings).",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to clear workflow time settings", error);
      setAlertModal({
        isOpen: true,
        title: "Clear failed",
        message: "Failed to clear workflow time settings.",
        type: "error",
      });
    } finally {
      setSavingTimeSettings(false);
    }
  };

  useEffect(() => {
    const tz = String(workflowResources?.businessTimeZone || "").trim();
    const hasTzOverride = Boolean(tz);
    setWorkflowOverrideTimeZone(hasTzOverride);
    setWorkflowTimeZoneDraft(
      tz || tenantBusinessTimeZone || getDetectedTimeZone()
    );

    const hasHoursOverride = Boolean(workflowResources?.businessHours);
    setWorkflowOverrideBusinessHours(hasHoursOverride);
    const baseHours = hasHoursOverride
      ? workflowResources.businessHours
      : tenantBusinessHours;
    setWorkflowBusinessHoursDraft(normalizeBusinessHoursConfig(baseHours));

    // Load after-hours settings
    const afterHoursMode = String(
      workflowResources?.afterHoursMode || ""
    ).trim();
    setWorkflowAfterHoursMode(afterHoursMode || "USE_ORG");
    setWorkflowAfterHoursMessage(
      String(workflowResources?.afterHoursMessage || "").trim()
    );
    setWorkflowAfterHoursWorkflowId(
      workflowResources?.afterHoursWorkflowId || null
    );
  }, [
    workflowResources?.businessTimeZone,
    workflowResources?.businessHours,
    workflowResources?.afterHoursMode,
    workflowResources?.afterHoursMessage,
    workflowResources?.afterHoursWorkflowId,
    tenantBusinessTimeZone,
    tenantBusinessHours,
  ]);

  const stripConfigNodesFromGraph = (
    inputNodes: WorkflowNode[],
    inputEdges: WorkflowEdge[]
  ) => {
    const configNodeIds = new Set(
      inputNodes
        .filter(
          (n: any) =>
            n.type === "config" || CONFIG_NODE_LABELS.has(String(n.label))
        )
        .map((n) => n.id)
    );

    if (configNodeIds.size === 0) {
      return {
        nodes: inputNodes,
        edges: inputEdges,
        removedNodeIds: [] as string[],
      };
    }

    const remainingNodes = inputNodes.filter((n) => !configNodeIds.has(n.id));
    const incoming = inputEdges.filter((e) => configNodeIds.has(e.target));
    const outgoing = inputEdges.filter((e) => configNodeIds.has(e.source));

    // Remove all edges touching config nodes
    const remainingEdges = inputEdges.filter(
      (e) => !configNodeIds.has(e.source) && !configNodeIds.has(e.target)
    );

    // Reconnect: for each removed config node, connect its incoming -> outgoing
    const newEdges: WorkflowEdge[] = [];
    for (const removedId of Array.from(configNodeIds)) {
      const inEdges = incoming.filter((e) => e.target === removedId);
      const outEdges = outgoing.filter((e) => e.source === removedId);

      for (const inE of inEdges) {
        for (const outE of outEdges) {
          const source = inE.source;
          const target = outE.target;
          if (!source || !target || source === target) continue;

          const label = (outE as any).label ?? (inE as any).label ?? undefined;
          const id = `e-${source}-${target}`;

          const alreadyExists =
            remainingEdges.some(
              (e) => e.source === source && e.target === target
            ) ||
            newEdges.some((e) => e.source === source && e.target === target);

          if (!alreadyExists) {
            newEdges.push({ id, source, target, label });
          }
        }
      }
    }

    return {
      nodes: remainingNodes,
      edges: [...remainingEdges, ...newEdges],
      removedNodeIds: Array.from(configNodeIds),
    };
  };

  // --- Logic ---

  const handleEdit = (workflow: Workflow) => {
    setSelectedWorkflowMeta(workflow);
    lastSavedSnapshotRef.current = buildWorkflowSnapshot(
      workflow,
      workflow.nodes || [],
      workflow.edges || []
    );
    setIsDirty(false);
    // Deep copy to separate builder state from mock data
    {
      const copiedNodes = JSON.parse(JSON.stringify(workflow.nodes || []));
      const copiedEdges = JSON.parse(JSON.stringify(workflow.edges || []));
      const stripped = stripConfigNodesFromGraph(copiedNodes, copiedEdges);
      setNodes(stripped.nodes);
      setEdges(stripped.edges);
      if (stripped.removedNodeIds.length > 0) {
        console.warn(
          "[Workflows] Removed deprecated config node(s) from canvas:",
          stripped.removedNodeIds
        );
      }
    }
    setView("builder");
    setIsSimulating(false);
    setActiveSimNodeId(null);
    setSimulationStatus({ state: "idle" });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setShowMobileLibrary(false);
    setActiveWorkflowConfigPanel(null);
  };

  const handleNewWorkflow = async () => {
    try {
      const newWorkflow = await api.workflows.create({
        name: "Untitled Workflow",
        description: "New workflow description",
        triggerType: "Manual",
      });
      setSelectedWorkflowMeta(newWorkflow);
      lastSavedSnapshotRef.current = buildWorkflowSnapshot(newWorkflow, [], []);
      setIsDirty(false);
      setNodes([]);
      setEdges([]);
      setView("builder");
      setIsSimulating(false);
      setActiveSimNodeId(null);
      setSimulationStatus({ state: "idle" });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setShowMobileLibrary(false);
      setActiveWorkflowConfigPanel(null);
      loadWorkflows();
    } catch (error) {
      console.error("Failed to create workflow:", error);
    }
  };

  const handleSave = async () => {
    if (!selectedWorkflowMeta) return;

    if (workflowSaveState === "saving") return;

    const strippedForSave = stripConfigNodesFromGraph(nodes, edges);
    if (
      strippedForSave.nodes.length !== nodes.length ||
      strippedForSave.edges.length !== edges.length
    ) {
      setNodes(strippedForSave.nodes);
      setEdges(strippedForSave.edges);
    }

    const nodesToSave = strippedForSave.nodes;
    const edgesToSave = strippedForSave.edges;

    // Check for Send Email validation
    const invalidSendEmailNodes = nodesToSave
      .filter((n) => n.label === "Send Email")
      .map((n) => ({ nodeId: n.id, missing: getMissingSendEmailFields(n) }))
      .filter((x) => x.missing.length > 0);
    if (invalidSendEmailNodes.length > 0) {
      const details = invalidSendEmailNodes
        .map((x) => `${x.nodeId}: ${x.missing.join(", ")}`)
        .join(" | ");
      setAlertModal({
        isOpen: true,
        title: "Send Email node is incomplete",
        message: `Fill Recipient Email, Subject Line, and Email Body before saving. Missing: ${details}`,
        type: "error",
      });
      return;
    }

    // Check for End Call requirement in Incoming Call workflows
    const triggerNode = nodesToSave.find((n) => n.type === "trigger");
    const isIncomingCallWorkflow = triggerNode?.label === "Incoming Call";

    if (isIncomingCallWorkflow) {
      const hasEndCallNode = nodesToSave.some((n) => n.label === "End Call");
      if (!hasEndCallNode) {
        setAlertModal({
          isOpen: true,
          title: "Missing End Call Node",
          message:
            "Incoming Call workflows must include an 'End Call' node to properly terminate the call. Please add an 'End Call' node to your workflow.",
          type: "error",
        });
        return;
      }
    }

    if (saveStateResetTimeoutRef.current) {
      clearTimeout(saveStateResetTimeoutRef.current);
      saveStateResetTimeoutRef.current = null;
    }

    setWorkflowSaveState("saving");

    // Infer trigger type from the canvas
    const triggerType = triggerNode ? triggerNode.label : "Manual";

    console.log(
      "[Workflows] Saving edges:",
      JSON.stringify(edgesToSave, null, 2)
    );

    const snapshotAtSave = buildWorkflowSnapshot(
      selectedWorkflowMeta,
      nodesToSave,
      edgesToSave
    );

    try {
      await api.workflows.update(selectedWorkflowMeta.id, {
        ...selectedWorkflowMeta,
        nodes: nodesToSave,
        edges: edgesToSave,
        triggerType,
        isActive: true, // Auto-activate for now so testing works immediately
      });
      await loadWorkflows();
      // Don't close the workflow editor after saving

      setWorkflowSaveState("saved");
      lastSavedSnapshotRef.current = snapshotAtSave;
      setIsDirty(false);
      saveStateResetTimeoutRef.current = setTimeout(() => {
        setWorkflowSaveState("idle");
        saveStateResetTimeoutRef.current = null;
      }, 1500);
    } catch (error) {
      console.error("Failed to save workflow:", error);
      setWorkflowSaveState("error");
      saveStateResetTimeoutRef.current = setTimeout(() => {
        setWorkflowSaveState("idle");
        saveStateResetTimeoutRef.current = null;
      }, 2000);
    }
  };

  const handleDeleteWorkflowClick = (workflow: Workflow) => {
    setWorkflowToDelete(workflow);
    setShowDeleteModal(true);
  };

  const handleDeleteWorkflowConfirm = async () => {
    if (!workflowToDelete) return;

    try {
      await api.workflows.delete(workflowToDelete.id);
      await loadWorkflows();
      setShowDeleteModal(false);
      setWorkflowToDelete(null);

      // If we're in builder view with this workflow, go back to list
      if (selectedWorkflowMeta?.id === workflowToDelete.id) {
        setView("list");
        setSelectedWorkflowMeta(null);
      }
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      setAlertModal({
        isOpen: true,
        title: "Delete failed",
        message: "Failed to delete workflow. Please try again.",
        type: "error",
      });
    }
  };

  const handleDeleteWorkflowCancel = () => {
    setShowDeleteModal(false);
    setWorkflowToDelete(null);
  };

  const handleEditLabels = (workflow: Workflow) => {
    setEditingWorkflowId(workflow.id);
    setEditingLabels(workflow.labels || []);
    setNewLabel("");
    setShowLabelModal(true);
  };

  const handleAddLabel = () => {
    const trimmed = newLabel.trim();
    if (trimmed && !editingLabels.includes(trimmed)) {
      setEditingLabels([...editingLabels, trimmed]);
      setNewLabel("");
    }
  };

  const handleRemoveLabel = (label: string) => {
    setEditingLabels(editingLabels.filter((l) => l !== label));
  };

  const handleSaveLabels = async () => {
    if (!editingWorkflowId) return;

    try {
      const workflow = workflows.find((w) => w.id === editingWorkflowId);
      if (!workflow) return;

      await api.workflows.update(editingWorkflowId, {
        ...workflow,
        labels: editingLabels,
      });

      await loadWorkflows();
      setShowLabelModal(false);
      setEditingWorkflowId(null);
      setEditingLabels([]);
    } catch (error) {
      console.error("Failed to save labels:", error);
      setAlertModal({
        isOpen: true,
        title: "Save failed",
        message: "Failed to save labels. Please try again.",
        type: "error",
      });
    }
  };

  const getAllLabels = (): string[] => {
    const labelSet = new Set<string>();
    workflows.forEach((wf) => {
      (wf.labels || []).forEach((label) => labelSet.add(label));
    });
    return Array.from(labelSet).sort();
  };

  const filteredWorkflows = filterLabel
    ? workflows.filter((wf) => (wf.labels || []).includes(filterLabel))
    : workflows;

  const generateGreeting = async (nodeId: string) => {
    setIsGeneratingGreeting(true);
    try {
      // Fetch the tenant's AI config
      const response = await fetch(`${API_URL}/ai-config`, {
        headers: authHeader(),
      });

      if (!response.ok) throw new Error("Failed to fetch AI config");

      const aiConfig = await response.json();
      const agentName = aiConfig.name || "Flo";
      const businessDescription = aiConfig.businessDescription || "our company";

      // Generate greeting using AI
      const greetingResponse = await fetch(`${API_URL}/ai/generate-greeting`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          agentName,
          businessDescription,
        }),
      });

      if (!greetingResponse.ok) {
        // Fallback: create a simple greeting if API fails
        const fallbackGreeting = `Hello! Thank you for calling ${businessDescription}. This is ${agentName}, your AI assistant. How may I help you today?`;
        updateNode(nodeId, {
          config: {
            ...nodes.find((n) => n.id === nodeId)?.config,
            greeting: fallbackGreeting,
          },
        });
        return;
      }

      const { greeting } = await greetingResponse.json();

      // Update the node with the generated greeting
      updateNode(nodeId, {
        config: {
          ...nodes.find((n) => n.id === nodeId)?.config,
          greeting,
        },
      });
    } catch (error) {
      console.error("Failed to generate greeting:", error);
      // Fallback greeting on error
      const fallbackGreeting =
        "Hello! Thank you for calling. How may I assist you today?";
      updateNode(nodeId, {
        config: {
          ...nodes.find((n) => n.id === nodeId)?.config,
          greeting: fallbackGreeting,
        },
      });
    } finally {
      setIsGeneratingGreeting(false);
    }
  };

  const handleSimulate = async () => {
    if (isSimulating || nodes.length === 0) return;

    const invalidSendEmailNodes = nodes
      .filter((n) => n.label === "Send Email")
      .map((n) => ({ nodeId: n.id, missing: getMissingSendEmailFields(n) }))
      .filter((x) => x.missing.length > 0);
    if (invalidSendEmailNodes.length > 0) {
      const details = invalidSendEmailNodes
        .map((x) => `${x.nodeId}: ${x.missing.join(", ")}`)
        .join(" | ");
      setAlertModal({
        isOpen: true,
        title: "Cannot test flow",
        message: `Send Email node is missing required fields. Missing: ${details}`,
        type: "error",
      });
      return;
    }

    // Check if there are unsaved changes
    if (isDirty) {
      setShowUnsavedChangesModal(true);
      return;
    }

    executeSimulation();
  };

  const executeSimulation = async () => {
    setIsSimulating(true);
    setActiveSimNodeId(null);
    if (simulationStatusResetTimeoutRef.current) {
      clearTimeout(simulationStatusResetTimeoutRef.current);
      simulationStatusResetTimeoutRef.current = null;
    }
    setSimulationStatus({ state: "running", message: "Running" });

    // Trigger backend simulation
    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (!triggerNode) {
      setIsSimulating(false);
      setActiveSimNodeId(null);
      setSimulationStatus({ state: "error", message: "No trigger node found" });
      return;
    }
    if (triggerNode) {
      api.workflows
        .simulate(triggerNode.label, { source: "simulator" })
        .catch((err) => {
          console.error(err);
          setSimulationStatus({
            state: "error",
            message: "Backend simulation failed",
          });
        });
    }

    // Visual simulation: highlight nodes as they would execute
    let currentNodeId = triggerNode?.id || nodes[0]?.id;
    let visitedNodes = new Set<string>();
    const maxSteps = 20; // Prevent infinite loops
    let step = 0;

    const executeStep = () => {
      if (!currentNodeId) {
        setIsSimulating(false);
        setActiveSimNodeId(null);
        setSimulationStatus({ state: "error", message: "Simulation halted" });
        return;
      }

      if (visitedNodes.has(currentNodeId)) {
        setIsSimulating(false);
        setActiveSimNodeId(null);
        setSimulationStatus({ state: "error", message: "Loop detected" });
        return;
      }

      if (step >= maxSteps) {
        setIsSimulating(false);
        setActiveSimNodeId(null);
        setSimulationStatus({ state: "error", message: "Max steps reached" });
        return;
      }

      const currentNode = nodes.find((n) => n.id === currentNodeId);
      if (!currentNode) {
        setIsSimulating(false);
        setActiveSimNodeId(null);
        setSimulationStatus({ state: "error", message: "Node not found" });
        return;
      }

      visitedNodes.add(currentNodeId);
      setActiveSimNodeId(currentNodeId);
      step++;

      // Find next node based on edges
      const outgoingEdges = edges.filter((e) => e.source === currentNodeId);

      setTimeout(() => {
        if (outgoingEdges.length > 0) {
          // For condition nodes, show both paths briefly
          if (currentNode?.type === "condition" && outgoingEdges.length > 1) {
            // Highlight all outgoing edges briefly
            currentNodeId = outgoingEdges[0].target;
          } else {
            currentNodeId = outgoingEdges[0].target;
          }
          executeStep();
        } else {
          // End of workflow
          setTimeout(() => {
            setIsSimulating(false);
            setActiveSimNodeId(null);
            setSimulationStatus({ state: "success", message: "Completed" });

            simulationStatusResetTimeoutRef.current = setTimeout(() => {
              setSimulationStatus((prev) =>
                prev.state === "success" ? { state: "idle" } : prev
              );
              simulationStatusResetTimeoutRef.current = null;
            }, 3000);
          }, 1000);
        }
      }, 800);
    };

    executeStep();
  };

  const handleUnsavedChangesConfirm = () => {
    setShowUnsavedChangesModal(false);
    executeSimulation();
  };

  const handleUnsavedChangesCancel = () => {
    setShowUnsavedChangesModal(false);
  };

  // --- Drag and Drop (Sidebar -> Canvas) ---

  const handleDragStart = (e: React.DragEvent, item: any) => {
    if (
      item?.type === "config" ||
      CONFIG_NODE_LABELS.has(String(item?.label))
    ) {
      // Configuration is managed as workflow-level resources, not canvas nodes.
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/reactflow", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    if (!canvasRef.current) return;

    const itemData = e.dataTransfer.getData("application/reactflow");

    if (!itemData) return;

    const item = JSON.parse(itemData);

    // Configuration items are workflow-level resources and cannot be added as nodes.
    if (
      item?.type === "config" ||
      CONFIG_NODE_LABELS.has(String(item?.label))
    ) {
      setAlertModal({
        isOpen: true,
        title: "Workflow configuration",
        message:
          "Knowledge Base and AI Configuration are persistent workflow settings. Use the Configuration section in the sidebar instead of adding them to the canvas.",
        type: "info",
      });
      return;
    }

    const p = getCanvasPointFromClient(e.clientX, e.clientY);

    // Calculate position relative to canvas (unscaled coordinates)
    const position = {
      x: p.x - 128, // Center the node (width 256/2)
      y: p.y - 20, // Offset slightly
    };

    const newNode: WorkflowNode = {
      id: generateId(),
      type: item.type,
      label: item.label,
      subLabel: item.subLabel,
      icon: item.iconUrl, // Use iconUrl if dragging an integration
      x: position.x,
      y: position.y,
      config: {}, // Initialize config
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
  };

  // --- Node Dragging ---

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation(); // Prevent canvas click
    setActiveWorkflowConfigPanel(null);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setIsDraggingNode(true);
    setDraggedNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null); // Deselect edge when clicking node

    // Calculate offset so we drag from the point clicked (unscaled coordinates)
    const p = getCanvasPointFromClient(e.clientX, e.clientY);
    setDragOffset({ x: p.x - node.x, y: p.y - node.y });
  };

  // --- Connections ---

  const handlePortMouseDown = (
    e: React.MouseEvent,
    nodeId: string,
    type: "source" | "target"
  ) => {
    e.stopPropagation();
    if (type === "source") {
      setConnectingSourceId(nodeId);

      // Initial mouse pos for the temp line (unscaled coordinates)
      const p = getCanvasPointFromClient(e.clientX, e.clientY);
      setMousePos({ x: p.x, y: p.y });
    } else if (type === "target" && connectingSourceId) {
      // Complete the connection
      if (connectingSourceId === nodeId) return; // No self-loops

      // Check if edge already exists
      const exists = edges.find(
        (edge) => edge.source === connectingSourceId && edge.target === nodeId
      );
      if (!exists) {
        // Auto-suggest label for edges from Condition nodes
        const sourceNode = nodes.find((n) => n.id === connectingSourceId);
        const existingEdgesFromSource = edges.filter(
          (e) => e.source === connectingSourceId
        );

        let suggestedLabel = undefined;
        if (sourceNode?.type === "condition") {
          // Suggest "yes" for first edge, "no" for second
          suggestedLabel = existingEdgesFromSource.length === 0 ? "yes" : "no";
        }

        const newEdge: WorkflowEdge = {
          id: `e-${connectingSourceId}-${nodeId}`,
          source: connectingSourceId,
          target: nodeId,
          label: suggestedLabel,
        };
        setEdges((es) => [...es, newEdge]);
      }
      setConnectingSourceId(null);
    }
  };

  // --- Node Updates via Sidebar ---
  const updateNode = (id: string, updates: Partial<WorkflowNode>) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const updateEdge = (id: string, updates: Partial<WorkflowEdge>) => {
    console.log(`[Workflows] updateEdge called: id=${id}, updates=`, updates);
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  // --- Global Canvas Mouse Events ---

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const p = getCanvasPointFromClient(e.clientX, e.clientY);
    const x = p.x;
    const y = p.y;

    if (isDraggingNode && draggedNodeId) {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === draggedNodeId) {
            return {
              ...node,
              x: x - dragOffset.x,
              y: y - dragOffset.y,
            };
          }
          return node;
        })
      );
    }

    if (connectingSourceId) {
      setMousePos({ x, y });
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    setIsDraggingNode(false);
    setDraggedNodeId(null);

    // If we were connecting and let go over nothing, cancel connection
    if (connectingSourceId) {
      setConnectingSourceId(null);
    }
  };

  // Allow connecting by releasing mouse over target port
  const handlePortMouseUp = (e: React.MouseEvent, nodeId: string) => {
    if (connectingSourceId && connectingSourceId !== nodeId) {
      const exists = edges.find(
        (edge) => edge.source === connectingSourceId && edge.target === nodeId
      );
      if (!exists) {
        setEdges((es) => [
          ...es,
          {
            id: `e-${connectingSourceId}-${nodeId}`,
            source: connectingSourceId,
            target: nodeId,
          },
        ]);
      }
      setConnectingSourceId(null);
    }
  };

  const handleEdgeClick = (e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    setActiveWorkflowConfigPanel(null);
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  };

  // --- Deletion ---

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleDeleteEdge = (edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
  };

  // Handle Delete key for both nodes and edges
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only delete if not typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          handleDeleteNode(selectedNodeId);
        }
        if (selectedEdgeId) {
          handleDeleteEdge(selectedEdgeId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, selectedEdgeId]);

  // --- Render Helpers ---

  const getConnectorPoint = (nodeId: string, type: "top" | "bottom") => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    return {
      x: node.x + 128,
      y: type === "top" ? node.y : node.y + 70, // Approximate height of node
    };
  };

  return (
    <div className="flex-1 bg-slate-50 h-full flex flex-col overflow-hidden">
      {view === "list" ? (
        <div className="p-8 overflow-y-auto h-full">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
                <p className="text-slate-500 mt-1">
                  Automate agent tasks and AI responses with visual flows.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={filterLabel}
                  onChange={(e) => setFilterLabel(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">All Labels</option>
                  {getAllLabels().map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleNewWorkflow}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
                >
                  <Plus size={18} /> New Workflow
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredWorkflows.map((wf) => (
                <div
                  key={wf.id}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        wf.isActive
                          ? "bg-green-50 text-green-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <Layout size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">
                        {wf.name}
                      </h3>
                      <p className="text-sm text-slate-500">{wf.description}</p>
                      {wf.labels && wf.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {wf.labels.map((label) => (
                            <span
                              key={label}
                              className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        {wf.createdAt && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> Created{" "}
                            {new Date(wf.createdAt).toLocaleDateString()}
                          </span>
                        )}
                        {wf.updatedAt && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> Edited{" "}
                            {new Date(wf.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEditLabels(wf)}
                      className="px-3 py-2 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
                      title="Manage labels"
                    >
                      <Tag size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(wf)}
                      className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      Open Builder
                    </button>
                    <button
                      onClick={() => handleDeleteWorkflowClick(wf)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                      title="Delete workflow"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // BUILDER VIEW
        <div className="flex-1 flex flex-col h-full relative">
          {/* Builder Header */}
          <div className="border-b border-slate-200 bg-white px-3 sm:px-6 py-2 sm:py-0 sm:h-16 flex items-center justify-between shrink-0 z-10 relative shadow-sm">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => setView("list")}
                className="text-slate-500 hover:text-slate-800 font-medium text-sm flex items-center gap-1"
              >
                <ArrowRight className="rotate-180" size={16} /> Back
              </button>
              <div className="h-6 w-px bg-slate-200"></div>
              <input
                type="text"
                value={selectedWorkflowMeta?.name || ""}
                onChange={(e) =>
                  setSelectedWorkflowMeta((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                className="font-bold text-base sm:text-lg text-slate-800 border-none focus:ring-0 bg-transparent placeholder-slate-400 hover:bg-slate-50 rounded px-2 -ml-2 transition-colors w-36 sm:w-auto min-w-0 truncate"
                placeholder="Workflow Name"
              />
              <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-bold rounded border border-green-100">
                Active
              </span>

              <button
                onClick={() => setShowMobileLibrary(true)}
                className="md:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                aria-label="Open component library"
                type="button"
              >
                <Layout size={18} />
              </button>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSimulate}
                  disabled={isSimulating}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    isSimulating
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-ping" />{" "}
                      Running...
                    </>
                  ) : (
                    <>
                      <Play size={16} /> Test Flow
                    </>
                  )}
                </button>
                {simulationStatus.state !== "idle" && (
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-lg border ${
                      simulationStatus.state === "running"
                        ? "bg-slate-50 text-slate-600 border-slate-200"
                        : simulationStatus.state === "success"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {simulationStatus.state === "running"
                      ? "Running"
                      : simulationStatus.state === "success"
                      ? "Succeeded"
                      : "Failed"}
                    {simulationStatus.message
                      ? `: ${simulationStatus.message}`
                      : ""}
                  </span>
                )}
                {isDirty && (
                  <span className="text-xs text-amber-600 font-medium px-2">
                    Save first for accurate test
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={workflowSaveState === "saving"}
                  className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    workflowSaveState === "saving"
                      ? "border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed"
                      : workflowSaveState === "saved"
                      ? "border-green-200 text-green-700 bg-green-50"
                      : workflowSaveState === "error"
                      ? "border-red-200 text-red-700 bg-red-50"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {workflowSaveState === "saving" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : workflowSaveState === "saved" ? (
                    <>
                      <Check size={16} className="animate-pulse" /> Saved
                    </>
                  ) : workflowSaveState === "error" ? (
                    <>
                      <Save size={16} /> Save failed
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Changes
                    </>
                  )}
                </button>
              </div>
              <div className="text-xs text-slate-400 hidden md:block">
                <span className="font-semibold">Hint:</span> Drag nodes from
                sidebar. Click ports to connect. Del to remove.
              </div>
            </div>
          </div>

          {/* Mobile: Component Library Drawer */}
          {showMobileLibrary && (
            <div
              className="fixed inset-0 z-40 md:hidden"
              onClick={() => setShowMobileLibrary(false)}
            >
              <div className="absolute inset-0 bg-black/50" />
              <div
                className="absolute left-0 top-0 h-full w-[85vw] max-w-sm bg-white border-r border-slate-200 flex flex-col shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Component Library
                  </h3>
                  <button
                    onClick={() => setShowMobileLibrary(false)}
                    className="text-slate-400 hover:text-slate-600"
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Pinned: Workflow Configuration (non-draggable) */}
                  {workflowConfigItems.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Configuration
                      </h4>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Workflow-level settings (not draggable onto the canvas).
                      </p>
                      <div className="space-y-2">
                        {workflowConfigItems.map(
                          (item: any, itemIdx: number) => (
                            <button
                              key={itemIdx}
                              type="button"
                              onClick={() => {
                                setSelectedNodeId(null);
                                setSelectedEdgeId(null);
                                setActiveWorkflowConfigPanel(
                                  getWorkflowConfigPanelKey(item.label)
                                );
                                setShowMobileLibrary(false);
                              }}
                              className="w-full p-3 bg-white border border-slate-200 shadow-sm rounded-lg hover:border-indigo-400 hover:shadow-md transition-all flex items-center gap-3"
                            >
                              <div
                                className={`p-1.5 rounded-md ${
                                  configCategory?.bg || "bg-blue-50"
                                } ${
                                  configCategory?.color || "text-blue-500"
                                } w-8 h-8 flex items-center justify-center`}
                              >
                                <item.icon size={16} />
                              </div>
                              <div className="text-left">
                                <span className="text-sm font-semibold text-slate-700 block leading-tight">
                                  {item.label}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {item.subLabel}
                                </span>
                              </div>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {componentLibraryNonConfig.map((category, idx) => (
                    <div key={idx}>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 pl-1">
                        {category.category}
                      </h4>
                      <div className="space-y-2">
                        {category.items.map((item: any, itemIdx: number) => (
                          <div
                            key={itemIdx}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                            onDragEnd={() => setShowMobileLibrary(false)}
                            className="p-3 bg-white border border-slate-200 shadow-sm rounded-lg cursor-grab hover:border-indigo-400 hover:shadow-md transition-all flex items-center gap-3 group active:cursor-grabbing"
                          >
                            <div
                              className={`p-1.5 rounded-md ${category.bg} ${category.color} w-8 h-8 flex items-center justify-center`}
                            >
                              {item.iconUrl ? (
                                <img
                                  src={item.iconUrl}
                                  alt=""
                                  className="w-5 h-5 object-contain"
                                />
                              ) : (
                                <item.icon size={16} />
                              )}
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-slate-700 block leading-tight">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {item.subLabel}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Components (Always Visible) */}
            <div
              className={`hidden md:flex bg-white border-r border-slate-200 flex-col shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-200 ${
                isLibraryCollapsed ? "w-16" : "w-64"
              }`}
            >
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3
                  className={`text-xs font-bold text-slate-400 uppercase tracking-wider ${
                    isLibraryCollapsed ? "hidden" : "block"
                  }`}
                >
                  Component Library
                </h3>
                <button
                  onClick={() => setIsLibraryCollapsed((v) => !v)}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                  type="button"
                  aria-label={
                    isLibraryCollapsed
                      ? "Expand component library"
                      : "Collapse component library"
                  }
                  title={
                    isLibraryCollapsed
                      ? "Expand component library"
                      : "Collapse component library"
                  }
                >
                  <Menu size={18} />
                </button>
              </div>
              <div
                className={`flex-1 overflow-y-auto space-y-6 ${
                  isLibraryCollapsed ? "p-2" : "p-4"
                }`}
              >
                {/* Pinned: Workflow Configuration (non-draggable) */}
                {workflowConfigItems.length > 0 && (
                  <div
                    className={`bg-slate-50 border border-slate-200 rounded-lg ${
                      isLibraryCollapsed ? "p-2" : "p-3"
                    }`}
                  >
                    {!isLibraryCollapsed && (
                      <>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Configuration
                        </h4>
                        <p className="text-[11px] text-slate-500 mb-3">
                          Workflow-level settings (not draggable).
                        </p>
                      </>
                    )}
                    <div className="space-y-2">
                      {workflowConfigItems.map((item: any, itemIdx: number) => (
                        <button
                          key={itemIdx}
                          type="button"
                          title={item.label}
                          onClick={() => {
                            setSelectedNodeId(null);
                            setSelectedEdgeId(null);
                            setActiveWorkflowConfigPanel(
                              getWorkflowConfigPanelKey(item.label)
                            );
                          }}
                          className={`w-full bg-white border border-slate-200 shadow-sm rounded-lg hover:border-indigo-400 hover:shadow-md transition-all flex items-center group ${
                            isLibraryCollapsed
                              ? "p-2 justify-center"
                              : "p-3 gap-3"
                          }`}
                        >
                          <div
                            className={`p-1.5 rounded-md ${
                              configCategory?.bg || "bg-blue-50"
                            } ${
                              configCategory?.color || "text-blue-500"
                            } w-8 h-8 flex items-center justify-center`}
                          >
                            <item.icon size={16} />
                          </div>
                          {!isLibraryCollapsed && (
                            <div>
                              <span className="text-sm font-semibold text-slate-700 block leading-tight">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {item.subLabel}
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {componentLibraryNonConfig.map((category, idx) => (
                  <div key={idx}>
                    {!isLibraryCollapsed && (
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 pl-1">
                        {category.category}
                      </h4>
                    )}
                    <div className="space-y-2">
                      {category.items.map((item: any, itemIdx: number) => (
                        <div
                          key={itemIdx}
                          draggable
                          onDragStart={(e) => handleDragStart(e, item)}
                          title={item.label}
                          className={`bg-white border border-slate-200 shadow-sm rounded-lg cursor-grab hover:border-indigo-400 hover:shadow-md transition-all flex items-center group active:cursor-grabbing ${
                            isLibraryCollapsed
                              ? "p-2 justify-center"
                              : "p-3 gap-3"
                          }`}
                        >
                          <div
                            className={`p-1.5 rounded-md ${category.bg} ${category.color} w-8 h-8 flex items-center justify-center`}
                          >
                            {item.iconUrl ? (
                              <img
                                src={item.iconUrl}
                                alt=""
                                className="w-5 h-5 object-contain"
                              />
                            ) : (
                              <item.icon size={16} />
                            )}
                          </div>
                          {!isLibraryCollapsed && (
                            <div>
                              <span className="text-sm font-semibold text-slate-700 block leading-tight">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {item.subLabel}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Canvas Area */}
            <div
              className="flex-1 bg-slate-50 relative overflow-auto cursor-default"
              ref={canvasRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                setActiveWorkflowConfigPanel(null);
              }}
            >
              {/* Scaled Content (Connections + Nodes + Grid) */}
              <div
                className="min-h-full min-w-full"
                style={{
                  transform: `scale(${canvasScale})`,
                  transformOrigin: "0 0",
                  backgroundImage:
                    "radial-gradient(#cbd5e1 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  width: "200%",
                  height: "200%",
                }}
              >
                {/* SVG Layer for Connections */}
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                    </marker>
                    <marker
                      id="arrowhead-selected"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                    </marker>
                  </defs>
                  {edges.map((edge) => {
                    // Logic to find coordinates
                    const start = getConnectorPoint(edge.source, "bottom");
                    const end = getConnectorPoint(edge.target, "top");
                    if (!start || !end) return null;
                    return (
                      <ConnectionLine
                        key={edge.id}
                        start={start}
                        end={end}
                        label={edge.label}
                        isSelected={selectedEdgeId === edge.id}
                        onClick={(e) => handleEdgeClick(e, edge.id)}
                        onDelete={() => handleDeleteEdge(edge.id)}
                      />
                    );
                  })}
                  {/* Temporary Line while dragging */}
                  {connectingSourceId && (
                    <line
                      x1={getConnectorPoint(connectingSourceId, "bottom").x}
                      y1={getConnectorPoint(connectingSourceId, "bottom").y}
                      x2={mousePos.x}
                      y2={mousePos.y}
                      stroke="#6366f1"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                  )}
                </svg>

                {/* Nodes Layer */}
                <div className="w-full h-full z-10">
                  {nodes.map((node) => (
                    <div
                      key={node.id}
                      onMouseUp={(e) => handlePortMouseUp(e, node.id)}
                    >
                      <Node
                        node={node}
                        isActive={activeSimNodeId === node.id}
                        isSelected={selectedNodeId === node.id}
                        onMouseDown={handleNodeMouseDown}
                        onPortMouseDown={handlePortMouseDown}
                        onDelete={handleDeleteNode}
                        ownedNumbers={ownedNumbers}
                      />
                    </div>
                  ))}
                </div>

                {/* Empty State Hint */}
                {nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                    <div className="text-center">
                      <MousePointer2
                        size={48}
                        className="mx-auto text-slate-400 mb-4"
                      />
                      <h3 className="text-xl font-bold text-slate-500">
                        Drag components here
                      </h3>
                      <p className="text-slate-400">
                        Start building your workflow
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="absolute bottom-8 right-8 flex gap-2 bg-white p-1.5 rounded-lg shadow-md border border-slate-200 z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCanvasScaleClamped(canvasScale - CANVAS_SCALE_STEP);
                  }}
                  disabled={canvasScale <= CANVAS_SCALE_MIN}
                  className="p-2 rounded hover:bg-slate-50 text-slate-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  -
                </button>
                <span className="px-2 py-2 text-xs font-bold text-slate-600 flex items-center">
                  {Math.round(canvasScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCanvasScaleClamped(canvasScale + CANVAS_SCALE_STEP);
                  }}
                  disabled={canvasScale >= CANVAS_SCALE_MAX}
                  className="p-2 rounded hover:bg-slate-50 text-slate-600 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  +
                </button>
              </div>
            </div>

            {/* Right Sidebar: Node Properties (Conditional) */}
            {!selectedEdgeId && activeWorkflowConfigPanel && (
              <div
                className="fixed inset-0 z-40 md:static md:z-auto md:inset-auto md:shrink-0 md:relative"
                style={{
                  width:
                    window.innerWidth >= 768 ? `${sidebarWidth}px` : undefined,
                }}
              >
                <div
                  className="absolute inset-0 bg-black/50 md:hidden"
                  onClick={() => setActiveWorkflowConfigPanel(null)}
                />

                {/* Resize Handle (desktop) - anchored to sidebar border */}
                <div
                  className="hidden md:block absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-[2000]"
                  onMouseDown={handleResizeStart}
                  onTouchStart={handleResizeStart}
                  title="Drag to resize panel"
                >
                  {/* Chrome-style splitter: thin line + subtle grip */}
                  <div className="absolute inset-y-0 left-0 w-px bg-slate-200" />
                  <div className="absolute top-1/2 -translate-y-1/2 left-0.5 w-2.5 h-12 bg-white border border-slate-300 rounded shadow-sm flex items-center justify-center">
                    <div className="flex flex-col gap-1">
                      <div className="w-0.5 h-0.5 bg-slate-400 rounded-full" />
                      <div className="w-0.5 h-0.5 bg-slate-400 rounded-full" />
                      <div className="w-0.5 h-0.5 bg-slate-400 rounded-full" />
                    </div>
                  </div>
                </div>

                <div
                  className="relative right-0 top-0 h-full w-[90vw] max-w-sm bg-white border-l border-slate-200 flex flex-col z-40 shadow-xl md:static md:h-full md:w-full md:max-w-none"
                  style={{
                    width: window.innerWidth >= 768 ? "100%" : undefined,
                  }}
                >
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Settings2 size={14} /> Workflow Configuration
                    </h3>
                    <button
                      onClick={() => setActiveWorkflowConfigPanel(null)}
                      className="text-slate-400 hover:text-slate-600"
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    {activeWorkflowConfigPanel === "knowledgeBase" && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-green-50 rounded-lg">
                            <FileText size={18} className="text-green-700" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">
                              Knowledge Base
                            </div>
                            <div className="text-xs text-slate-400">
                              Assign documents used throughout this workflow
                            </div>
                          </div>
                        </div>

                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                          Assigned Documents
                          <span
                            className={`ml-2 ${
                              workflowResources.documents.length >=
                              planLimits.maxDocumentsPerWorkflow
                                ? "text-red-600"
                                : workflowResources.documents.length >=
                                  planLimits.maxDocumentsPerWorkflow * 0.8
                                ? "text-yellow-600"
                                : "text-slate-400"
                            }`}
                          >
                            ({workflowResources.documents.length} /{" "}
                            {planLimits.maxDocumentsPerWorkflow})
                          </span>
                        </label>

                        {workflowResources.documents.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {workflowResources.documents.map((doc: any) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText
                                    size={14}
                                    className="text-green-600"
                                  />
                                  <span className="text-sm font-medium text-slate-700 truncate">
                                    {doc.name}
                                  </span>
                                </div>
                                <button
                                  onClick={() => removeDocument(doc.id)}
                                  className="text-slate-400 hover:text-red-600"
                                  type="button"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {workflowResources.documents.length <
                          planLimits.maxDocumentsPerWorkflow && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                assignDocument(e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">+ Assign Document</option>
                            {availableDocuments
                              .filter(
                                (doc) =>
                                  !workflowResources.documents.find(
                                    (d: any) => d.id === doc.id
                                  )
                              )
                              .map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {doc.name}
                                </option>
                              ))}
                          </select>
                        )}

                        {workflowResources.documents.length >=
                          planLimits.maxDocumentsPerWorkflow && (
                          <p className="text-xs text-red-600 font-medium mt-2">
                            Plan limit reached
                          </p>
                        )}

                        <p className="text-[10px] text-slate-400 mt-1">
                          AI will only search within assigned documents for this
                          workflow.
                        </p>
                      </div>
                    )}

                    {activeWorkflowConfigPanel === "aiConfig" && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-purple-50 rounded-lg">
                            <Bot size={18} className="text-purple-700" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">
                              AI Configuration
                            </div>
                            <div className="text-xs text-slate-400">
                              Persistent AI settings for this workflow
                            </div>
                          </div>
                        </div>

                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                          AI Config Override
                        </label>

                        {workflowResources.aiConfig && (
                          <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Bot size={14} className="text-purple-600" />
                                <span className="text-sm font-medium text-slate-700">
                                  {workflowResources.aiConfig.name ||
                                    "AI Config"}
                                </span>
                              </div>
                              <button
                                onClick={removeAiConfig}
                                className="text-slate-400 hover:text-red-600"
                                type="button"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        )}

                        {!workflowResources.aiConfig && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setAiConfig(e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">+ Set AI Config</option>
                            {availableAiConfigs.map((config) => (
                              <option key={config.id} value={config.id}>
                                {config.name}
                              </option>
                            ))}
                          </select>
                        )}

                        <p className="text-[10px] text-slate-400 mt-1">
                          Override default AI settings for this workflow.
                        </p>

                        <div className="pt-5 mt-5 border-t border-slate-100">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Tone of Voice
                          </label>

                          {workflowResources.toneOfVoice && (
                            <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <MessageSquare
                                    size={14}
                                    className="text-slate-600"
                                  />
                                  <span className="text-sm font-medium text-slate-700">
                                    {String(workflowResources.toneOfVoice)}
                                  </span>
                                </div>
                                <button
                                  onClick={clearWorkflowToneOfVoice}
                                  className="text-slate-400 hover:text-red-600"
                                  type="button"
                                  title="Clear tone override"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          )}

                          <select
                            value={workflowResources.toneOfVoice || ""}
                            onChange={(e) => {
                              const nextTone = e.target.value;
                              if (!nextTone) {
                                clearWorkflowToneOfVoice();
                                return;
                              }
                              setWorkflowToneOfVoice(nextTone);
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">
                              Use AI tone from Settings / AI Config
                            </option>
                            <option value="Friendly & Casual">
                              Friendly & Casual
                            </option>
                            <option value="Professional & Formal">
                              Professional & Formal
                            </option>
                            <option value="Empathetic & Calm">
                              Empathetic & Calm
                            </option>
                            <option value="Technical & Precise">
                              Technical & Precise
                            </option>
                          </select>

                          <p className="text-[10px] text-slate-400 mt-1">
                            If set, this overrides Settings → AI Agent → Tone of
                            Voice for this workflow.
                          </p>
                        </div>
                      </div>
                    )}

                    {activeWorkflowConfigPanel === "agentAssignment" && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <UserCheck size={18} className="text-indigo-700" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">
                              Agent Assignment
                            </div>
                            <div className="text-xs text-slate-400">
                              Assign agent with working hours for scheduling
                            </div>
                          </div>
                        </div>

                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                          Assigned Agent
                        </label>

                        {workflowResources.assignedAgent && (
                          <div className="mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <UserCheck
                                  size={14}
                                  className="text-indigo-600"
                                />
                                <span className="text-sm font-medium text-slate-700">
                                  {workflowResources.assignedAgent.name ||
                                    "Agent"}
                                </span>
                              </div>
                              <button
                                onClick={removeAgent}
                                className="text-slate-400 hover:text-red-600"
                                type="button"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            {workflowResources.assignedAgent.agentTimeZone && (
                              <div className="mt-2 text-xs text-slate-600">
                                <Clock size={12} className="inline mr-1" />
                                {workflowResources.assignedAgent.agentTimeZone}
                              </div>
                            )}
                          </div>
                        )}

                        <select
                          value={workflowResources.assignedAgent?.id || ""}
                          onChange={(e) => {
                            const agentId = e.target.value || null;
                            assignAgent(agentId);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">
                            Any Agent (use business hours)
                          </option>
                          {availableAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name || agent.email}
                            </option>
                          ))}
                        </select>

                        <p className="text-[10px] text-slate-400 mt-1">
                          When an agent is assigned, their working hours and
                          timezone will be used for appointment scheduling. If
                          "Any Agent" is selected, organization business hours
                          will be used.
                        </p>
                      </div>
                    )}

                    {activeWorkflowConfigPanel === "timeSettings" && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <Clock size={18} className="text-slate-700" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">
                              Time Settings
                            </div>
                            <div className="text-xs text-slate-400">
                              Workflow-level timezone and business hours
                            </div>
                          </div>
                        </div>

                        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="text-xs font-bold text-slate-600 uppercase">
                            Current Behavior
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {workflowResources.assignedAgent
                              ? "Agent working hours/timezone apply when an agent is assigned."
                              : "If enabled below, workflow overrides apply; otherwise organization settings apply."}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={workflowOverrideTimeZone}
                                onChange={(e) =>
                                  setWorkflowOverrideTimeZone(e.target.checked)
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span className="font-medium">
                                Override Time Zone
                              </span>
                            </label>

                            <div className="mt-2">
                              <select
                                value={workflowTimeZoneDraft}
                                onChange={(e) =>
                                  setWorkflowTimeZoneDraft(e.target.value)
                                }
                                disabled={!workflowOverrideTimeZone}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                              >
                                {getTimeZoneOptions(
                                  tenantBusinessTimeZone ||
                                    getDetectedTimeZone()
                                ).map((tz) => (
                                  <option key={tz} value={tz}>
                                    {tz}
                                  </option>
                                ))}
                              </select>
                              {!workflowOverrideTimeZone && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Using organization timezone:{" "}
                                  {tenantBusinessTimeZone}
                                </p>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={workflowOverrideBusinessHours}
                                onChange={(e) =>
                                  setWorkflowOverrideBusinessHours(
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span className="font-medium">
                                Override Business Hours
                              </span>
                            </label>

                            <div className="mt-3 space-y-2">
                              {(
                                Object.keys(
                                  workflowBusinessHoursDraft.days
                                ) as BusinessHoursDayKey[]
                              ).map((dayKey) => {
                                const day =
                                  workflowBusinessHoursDraft.days[dayKey];
                                const label =
                                  dayKey.charAt(0).toUpperCase() +
                                  dayKey.slice(1);

                                return (
                                  <div
                                    key={dayKey}
                                    className="grid grid-cols-[84px_1fr] items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
                                  >
                                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(day.enabled)}
                                        disabled={
                                          !workflowOverrideBusinessHours
                                        }
                                        onChange={(e) => {
                                          const next = {
                                            ...workflowBusinessHoursDraft,
                                            days: {
                                              ...workflowBusinessHoursDraft.days,
                                              [dayKey]: {
                                                ...day,
                                                enabled: e.target.checked,
                                              },
                                            },
                                          };
                                          setWorkflowBusinessHoursDraft(next);
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                      />
                                      <span className="w-10">{label}</span>
                                    </label>

                                    <div className="grid grid-cols-[1fr_auto] gap-2 min-w-0">
                                      <div className="grid grid-cols-2 gap-2">
                                        <input
                                          type="time"
                                          value={day.start}
                                          disabled={
                                            !workflowOverrideBusinessHours
                                          }
                                          onChange={(e) => {
                                            const next = {
                                              ...workflowBusinessHoursDraft,
                                              days: {
                                                ...workflowBusinessHoursDraft.days,
                                                [dayKey]: {
                                                  ...day,
                                                  start: e.target.value,
                                                },
                                              },
                                            };
                                            setWorkflowBusinessHoursDraft(next);
                                          }}
                                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-sm disabled:opacity-50"
                                        />
                                        <input
                                          type="time"
                                          value={day.end}
                                          disabled={
                                            !workflowOverrideBusinessHours
                                          }
                                          onChange={(e) => {
                                            const next = {
                                              ...workflowBusinessHoursDraft,
                                              days: {
                                                ...workflowBusinessHoursDraft.days,
                                                [dayKey]: {
                                                  ...day,
                                                  end: e.target.value,
                                                },
                                              },
                                            };
                                            setWorkflowBusinessHoursDraft(next);
                                          }}
                                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-sm disabled:opacity-50"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = {
                                            ...workflowBusinessHoursDraft,
                                            days: {
                                              ...workflowBusinessHoursDraft.days,
                                            },
                                          };
                                          // Copy current day's times to all other days
                                          (
                                            Object.keys(
                                              next.days
                                            ) as BusinessHoursDayKey[]
                                          ).forEach((key) => {
                                            if (key !== dayKey) {
                                              next.days[key] = {
                                                ...next.days[key],
                                                start: day.start,
                                                end: day.end,
                                              };
                                            }
                                          });
                                          setWorkflowBusinessHoursDraft(next);
                                        }}
                                        disabled={
                                          !workflowOverrideBusinessHours
                                        }
                                        className="px-2 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        title="Copy these times to all other days"
                                      >
                                        Copy
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {!workflowOverrideBusinessHours && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Using organization business hours.
                                </p>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">
                              After Hours Behavior
                            </label>

                            <div className="space-y-3">
                              <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                                <input
                                  type="radio"
                                  name="afterHoursMode"
                                  value="USE_ORG"
                                  checked={workflowAfterHoursMode === "USE_ORG"}
                                  onChange={(e) =>
                                    setWorkflowAfterHoursMode(e.target.value)
                                  }
                                  className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    Use Organization Settings
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    Follow the default after-hours configuration
                                  </div>
                                </div>
                              </label>

                              <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                                <input
                                  type="radio"
                                  name="afterHoursMode"
                                  value="CUSTOM_VOICEMAIL"
                                  checked={
                                    workflowAfterHoursMode ===
                                    "CUSTOM_VOICEMAIL"
                                  }
                                  onChange={(e) =>
                                    setWorkflowAfterHoursMode(e.target.value)
                                  }
                                  className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    Custom Voicemail Message
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    Play a custom message and take voicemail
                                  </div>
                                  {workflowAfterHoursMode ===
                                    "CUSTOM_VOICEMAIL" && (
                                    <textarea
                                      value={workflowAfterHoursMessage}
                                      onChange={(e) =>
                                        setWorkflowAfterHoursMessage(
                                          e.target.value
                                        )
                                      }
                                      placeholder="e.g., We're currently closed. Please leave a message..."
                                      className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      rows={3}
                                    />
                                  )}
                                </div>
                              </label>

                              <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                                <input
                                  type="radio"
                                  name="afterHoursMode"
                                  value="REDIRECT_WORKFLOW"
                                  checked={
                                    workflowAfterHoursMode ===
                                    "REDIRECT_WORKFLOW"
                                  }
                                  onChange={(e) =>
                                    setWorkflowAfterHoursMode(e.target.value)
                                  }
                                  className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    Redirect to Another Workflow
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    Transfer to a different workflow (target
                                    workflow's after-hours settings will be
                                    ignored)
                                  </div>
                                  {workflowAfterHoursMode ===
                                    "REDIRECT_WORKFLOW" && (
                                    <>
                                      <select
                                        value={
                                          workflowAfterHoursWorkflowId || ""
                                        }
                                        onChange={(e) =>
                                          setWorkflowAfterHoursWorkflowId(
                                            e.target.value || null
                                          )
                                        }
                                        className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      >
                                        <option value="">
                                          Select a workflow...
                                        </option>
                                        {workflows
                                          .filter(
                                            (w) =>
                                              w.id !== selectedWorkflowMeta?.id
                                          )
                                          .map((w) => {
                                            const hasAfterHoursRedirect =
                                              Boolean(
                                                (w as any).afterHoursWorkflowId
                                              );
                                            const hasAfterHoursSettings =
                                              (w as any).afterHoursMode &&
                                              (w as any).afterHoursMode !==
                                                "USE_ORG";

                                            return (
                                              <option
                                                key={w.id}
                                                value={w.id}
                                                disabled={hasAfterHoursRedirect}
                                              >
                                                {w.name}
                                                {hasAfterHoursRedirect
                                                  ? " (⚠ has redirect - not allowed)"
                                                  : ""}
                                                {hasAfterHoursSettings &&
                                                !hasAfterHoursRedirect
                                                  ? " (⚠ has settings - will be ignored)"
                                                  : ""}
                                              </option>
                                            );
                                          })}
                                      </select>
                                      {workflowAfterHoursWorkflowId &&
                                        workflows.find(
                                          (w) =>
                                            w.id ===
                                              workflowAfterHoursWorkflowId &&
                                            (w as any).afterHoursMode &&
                                            (w as any).afterHoursMode !==
                                              "USE_ORG"
                                        ) && (
                                          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                                            <strong>Note:</strong> This workflow
                                            has its own after-hours
                                            configuration, but it will be
                                            ignored when used as an after-hours
                                            target.
                                          </div>
                                        )}
                                    </>
                                  )}
                                </div>
                              </label>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={saveWorkflowTimeSettings}
                              disabled={savingTimeSettings}
                              className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {savingTimeSettings ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={clearWorkflowTimeSettings}
                              disabled={savingTimeSettings}
                              className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                              title="Clear workflow overrides"
                            >
                              Use org
                            </button>
                          </div>

                          <p className="text-[10px] text-slate-400">
                            If set, these values override organization time
                            settings for this workflow.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedNode && !selectedEdgeId && (
              <div
                className="fixed inset-0 z-40 md:static md:z-auto md:inset-auto md:shrink-0 md:relative"
                style={{
                  width:
                    window.innerWidth >= 768 ? `${sidebarWidth}px` : undefined,
                }}
              >
                <div
                  className="absolute inset-0 bg-black/50 md:hidden"
                  onClick={() => setSelectedNodeId(null)}
                />

                {/* Resize Handle (desktop) - anchored to sidebar border */}
                <div
                  className="hidden md:block absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-[2000]"
                  onMouseDown={handleResizeStart}
                  onTouchStart={handleResizeStart}
                  title="Drag to resize panel"
                >
                  <div className="absolute inset-y-0 left-0 w-px bg-slate-200" />
                  <div className="absolute top-1/2 -translate-y-1/2 left-0.5 w-2.5 h-12 bg-white border border-slate-300 rounded shadow-sm flex items-center justify-center">
                    <div className="flex flex-col gap-1">
                      <div className="w-0.5 h-0.5 bg-slate-400 rounded-full" />
                      <div className="w-0.5 h-0.5 bg-slate-400 rounded-full" />
                      <div className="w-0.5 h-0.5 bg-slate-400 rounded-full" />
                    </div>
                  </div>
                </div>

                <div
                  className="relative right-0 top-0 h-full w-[90vw] max-w-sm bg-white border-l border-slate-200 flex flex-col z-40 shadow-xl md:static md:h-full md:w-full md:max-w-none"
                  style={{
                    width: window.innerWidth >= 768 ? "100%" : undefined,
                  }}
                >
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Settings2 size={14} /> Node Properties
                    </h3>
                    <button
                      onClick={() => setSelectedNodeId(null)}
                      className="text-slate-400 hover:text-slate-600"
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        Node Type
                      </label>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase ${
                          selectedNode.type === "trigger"
                            ? "bg-orange-100 text-orange-700"
                            : selectedNode.type === "action"
                            ? "bg-indigo-100 text-indigo-700"
                            : selectedNode.type === "condition"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {selectedNode.type}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        Label Name
                      </label>
                      <input
                        type="text"
                        value={selectedNode.label}
                        onChange={(e) =>
                          updateNode(selectedNode.id, { label: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        Description / Sub-Label
                      </label>
                      <textarea
                        rows={3}
                        value={selectedNode.subLabel || ""}
                        onChange={(e) =>
                          updateNode(selectedNode.id, {
                            subLabel: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                      />
                    </div>

                    {/* Specific Configuration: Incoming Call */}
                    {selectedNode.label === "Incoming Call" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Select Phone Number
                          </label>
                          <select
                            value={selectedNode.config?.phoneNumberId || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  phoneNumberId: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          >
                            <option value="">Any / All Numbers</option>
                            {ownedNumbers.map((num) => (
                              <option key={num.id} value={num.id}>
                                {num.friendlyName} ({num.number})
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Choose which inbound line triggers this flow.
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold text-slate-500 uppercase">
                              Greeting Message
                            </label>
                            <button
                              onClick={() => generateGreeting(selectedNode.id)}
                              disabled={isGeneratingGreeting}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isGeneratingGreeting ? (
                                <>
                                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Zap size={12} />
                                  Generate with AI
                                </>
                              )}
                            </button>
                          </div>
                          <textarea
                            rows={3}
                            placeholder="Hello! Thank you for calling. How can I help you today?"
                            value={selectedNode.config?.greeting || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  greeting: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            The AI will speak this greeting when the call is
                            answered.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Phone Voice Override
                          </label>
                          <select
                            value={selectedNode.config?.phoneVoiceId || ""}
                            onChange={(e) => {
                              const voiceId = e.target.value;
                              const voiceInfo = availablePhoneVoices.find(
                                (v) => v.id === voiceId
                              );

                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  phoneVoiceId: voiceId,
                                  phoneVoiceLanguage:
                                    voiceId && voiceInfo?.language
                                      ? voiceInfo.language
                                      : "",
                                },
                              });
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          >
                            <option value="">
                              Use workflow/system phone voice settings
                            </option>
                            {availablePhoneVoices.map((voice) => (
                              <option key={voice.id} value={voice.id}>
                                {voice.name || voice.id}
                                {voice.language ? ` (${voice.language})` : ""}
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-400 mt-1">
                            If set, this overrides the system-wide Phone Voice
                            Settings for calls that enter via this Incoming Call
                            trigger.
                          </p>
                          {selectedNode.config?.phoneVoiceId && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              Language:{" "}
                              {selectedNode.config?.phoneVoiceLanguage ||
                                "(auto)"}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Information to Request
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  selectedNode.config?.requestInfo?.name ===
                                  true
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      requestInfo: {
                                        ...selectedNode.config?.requestInfo,
                                        name: e.target.checked ? true : false,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span>Caller Name</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  selectedNode.config?.requestInfo?.email ||
                                  false
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      requestInfo: {
                                        ...selectedNode.config?.requestInfo,
                                        email: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span>Email Address</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  selectedNode.config?.requestInfo
                                    ?.callbackNumber || false
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      requestInfo: {
                                        ...selectedNode.config?.requestInfo,
                                        callbackNumber: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span>Callback Number</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  selectedNode.config?.requestInfo
                                    ?.orderNumber || false
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      requestInfo: {
                                        ...selectedNode.config?.requestInfo,
                                        orderNumber: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span>Order/Account Number</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  selectedNode.config?.requestInfo?.reason ||
                                  false
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      requestInfo: {
                                        ...selectedNode.config?.requestInfo,
                                        reason: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span>Reason for Call</span>
                            </label>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1.5">
                            AI will ask for checked information if not already
                            known. Name is requested by default for unknown
                            callers.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Specific Configuration: Call Group */}
                    {selectedNode.label === "Call Group" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Call Group
                          </label>
                          <select
                            value={selectedNode.config?.callGroupId || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  callGroupId: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          >
                            <option value="">Select a call group</option>
                            {availableCallGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Rings members of the selected call group.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Ring Strategy
                          </label>
                          <select
                            value={
                              selectedNode.config?.ringStrategy || "SEQUENTIAL"
                            }
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  ringStrategy: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          >
                            <option value="SEQUENTIAL">Sequential</option>
                            <option value="SIMULTANEOUS">Simultaneous</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Ring Timeout (seconds)
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={60}
                            value={selectedNode.config?.timeoutSeconds ?? 20}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  timeoutSeconds: Number(e.target.value),
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                selectedNode.config?.onlyCheckedIn ?? true
                              }
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    onlyCheckedIn: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span>Only ring checked-in agents</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                selectedNode.config?.respectWorkingHours ?? true
                              }
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    respectWorkingHours: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span>Respect working hours</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Specific Configuration: Call Forwarding */}
                    {selectedNode.label === "Call Forwarding" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Forward To
                          </label>
                          <select
                            value={
                              selectedNode.config?.targetType || "external"
                            }
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  targetType: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          >
                            <option value="external">External number</option>
                            <option value="user">User</option>
                            <option value="callGroup">Call group</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Override Number (optional)
                          </label>
                          <input
                            type="text"
                            placeholder="+15551234567"
                            value={selectedNode.config?.overrideNumber || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  overrideNumber: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            If set, this number is used regardless of the
                            selection above.
                          </p>
                        </div>

                        {selectedNode.config?.targetType === "external" && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              External Number (E.164)
                            </label>
                            <input
                              type="text"
                              placeholder="+15551234567"
                              value={selectedNode.config?.externalNumber || ""}
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    externalNumber: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            />
                          </div>
                        )}

                        {selectedNode.config?.targetType === "user" && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              User
                            </label>
                            <select
                              value={selectedNode.config?.userId || ""}
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    userId: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            >
                              <option value="">Select a user</option>
                              {availableAgents.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.email})
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Uses the user's forwarding phone number.
                            </p>
                          </div>
                        )}

                        {selectedNode.config?.targetType === "callGroup" && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              Call Group
                            </label>
                            <select
                              value={selectedNode.config?.callGroupId || ""}
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    callGroupId: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            >
                              <option value="">Select a call group</option>
                              {availableCallGroups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Ring Timeout (seconds)
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={60}
                            value={selectedNode.config?.timeoutSeconds ?? 20}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  timeoutSeconds: Number(e.target.value),
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                selectedNode.config?.onlyCheckedIn ?? true
                              }
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    onlyCheckedIn: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span>Only ring checked-in agents</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                selectedNode.config?.respectWorkingHours ?? true
                              }
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    respectWorkingHours: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span>Respect working hours</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Specific Configuration: Say/Play */}
                    {selectedNode.label === "Say/Play" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Action Type
                          </label>
                          <select
                            value={selectedNode.config?.playType || "say"}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  playType: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          >
                            <option value="say">Say (Text-to-Speech)</option>
                            <option value="play">
                              Play Audio (Music/Recording)
                            </option>
                          </select>
                        </div>

                        {(!selectedNode.config?.playType ||
                          selectedNode.config?.playType === "say") && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                Message to Say
                              </label>
                              <textarea
                                rows={4}
                                placeholder="Thank you for calling. Please hold while we connect you to an agent..."
                                value={selectedNode.config?.message || ""}
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      message: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">
                                Text will be converted to speech using AI voice
                              </p>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                Voice
                              </label>
                              <select
                                value={selectedNode.config?.voice || "alloy"}
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      voice: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                              >
                                <option value="alloy">Alloy (Neutral)</option>
                                <option value="echo">Echo (Male)</option>
                                <option value="fable">
                                  Fable (British Male)
                                </option>
                                <option value="onyx">Onyx (Deep Male)</option>
                                <option value="nova">Nova (Female)</option>
                                <option value="shimmer">
                                  Shimmer (Soft Female)
                                </option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                Language
                              </label>
                              <select
                                value={selectedNode.config?.language || "en"}
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      language: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                              >
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="it">Italian</option>
                                <option value="pt">Portuguese</option>
                                <option value="zh">Chinese</option>
                                <option value="ja">Japanese</option>
                              </select>
                            </div>
                          </>
                        )}

                        {selectedNode.config?.playType === "play" && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                Audio Type
                              </label>
                              <select
                                value={selectedNode.config?.audioType || "hold"}
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      audioType: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                              >
                                <option value="hold">Hold Music</option>
                                <option value="url">Custom Audio URL</option>
                              </select>
                            </div>

                            {selectedNode.config?.audioType === "url" && (
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Audio URL
                                </label>
                                <input
                                  type="url"
                                  placeholder="https://example.com/audio.mp3"
                                  value={selectedNode.config?.audioUrl || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        audioUrl: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                  MP3 or WAV format recommended
                                </p>
                              </div>
                            )}

                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                Loop
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedNode.config?.loop || false}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        loop: e.target.checked,
                                      },
                                    })
                                  }
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <span className="text-sm text-slate-600">
                                  Repeat audio continuously
                                </span>
                              </label>
                            </div>
                          </>
                        )}

                        <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg">
                          💡{" "}
                          {selectedNode.config?.playType === "play"
                            ? "Audio will play while the caller is on hold or waiting"
                            : "Text-to-speech will convert your message into natural-sounding voice"}
                        </div>
                      </div>
                    )}

                    {/* Specific Configuration: Incoming Message */}
                    {selectedNode.label === "Incoming Message" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Auto-Reply Message
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Thanks for your message! How can I help you today?"
                            value={selectedNode.config?.autoReply || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  autoReply: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            The AI will send this as an initial response when a
                            message is received.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Information to Request
                          </label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  selectedNode.config?.requestInfo?.name ===
                                  true
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      requestInfo: {
                                        ...selectedNode.config?.requestInfo,
                                        name: e.target.checked ? true : false,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span>Customer Name</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  selectedNode.config?.requestInfo?.email ||
                                  false
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      requestInfo: {
                                        ...selectedNode.config?.requestInfo,
                                        email: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span>Email Address</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  selectedNode.config?.requestInfo?.phone ||
                                  false
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      requestInfo: {
                                        ...selectedNode.config?.requestInfo,
                                        phone: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span>Phone Number</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  selectedNode.config?.requestInfo
                                    ?.orderNumber || false
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      requestInfo: {
                                        ...selectedNode.config?.requestInfo,
                                        orderNumber: e.target.checked,
                                      },
                                    },
                                  })
                                }
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <span>Order/Account Number</span>
                            </label>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1.5">
                            AI will ask for checked information if not already
                            known. Name is requested by default for unknown
                            customers.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Specific Configuration: Knowledge Base */}
                    {selectedNode.label === "Knowledge Base" && (
                      <div className="pt-6 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                          Assigned Documents
                          <span
                            className={`ml-2 ${
                              workflowResources.documents.length >=
                              planLimits.maxDocumentsPerWorkflow
                                ? "text-red-600"
                                : workflowResources.documents.length >=
                                  planLimits.maxDocumentsPerWorkflow * 0.8
                                ? "text-yellow-600"
                                : "text-slate-400"
                            }`}
                          >
                            ({workflowResources.documents.length} /{" "}
                            {planLimits.maxDocumentsPerWorkflow})
                          </span>
                        </label>

                        {/* Assigned Documents List */}
                        {workflowResources.documents.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {workflowResources.documents.map((doc: any) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText
                                    size={14}
                                    className="text-green-600"
                                  />
                                  <span className="text-sm font-medium text-slate-700 truncate">
                                    {doc.name}
                                  </span>
                                </div>
                                <button
                                  onClick={() => removeDocument(doc.id)}
                                  className="text-slate-400 hover:text-red-600"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Document Dropdown */}
                        {workflowResources.documents.length <
                          planLimits.maxDocumentsPerWorkflow && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                assignDocument(e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">+ Assign Document</option>
                            {availableDocuments
                              .filter(
                                (doc) =>
                                  !workflowResources.documents.find(
                                    (d: any) => d.id === doc.id
                                  )
                              )
                              .map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {doc.name}
                                </option>
                              ))}
                          </select>
                        )}
                        {workflowResources.documents.length >=
                          planLimits.maxDocumentsPerWorkflow && (
                          <p className="text-xs text-red-600 font-medium mt-2">
                            Plan limit reached
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          AI will only search within assigned documents for this
                          workflow.
                        </p>
                      </div>
                    )}

                    {/* Specific Configuration: AI Configuration */}
                    {selectedNode.label === "AI Configuration" && (
                      <div className="pt-6 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                          AI Config Override
                        </label>

                        {/* Current AI Config */}
                        {workflowResources.aiConfig && (
                          <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Bot size={14} className="text-purple-600" />
                                <span className="text-sm font-medium text-slate-700">
                                  {workflowResources.aiConfig.name}
                                </span>
                              </div>
                              <button
                                onClick={removeAiConfig}
                                className="text-slate-400 hover:text-red-600"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Set AI Config Dropdown */}
                        {!workflowResources.aiConfig && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setAiConfig(e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">+ Set AI Config</option>
                            {availableAiConfigs.map((config) => (
                              <option key={config.id} value={config.id}>
                                {config.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          Override default AI settings for this workflow.
                        </p>
                      </div>
                    )}

                    {/* Specific Configuration: Condition */}
                    {selectedNode.type === "condition" && (
                      <ConditionBuilder
                        node={selectedNode}
                        onUpdate={(config) =>
                          updateNode(selectedNode.id, { config })
                        }
                      />
                    )}

                    {/* Specific Configuration: Send Email */}
                    {selectedNode.label === "Send Email" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Recipient Email
                          </label>
                          <input
                            type="text"
                            placeholder="email@example.com or {{customer.email}}"
                            value={selectedNode.config?.to || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  to: e.target.value,
                                },
                              })
                            }
                            className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all ${
                              isSendEmailFieldMissing(selectedNode, "to")
                                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                            }`}
                          />
                          {isSendEmailFieldMissing(selectedNode, "to") && (
                            <p className="text-[11px] text-red-600 mt-1 font-medium">
                              Recipient Email is required.
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">
                            Use variables like {"{{customer.email}}"} or enter a
                            static email address
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Subject Line
                          </label>
                          <input
                            type="text"
                            placeholder="Email subject..."
                            value={selectedNode.config?.subject || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  subject: e.target.value,
                                },
                              })
                            }
                            className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all ${
                              isSendEmailFieldMissing(selectedNode, "subject")
                                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                            }`}
                          />
                          {isSendEmailFieldMissing(selectedNode, "subject") && (
                            <p className="text-[11px] text-red-600 mt-1 font-medium">
                              Subject Line is required.
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">
                            Supports variables: {"{{customer.name}}"},{" "}
                            {"{{workflow.data}}"}
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Email Body
                          </label>
                          <textarea
                            rows={6}
                            placeholder="Email content..."
                            value={selectedNode.config?.body || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  body: e.target.value,
                                },
                              })
                            }
                            className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all resize-none ${
                              isSendEmailFieldMissing(selectedNode, "body")
                                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                : "border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                            }`}
                          />
                          {isSendEmailFieldMissing(selectedNode, "body") && (
                            <p className="text-[11px] text-red-600 mt-1 font-medium">
                              Email Body is required.
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">
                            Supports variables and can use HTML if enabled
                            below.
                          </p>
                        </div>

                        <div>
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedNode.config?.isHtml || false}
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    isHtml: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span>Send as HTML email</span>
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            From Email (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="noreply@yourdomain.com (optional)"
                            value={selectedNode.config?.from || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  from: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Leave empty to use the default sender
                            (SMTP_FROM_EMAIL).
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Reply-To Email (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="support@yourdomain.com (optional)"
                            value={selectedNode.config?.replyTo || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  replyTo: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Where replies should be sent
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Calendar: Create Event (ICS invite) */}
                    {selectedNode.label === "Create Calendar Event" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        {(() => {
                          const conferenceLabel = (t: string) => {
                            const type = String(t || "").trim();
                            if (!type) return "";
                            if (type === "hangoutsMeet") return "Google Meet";
                            if (type === "addOn")
                              return "Google Workspace Add-on";
                            if (type === "eventHangout")
                              return "Hangouts (legacy)";
                            if (type === "eventNamedHangout")
                              return "Hangouts (named, legacy)";
                            return type;
                          };

                          const allowedTypes =
                            calendarConferenceStatus.state === "loaded" &&
                            calendarConferenceStatus.connected
                              ? calendarConferenceStatus.allowedTypes || []
                              : [];

                          const addMeeting = Boolean(
                            selectedNode.config?.addMeeting ?? false
                          );

                          const selectedProvider = String(
                            selectedNode.config?.meetingProvider || ""
                          ).trim();

                          return (
                            <>
                              <div className="text-xs text-slate-500">
                                Sends an email with an{" "}
                                <span className="font-semibold">.ics</span>{" "}
                                invite attachment (works with Google Calendar,
                                Outlook, Apple Calendar).
                              </div>

                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="text-[11px] text-slate-600">
                                  {calendarConferenceStatus.state ===
                                    "loading" &&
                                    "Checking connected Google Calendar…"}
                                  {calendarConferenceStatus.state ===
                                    "loaded" &&
                                    calendarConferenceStatus.connected &&
                                    (allowedTypes.length > 0
                                      ? "Meeting providers detected on this Google Calendar account."
                                      : "Google Calendar connected, but no conference providers were reported by the API.")}
                                  {calendarConferenceStatus.state ===
                                    "loaded" &&
                                    !calendarConferenceStatus.connected &&
                                    "Google Calendar is not connected for this tenant."}
                                  {calendarConferenceStatus.state === "error" &&
                                    "Unable to check meeting providers."}
                                </div>
                              </div>

                              <div>
                                <label className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={addMeeting}
                                    onChange={(e) => {
                                      const next = e.target.checked;
                                      const nextProvider =
                                        next && !selectedProvider
                                          ? allowedTypes[0] || "hangoutsMeet"
                                          : selectedProvider;

                                      updateNode(selectedNode.id, {
                                        config: {
                                          ...selectedNode.config,
                                          addMeeting: next,
                                          meetingProvider: next
                                            ? nextProvider
                                            : undefined,
                                        },
                                      });
                                    }}
                                    disabled={
                                      calendarConferenceStatus.state ===
                                      "loading"
                                    }
                                  />
                                  <span>
                                    <span className="block text-sm text-slate-700 font-medium">
                                      Add meeting link (Google Calendar)
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                      When enabled and Google Calendar is
                                      connected, the created event will include
                                      a conferencing link.
                                    </span>
                                  </span>
                                </label>
                              </div>

                              {addMeeting && (
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                    Meeting Provider
                                  </label>
                                  <select
                                    value={selectedProvider || ""}
                                    onChange={(e) =>
                                      updateNode(selectedNode.id, {
                                        config: {
                                          ...selectedNode.config,
                                          meetingProvider: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    disabled={
                                      !(
                                        calendarConferenceStatus.state ===
                                          "loaded" &&
                                        calendarConferenceStatus.connected
                                      )
                                    }
                                  >
                                    {(allowedTypes.length > 0
                                      ? allowedTypes
                                      : ["hangoutsMeet"]
                                    ).map((t) => (
                                      <option key={t} value={t}>
                                        {conferenceLabel(t)}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    This list comes from the connected Google
                                    Calendar account.
                                  </p>
                                </div>
                              )}
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Event Title
                                </label>
                                <input
                                  type="text"
                                  placeholder="Meeting with customer"
                                  value={selectedNode.config?.summary || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        summary: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="text-[11px] text-slate-600">
                                  Start/end times come from the scheduling flow
                                  (chat/call). This node only creates the
                                  calendar event + invite.
                                  {tenantMaxMeetingDuration > 0 && (
                                    <>
                                      <br />
                                      <br />
                                      <span className="font-semibold">
                                        Max meeting duration:
                                      </span>{" "}
                                      {tenantMaxMeetingDuration} minutes
                                      (configured in Settings → Business Hours)
                                    </>
                                  )}
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Location (Optional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="Zoom / Office / Address"
                                  value={selectedNode.config?.location || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        location: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Description (Optional)
                                </label>
                                <textarea
                                  rows={3}
                                  placeholder="Agenda, prep notes, meeting link..."
                                  value={selectedNode.config?.description || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        description: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Attendees
                                </label>
                                <input
                                  type="text"
                                  placeholder="email1@example.com, email2@example.com"
                                  value={selectedNode.config?.attendees || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        attendees: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Comma-separated emails. If empty, falls back
                                  to the customer email (if available).
                                </p>
                              </div>

                              <div className="pt-2 border-t border-slate-100 space-y-3">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                    Email Subject (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Invitation: Meeting"
                                    value={
                                      selectedNode.config?.emailSubject || ""
                                    }
                                    onChange={(e) =>
                                      updateNode(selectedNode.id, {
                                        config: {
                                          ...selectedNode.config,
                                          emailSubject: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                    Email Body (Optional)
                                  </label>
                                  <textarea
                                    rows={3}
                                    placeholder="Hi! Here's a calendar invite for our meeting..."
                                    value={selectedNode.config?.emailBody || ""}
                                    onChange={(e) =>
                                      updateNode(selectedNode.id, {
                                        config: {
                                          ...selectedNode.config,
                                          emailBody: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {selectedNode.label === "Send Gmail" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div className="text-[11px] text-slate-500">
                          {gmailSenderStatus.state === "loading" &&
                            "Checking connected Gmail account…"}
                          {gmailSenderStatus.state === "loaded" &&
                            `Sending as: ${gmailSenderStatus.email}`}
                          {gmailSenderStatus.state === "error" &&
                            "Gmail not connected (or unable to fetch sender)."}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            To
                          </label>
                          <input
                            type="text"
                            placeholder="recipient@example.com"
                            value={selectedNode.config?.to || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  to: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Subject
                          </label>
                          <input
                            type="text"
                            placeholder="Email subject..."
                            value={selectedNode.config?.subject || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  subject: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Body
                          </label>
                          <textarea
                            rows={6}
                            placeholder="Email content..."
                            value={selectedNode.config?.body || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  body: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {(selectedNode.label === "HubSpot" ||
                      selectedNode.label?.startsWith("HubSpot ")) && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Action
                          </label>
                          <select
                            value={selectedNode.config?.action || "create"}
                            onChange={(e) => {
                              const action = e.target.value;
                              const actionLabels: Record<string, string> = {
                                create: "HubSpot Create",
                                update: "HubSpot Update",
                                search: "HubSpot Search",
                                getById: "HubSpot Get",
                                logActivity: "HubSpot Log Activity",
                              };
                              updateNode(selectedNode.id, {
                                label: actionLabels[action] || "HubSpot",
                                config: {
                                  ...selectedNode.config,
                                  action: action,
                                },
                              });
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="search">Search/Lookup</option>
                            <option value="getById">Get by ID</option>
                            <option value="logActivity">Log Activity</option>
                          </select>
                        </div>

                        {selectedNode.config?.action !== "logActivity" && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              Object Type
                            </label>
                            <select
                              value={
                                selectedNode.config?.objectType || "contact"
                              }
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    objectType: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="contact">Contact</option>
                              <option value="company">Company</option>
                              <option value="deal">Deal</option>
                            </select>
                          </div>
                        )}

                        {/* GET BY ID */}
                        {selectedNode.config?.action === "getById" && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              Record ID
                            </label>
                            <input
                              type="text"
                              placeholder="123456789 or {{recordId}}"
                              value={selectedNode.config?.recordId || ""}
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    recordId: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        )}

                        {/* UPDATE - NEED RECORD ID */}
                        {selectedNode.config?.action === "update" && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              Record ID
                            </label>
                            <input
                              type="text"
                              placeholder="123456789 or {{recordId}}"
                              value={selectedNode.config?.recordId || ""}
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    recordId: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        )}

                        {/* LOG ACTIVITY */}
                        {selectedNode.config?.action === "logActivity" && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                Activity Type
                              </label>
                              <select
                                value={
                                  selectedNode.config?.activityType || "note"
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      activityType: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="note">Note</option>
                                <option value="call">Call</option>
                                <option value="email">Email</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                Contact/Company/Deal ID
                              </label>
                              <input
                                type="text"
                                placeholder="Associate with record ID"
                                value={
                                  selectedNode.config?.associatedRecordId || ""
                                }
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      associatedRecordId: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                Subject/Notes
                              </label>
                              <textarea
                                rows={4}
                                placeholder="Activity description..."
                                value={selectedNode.config?.activityNotes || ""}
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      activityNotes: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              />
                            </div>
                            {selectedNode.config?.activityType === "call" && (
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Call Duration (seconds)
                                </label>
                                <input
                                  type="number"
                                  placeholder="300"
                                  value={
                                    selectedNode.config?.callDuration || ""
                                  }
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        callDuration: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* CREATE/UPDATE/SEARCH - CONTACT FIELDS */}
                        {(selectedNode.config?.action === "create" ||
                          selectedNode.config?.action === "update" ||
                          selectedNode.config?.action === "search") &&
                          (!selectedNode.config?.objectType ||
                            selectedNode.config?.objectType === "contact") && (
                            <>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  placeholder="contact@example.com or {{customer.email}}"
                                  value={selectedNode.config?.email || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        email: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  First Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="John or {{customer.firstName}}"
                                  value={selectedNode.config?.firstName || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        firstName: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Last Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Doe or {{customer.lastName}}"
                                  value={selectedNode.config?.lastName || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        lastName: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Phone
                                </label>
                                <input
                                  type="text"
                                  placeholder="+1234567890 or {{customer.phone}}"
                                  value={selectedNode.config?.phone || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        phone: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Company Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Acme Inc or {{company.name}}"
                                  value={selectedNode.config?.company || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        company: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </>
                          )}

                        {(selectedNode.config?.action === "create" ||
                          selectedNode.config?.action === "update" ||
                          selectedNode.config?.action === "search") &&
                          selectedNode.config?.objectType === "company" && (
                            <>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Company Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Acme Inc or {{company.name}}"
                                  value={selectedNode.config?.companyName || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        companyName: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Domain
                                </label>
                                <input
                                  type="text"
                                  placeholder="example.com"
                                  value={selectedNode.config?.domain || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        domain: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Phone
                                </label>
                                <input
                                  type="text"
                                  placeholder="+1234567890"
                                  value={selectedNode.config?.phone || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        phone: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </>
                          )}

                        {(selectedNode.config?.action === "create" ||
                          selectedNode.config?.action === "update" ||
                          selectedNode.config?.action === "search") &&
                          selectedNode.config?.objectType === "deal" && (
                            <>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Deal Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Q1 2026 Contract"
                                  value={selectedNode.config?.dealName || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        dealName: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Amount
                                </label>
                                <input
                                  type="number"
                                  placeholder="10000"
                                  value={selectedNode.config?.amount || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        amount: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                  Pipeline Stage
                                </label>
                                <input
                                  type="text"
                                  placeholder="qualifiedtobuy"
                                  value={selectedNode.config?.dealStage || ""}
                                  onChange={(e) =>
                                    updateNode(selectedNode.id, {
                                      config: {
                                        ...selectedNode.config,
                                        dealStage: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </>
                          )}

                        {(selectedNode.config?.action === "create" ||
                          selectedNode.config?.action === "update") && (
                          <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg">
                            💡 Use variables like{" "}
                            <code className="px-1 bg-white rounded">
                              {"{{customer.email}}"}
                            </code>
                            ,{" "}
                            <code className="px-1 bg-white rounded">
                              {"{{customer.phone}}"}
                            </code>
                            , or{" "}
                            <code className="px-1 bg-white rounded">
                              {"{{customer.name}}"}
                            </code>{" "}
                            to dynamically populate fields from your workflow
                            data.
                          </div>
                        )}

                        {selectedNode.config?.action === "search" && (
                          <div className="text-xs text-slate-500 bg-purple-50 p-3 rounded-lg">
                            🔍 Search will find records matching the criteria
                            you provide. Leave fields empty to skip them in the
                            search.
                          </div>
                        )}

                        {selectedNode.config?.action === "getById" && (
                          <div className="text-xs text-slate-500 bg-green-50 p-3 rounded-lg">
                            🎯 Retrieves a specific record by its HubSpot ID.
                            Use{" "}
                            <code className="px-1 bg-white rounded">
                              {"{{recordId}}"}
                            </code>{" "}
                            from previous steps.
                          </div>
                        )}

                        {selectedNode.config?.action === "logActivity" && (
                          <div className="text-xs text-slate-500 bg-orange-50 p-3 rounded-lg">
                            📝 Logs an activity (note, call, or email) and
                            associates it with a contact, company, or deal.
                          </div>
                        )}
                      </div>
                    )}

                    {selectedNode.label === "Upload to Drive" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            File Name
                          </label>
                          <input
                            type="text"
                            placeholder="document.txt"
                            value={selectedNode.config?.fileName || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  fileName: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            File Content
                          </label>
                          <textarea
                            rows={4}
                            placeholder="File content..."
                            value={selectedNode.config?.fileContent || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  fileContent: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {selectedNode.label === "Add Row to Sheet" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div className="text-xs text-slate-500 mb-3">
                          Export data to Google Sheets. Supports{" "}
                          <span className="font-semibold">variables</span> like{" "}
                          <code className="px-1 bg-slate-100 rounded">
                            {"{{customer.name}}"}
                          </code>
                          ,{" "}
                          <code className="px-1 bg-slate-100 rounded">
                            {"{{customer.email}}"}
                          </code>
                          ,{" "}
                          <code className="px-1 bg-slate-100 rounded">
                            {"{{trigger.message}}"}
                          </code>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Spreadsheet ID
                          </label>
                          <input
                            type="text"
                            placeholder="From spreadsheet URL: docs.google.com/spreadsheets/d/SPREADSHEET_ID/..."
                            value={selectedNode.config?.spreadsheetId || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  spreadsheetId: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Copy from the URL between /d/ and /edit
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Sheet Name
                          </label>
                          <input
                            type="text"
                            placeholder="Sheet1"
                            value={selectedNode.config?.sheetName || "Sheet1"}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  sheetName: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Row Values (Comma-Separated)
                          </label>
                          <textarea
                            rows={3}
                            placeholder={`{{customer.name}}, {{customer.email}}, {{customer.phone}}, {{trigger.message}}, {{workflow.timestamp}}`}
                            value={selectedNode.config?.valuesString || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  valuesString: e.target.value,
                                  values: e.target.value
                                    .split(",")
                                    .map((v) => v.trim()),
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Use variables or plain text. Order matches your
                            spreadsheet columns.
                          </p>
                        </div>

                        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedNode.config?.saveAsLead || false}
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    saveAsLead: e.target.checked,
                                  },
                                })
                              }
                            />
                            <span>
                              <span className="block text-sm text-indigo-800 font-medium">
                                Save as Lead Capture
                              </span>
                              <span className="block text-xs text-indigo-600">
                                Also save this data to the internal leads
                                database for tracking and follow-up.
                              </span>
                            </span>
                          </label>
                        </div>

                        {selectedNode.config?.saveAsLead && (
                          <div className="space-y-3 border-l-2 border-indigo-300 pl-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Lead Name (Variable)
                              </label>
                              <input
                                type="text"
                                placeholder="{{customer.name}}"
                                value={selectedNode.config?.leadName || ""}
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      leadName: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Lead Email (Variable)
                              </label>
                              <input
                                type="text"
                                placeholder="{{customer.email}}"
                                value={selectedNode.config?.leadEmail || ""}
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      leadEmail: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Lead Phone (Variable)
                              </label>
                              <input
                                type="text"
                                placeholder="{{customer.phone}}"
                                value={selectedNode.config?.leadPhone || ""}
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      leadPhone: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Notes (Optional)
                              </label>
                              <textarea
                                rows={2}
                                placeholder="{{trigger.message}} or custom notes"
                                value={selectedNode.config?.leadNotes || ""}
                                onChange={(e) =>
                                  updateNode(selectedNode.id, {
                                    config: {
                                      ...selectedNode.config,
                                      leadNotes: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm resize-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Specific Configuration: AI Generate */}
                    {selectedNode.label === "AI Generate" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            System Prompt (Persona)
                          </label>
                          <textarea
                            rows={4}
                            placeholder="You are a helpful assistant..."
                            value={selectedNode.config?.systemPrompt || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  systemPrompt: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Define the AI's personality and instructions.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Initial Message (Welcome)
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Hello! How can I help you?"
                            value={selectedNode.config?.initialMessage || ""}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                config: {
                                  ...selectedNode.config,
                                  initialMessage: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            The first thing the AI says when this node runs.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <button
                      onClick={() => handleDeleteNode(selectedNode.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
                    >
                      <Trash2 size={16} /> Delete Node
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edge Configuration Panel */}
            {selectedEdgeId &&
              (() => {
                const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
                const sourceNode = selectedEdge
                  ? nodes.find((n) => n.id === selectedEdge.source)
                  : null;
                const targetNode = selectedEdge
                  ? nodes.find((n) => n.id === selectedEdge.target)
                  : null;

                return selectedEdge ? (
                  <div className="fixed inset-0 z-40 md:static md:z-auto md:inset-auto md:w-80 md:shrink-0">
                    <div
                      className="absolute inset-0 bg-black/50 md:hidden"
                      onClick={() => setSelectedEdgeId(null)}
                    />
                    <div className="absolute right-0 top-0 h-full w-[90vw] max-w-sm bg-white border-l border-slate-200 overflow-y-auto shadow-xl md:static md:h-full md:w-80 md:max-w-none">
                      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between md:hidden">
                        <div className="flex items-center gap-2">
                          <GitBranch size={16} className="text-slate-600" />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Connection
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedEdgeId(null)}
                          className="text-slate-400 hover:text-slate-600"
                          type="button"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <GitBranch size={20} className="text-slate-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800">
                              Connection
                            </h3>
                            <p className="text-xs text-slate-500">
                              {sourceNode?.label} → {targetNode?.label}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              Edge Label
                            </label>
                            {sourceNode?.type === "condition" ? (
                              <select
                                value={
                                  (selectedEdge.label || "").toLowerCase() === "no"
                                    ? "no"
                                    : "yes"
                                }
                                onChange={(e) =>
                                  updateEdge(selectedEdgeId, {
                                    label: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="yes">yes</option>
                                <option value="no">no</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={selectedEdge.label || ""}
                                onChange={(e) =>
                                  updateEdge(selectedEdgeId, {
                                    label: e.target.value || undefined,
                                  })
                                }
                                placeholder="Optional label..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">
                              {sourceNode?.type === "condition"
                                ? 'For Condition nodes, use "yes" or "no" to route based on the condition result.'
                                : "Labels help document the flow and are used by some node types for routing."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 border-t border-slate-100 bg-slate-50">
                        <button
                          onClick={() => handleDeleteEdge(selectedEdgeId)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
                        >
                          <Trash2 size={16} /> Delete Connection
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && workflowToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Trash2 size={24} className="text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  Delete Workflow
                </h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-600">
                Are you sure you want to delete{" "}
                <span className="font-bold text-slate-900">
                  "{workflowToDelete.name}"
                </span>
                ?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This action cannot be undone. All
                  workflow nodes, edges, and configurations will be permanently
                  deleted.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={handleDeleteWorkflowCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkflowConfirm}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Modal */}
      <ConfirmationModal
        isOpen={showUnsavedChangesModal}
        title="Unsaved Changes"
        message="You have unsaved changes. Save the workflow first to test with the latest configuration (including edge labels). Test anyway?"
        confirmLabel="Test Anyway"
        cancelLabel="Go Back"
        onConfirm={handleUnsavedChangesConfirm}
        onCancel={handleUnsavedChangesCancel}
        isDestructive={false}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() =>
          setAlertModal({ isOpen: false, title: "", message: "", type: "info" })
        }
      />

      {/* Label Management Modal */}
      {showLabelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Manage Labels
              </h3>
              <button
                onClick={() => setShowLabelModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddLabel();
                    }
                  }}
                  placeholder="Add a label..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleAddLabel}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-slate-50 rounded-lg border border-slate-200">
                {editingLabels.length === 0 ? (
                  <p className="text-sm text-slate-400">No labels yet</p>
                ) : (
                  editingLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full"
                    >
                      {label}
                      <button
                        onClick={() => handleRemoveLabel(label)}
                        className="hover:text-indigo-900"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLabelModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLabels}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workflows;
