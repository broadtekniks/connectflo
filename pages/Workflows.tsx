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

// --- Component Library Definition ---

const CONFIG_CATEGORY_NAME = "Configuration";
const CONFIG_NODE_LABELS = new Set([
  "Knowledge Base",
  "AI Configuration",
  "Phone Voice",
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
        label: "Phone Voice",
        icon: Phone,
        type: "config",
        subLabel: "Voice & language",
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
    ],
  },
  {
    category: "Available Integrations",
    color: "text-blue-600",
    bg: "bg-white",
    border: "border-blue-200",
    items: [
      {
        label: "Create Calendar Event",
        icon: Calendar,
        type: "integration",
        subLabel: "Google Calendar",
        provider: "google",
      },
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
      },
      {
        label: "HubSpot Create",
        iconUrl: "https://cdn.simpleicons.org/hubspot",
        type: "integration",
        subLabel: "New lead",
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
    const operators = selectedField?.allowedOperators || [
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "contains",
    ];

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
                placeholder="Enter value or {{variable}}"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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

  useEffect(() => {
    loadWorkflows();
    fetchConnectedIntegrations();
  }, []);

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
      // The response.integrations array already contains only connected integrations
      setConnectedIntegrations(response.integrations);
      console.log("[Workflows] Connected integrations state set to:", response.integrations);
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

  // Workflow-level configuration (persistent resources, not canvas nodes)
  const [activeWorkflowConfigPanel, setActiveWorkflowConfigPanel] = useState<
    null | "knowledgeBase" | "aiConfig" | "phoneVoice"
  >(null);

  const configCategory = COMPONENT_LIBRARY.find(
    (c) => c.category === CONFIG_CATEGORY_NAME
  );
  const workflowConfigItems = configCategory?.items ?? [];

  // Filter integrations to only show connected ones
  const componentLibraryNonConfig = COMPONENT_LIBRARY.filter(
    (c) => c.category !== CONFIG_CATEGORY_NAME
  ).map((category) => {
    if (category.category === "Available Integrations") {
      console.log("[Workflows] Filtering integrations. connectedIntegrations:", connectedIntegrations);
      
      return {
        ...category,
        items: category.items.filter((item: any) => {
          // If item has a provider property, check if it's connected
          if (item.provider) {
            const isConnected = connectedIntegrations.some((i) => i.provider === item.provider);
            console.log(`[Workflows] ${item.label} (${item.provider}) is connected:`, isConnected);
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
    phoneVoiceId: null,
    phoneVoiceLanguage: null,
    toneOfVoice: null,
  });
  const [availableDocuments, setAvailableDocuments] = useState<any[]>([]);
  const [availableIntegrations, setAvailableIntegrations] = useState<any[]>([]);
  const [availableAiConfigs, setAvailableAiConfigs] = useState<any[]>([]);
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
        alert(error.error);
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
        alert(error.error);
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

  const setWorkflowPhoneVoice = async (
    phoneVoiceId: string,
    phoneVoiceLanguage: string
  ) => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/phone-voice`,
        {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify({ phoneVoiceId, phoneVoiceLanguage }),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      }
    } catch (error) {
      console.error("Failed to set workflow phone voice:", error);
    }
  };

  const clearWorkflowPhoneVoice = async () => {
    if (!selectedWorkflowMeta?.id) return;
    try {
      const response = await fetch(
        `${API_URL}/workflow-resources/${selectedWorkflowMeta.id}/phone-voice`,
        {
          method: "DELETE",
          headers: authHeader(),
        }
      );
      if (response.ok) {
        await loadWorkflowResources();
      }
    } catch (error) {
      console.error("Failed to clear workflow phone voice:", error);
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

  const getWorkflowConfigPanelKey = (
    label: string
  ): "knowledgeBase" | "aiConfig" | "phoneVoice" => {
    if (label === "Knowledge Base") return "knowledgeBase";
    if (label === "AI Configuration") return "aiConfig";
    return "phoneVoice";
  };

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

    if (saveStateResetTimeoutRef.current) {
      clearTimeout(saveStateResetTimeoutRef.current);
      saveStateResetTimeoutRef.current = null;
    }

    setWorkflowSaveState("saving");

    // Infer trigger type from the canvas
    const triggerNode = nodesToSave.find((n) => n.type === "trigger");
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
      alert("Failed to delete workflow. Please try again.");
    }
  };

  const handleDeleteWorkflowCancel = () => {
    setShowDeleteModal(false);
    setWorkflowToDelete(null);
  };

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
        if (sourceNode?.label === "Condition") {
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
              <button
                onClick={handleNewWorkflow}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
              >
                <Plus size={18} /> New Workflow
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {workflows.map((wf) => (
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
                      <div className="flex items-center gap-4 mt-2 text-xs font-medium text-slate-400">
                        <span className="flex items-center gap-1">
                          <Zap size={12} /> {wf.triggerType}
                        </span>
                        <span className="flex items-center gap-1">
                          <Play size={12} /> {wf.runs} runs
                        </span>
                        <span>Last run {wf.lastRun}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
              className="flex-1 bg-slate-50 relative overflow-hidden cursor-default"
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
                className="absolute inset-0"
                style={{
                  transform: `scale(${canvasScale})`,
                  transformOrigin: "0 0",
                  backgroundImage:
                    "radial-gradient(#cbd5e1 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
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
              <div className="fixed inset-0 z-40 md:static md:z-auto md:inset-auto md:w-80 md:shrink-0">
                <div
                  className="absolute inset-0 bg-black/50 md:hidden"
                  onClick={() => setActiveWorkflowConfigPanel(null)}
                />
                <div className="absolute right-0 top-0 h-full w-[90vw] max-w-sm bg-white border-l border-slate-200 flex flex-col z-40 animate-in slide-in-from-right duration-200 shadow-xl md:static md:h-auto md:w-80 md:max-w-none">
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

                    {activeWorkflowConfigPanel === "phoneVoice" && (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <Phone size={18} className="text-blue-700" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">
                              Phone Voice
                            </div>
                            <div className="text-xs text-slate-400">
                              Workflow-level voice preference for calls
                            </div>
                          </div>
                        </div>

                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                          Voice Override
                        </label>

                        {workflowResources.phoneVoiceId && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Phone size={14} className="text-blue-600" />
                                <span className="text-sm font-medium text-slate-700">
                                  {String(workflowResources.phoneVoiceId)}
                                </span>
                              </div>
                              <button
                                onClick={clearWorkflowPhoneVoice}
                                className="text-slate-400 hover:text-red-600"
                                type="button"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            {workflowResources.phoneVoiceLanguage && (
                              <p className="text-[10px] text-slate-500 mt-1">
                                Language:{" "}
                                {String(workflowResources.phoneVoiceLanguage)}
                              </p>
                            )}
                          </div>
                        )}

                        <select
                          value={workflowResources.phoneVoiceId || ""}
                          onChange={(e) => {
                            const voiceId = e.target.value;
                            if (!voiceId) {
                              clearWorkflowPhoneVoice();
                              return;
                            }
                            const voiceInfo = availablePhoneVoices.find(
                              (v) => v.id === voiceId
                            );
                            setWorkflowPhoneVoice(
                              voiceId,
                              voiceInfo?.language ? voiceInfo.language : ""
                            );
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">
                            Use system-wide phone voice settings
                          </option>
                          {availablePhoneVoices.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                              {voice.name || voice.id}
                              {voice.language ? ` (${voice.language})` : ""}
                            </option>
                          ))}
                        </select>

                        <p className="text-[10px] text-slate-400 mt-1">
                          If set, this overrides Settings → Phone Voice for this
                          workflow. The Incoming Call trigger can still override
                          voice per entry point.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedNode && !selectedEdgeId && (
              <div className="fixed inset-0 z-40 md:static md:z-auto md:inset-auto md:w-80 md:shrink-0">
                <div
                  className="absolute inset-0 bg-black/50 md:hidden"
                  onClick={() => setSelectedNodeId(null)}
                />
                <div className="absolute right-0 top-0 h-full w-[90vw] max-w-sm bg-white border-l border-slate-200 flex flex-col z-40 animate-in slide-in-from-right duration-200 shadow-xl md:static md:h-auto md:w-80 md:max-w-none">
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
                            Settings (and any workflow-level Phone Voice
                            override) for calls that enter via this Incoming
                            Call trigger.
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

                    {/* Google Calendar: Create Event */}
                    {selectedNode.label === "Create Calendar Event" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
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
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              Start Time
                            </label>
                            <input
                              type="datetime-local"
                              value={selectedNode.config?.startTime || ""}
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    startTime: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                              End Time
                            </label>
                            <input
                              type="datetime-local"
                              value={selectedNode.config?.endTime || ""}
                              onChange={(e) =>
                                updateNode(selectedNode.id, {
                                  config: {
                                    ...selectedNode.config,
                                    endTime: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
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
                        </div>
                      </div>
                    )}

                    {selectedNode.label === "Send Gmail" && (
                      <div className="pt-6 border-t border-slate-100 space-y-4">
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
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                            Spreadsheet ID
                          </label>
                          <input
                            type="text"
                            placeholder="From spreadsheet URL"
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
                          <input
                            type="text"
                            placeholder="value1, value2, value3"
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
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
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
                    <div className="absolute right-0 top-0 h-full w-[90vw] max-w-sm bg-white border-l border-slate-200 overflow-y-auto shadow-xl md:static md:h-auto md:w-80 md:max-w-none">
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
                            {sourceNode?.label === "Condition" && (
                              <div className="mt-2">
                                <p className="text-[10px] text-slate-500 mb-2">
                                  Quick labels for conditions:
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      updateEdge(selectedEdgeId, {
                                        label: "yes",
                                      })
                                    }
                                    className="flex-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold hover:bg-green-200 transition-colors"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() =>
                                      updateEdge(selectedEdgeId, {
                                        label: "no",
                                      })
                                    }
                                    className="flex-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold hover:bg-red-200 transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">
                              {sourceNode?.label === "Condition"
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
    </div>
  );
};

export default Workflows;
