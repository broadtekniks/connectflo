import React, { useState, useRef, useEffect } from "react";
import { MOCK_WORKFLOWS } from "../constants";
import { Workflow, WorkflowNode, WorkflowEdge, PhoneNumber } from "../types";
import { api } from "../services/api";
import {
  Zap,
  Play,
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
} from "lucide-react";

const API_URL = "http://localhost:3002/api";

const authHeader = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// --- Component Library Definition ---

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
      {
        label: "Intent Detected",
        icon: Zap,
        type: "trigger",
        subLabel: "AI Analysis",
      },
      {
        label: "Sentiment Negative",
        icon: Shield,
        type: "trigger",
        subLabel: "AI Analysis",
      },
      {
        label: "SLA Breached",
        icon: Clock,
        type: "trigger",
        subLabel: "Time limit exceeded",
      },
      {
        label: "New Order",
        icon: ShoppingBag,
        type: "trigger",
        subLabel: "E-commerce Event",
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
    category: "Integrations",
    color: "text-blue-600",
    bg: "bg-white",
    border: "border-blue-200",
    items: [
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

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const data = await api.workflows.list();
      setWorkflows(data);
    } catch (error) {
      console.error("Failed to load workflows:", error);
    }
  };

  // Builder State
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Interaction State
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeSimNodeId, setActiveSimNodeId] = useState<string | null>(null);

  // Dragging Nodes
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connecting Nodes
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(
    null
  );
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [ownedNumbers, setOwnedNumbers] = useState<PhoneNumber[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(
    null
  );
  const [workflowResources, setWorkflowResources] = useState<any>({
    phoneNumbers: [],
    documents: [],
    integrations: [],
    aiConfig: null,
  });
  const [availableDocuments, setAvailableDocuments] = useState<any[]>([]);
  const [availableIntegrations, setAvailableIntegrations] = useState<any[]>([]);
  const [availableAiConfigs, setAvailableAiConfigs] = useState<any[]>([]);
  const [planLimits, setPlanLimits] = useState<any>({
    maxPhoneNumbersPerWorkflow: 2,
    maxDocumentsPerWorkflow: 10,
    maxIntegrationsPerWorkflow: 3,
  });
  const [isGeneratingGreeting, setIsGeneratingGreeting] = useState(false);

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
      const docsResponse = await fetch(`${API_URL}/knowledge-base/documents`, {
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

  // --- Logic ---

  const handleEdit = (workflow: Workflow) => {
    setSelectedWorkflowMeta(workflow);
    // Deep copy to separate builder state from mock data
    setNodes(JSON.parse(JSON.stringify(workflow.nodes)));
    setEdges(JSON.parse(JSON.stringify(workflow.edges)));
    setView("builder");
    setIsSimulating(false);
    setActiveSimNodeId(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const handleNewWorkflow = async () => {
    try {
      const newWorkflow = await api.workflows.create({
        name: "Untitled Workflow",
        description: "New workflow description",
        triggerType: "Manual",
      });
      setSelectedWorkflowMeta(newWorkflow);
      setNodes([]);
      setEdges([]);
      setView("builder");
      setIsSimulating(false);
      setActiveSimNodeId(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      loadWorkflows();
    } catch (error) {
      console.error("Failed to create workflow:", error);
    }
  };

  const handleSave = async () => {
    if (!selectedWorkflowMeta) return;

    // Infer trigger type from the canvas
    const triggerNode = nodes.find((n) => n.type === "trigger");
    const triggerType = triggerNode ? triggerNode.label : "Manual";

    try {
      await api.workflows.update(selectedWorkflowMeta.id, {
        ...selectedWorkflowMeta,
        nodes,
        edges,
        triggerType,
        isActive: true, // Auto-activate for now so testing works immediately
      });
      loadWorkflows();
      setView("list");
    } catch (error) {
      console.error("Failed to save workflow:", error);
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
    setIsSimulating(true);

    // Trigger backend simulation
    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (triggerNode) {
      api.workflows
        .simulate(triggerNode.label, { source: "simulator" })
        .catch(console.error);
    }

    // Simple linear simulation for demo visualization
    // Real simulation would traverse the graph based on edges
    let i = 0;
    const nodesToVisit = nodes.map((n) => n.id); // Naive path just for visual effect

    const interval = setInterval(() => {
      if (i >= nodesToVisit.length) {
        clearInterval(interval);
        setIsSimulating(false);
        setActiveSimNodeId(null);
        return;
      }
      setActiveSimNodeId(nodesToVisit[i]);
      i++;
    }, 800);
  };

  // --- Drag and Drop (Sidebar -> Canvas) ---

  const handleDragStart = (e: React.DragEvent, item: any) => {
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

    const reactFlowBounds = canvasRef.current.getBoundingClientRect();
    const itemData = e.dataTransfer.getData("application/reactflow");

    if (!itemData) return;

    const item = JSON.parse(itemData);

    // Calculate position relative to canvas
    const position = {
      x: e.clientX - reactFlowBounds.left - 128, // Center the node (width 256/2)
      y: e.clientY - reactFlowBounds.top - 20, // Offset slightly
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
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setIsDraggingNode(true);
    setDraggedNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null); // Deselect edge when clicking node

    // Calculate offset so we drag from the point clicked
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    });
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

      // Initial mouse pos for the temp line
      if (canvasRef.current) {
        const bounds = canvasRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - bounds.left,
          y: e.clientY - bounds.top,
        });
      }
    } else if (type === "target" && connectingSourceId) {
      // Complete the connection
      if (connectingSourceId === nodeId) return; // No self-loops

      // Check if edge already exists
      const exists = edges.find(
        (edge) => edge.source === connectingSourceId && edge.target === nodeId
      );
      if (!exists) {
        const newEdge: WorkflowEdge = {
          id: `e-${connectingSourceId}-${nodeId}`,
          source: connectingSourceId,
          target: nodeId,
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

  // --- Global Canvas Mouse Events ---

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;

    if (isDraggingNode && draggedNodeId) {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === draggedNodeId) {
            return {
              ...node,
              x: e.clientX - dragOffset.x,
              y: e.clientY - dragOffset.y,
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
          <div className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0 z-10 relative shadow-sm">
            <div className="flex items-center gap-4">
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
                className="font-bold text-lg text-slate-800 border-none focus:ring-0 bg-transparent placeholder-slate-400 hover:bg-slate-50 rounded px-2 -ml-2 transition-colors"
                placeholder="Workflow Name"
              />
              <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-bold rounded border border-green-100">
                Active
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-400 mr-2 hidden md:block">
                <span className="font-semibold">Hint:</span> Drag nodes from
                sidebar. Click ports to connect. Del to remove.
              </div>
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
              <button
                onClick={handleSave}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Save Changes
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Components (Always Visible) */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Component Library
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {COMPONENT_LIBRARY.map((category, idx) => (
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

            {/* Center: Canvas Area */}
            <div
              className="flex-1 bg-slate-50 relative overflow-hidden cursor-default"
              style={{
                backgroundImage:
                  "radial-gradient(#cbd5e1 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
              ref={canvasRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
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

              {/* Controls */}
              <div className="absolute bottom-8 right-8 flex gap-2 bg-white p-1.5 rounded-lg shadow-md border border-slate-200 z-20">
                <button className="p-2 rounded hover:bg-slate-50 text-slate-600 font-bold">
                  -
                </button>
                <span className="px-2 py-2 text-xs font-bold text-slate-600 flex items-center">
                  100%
                </span>
                <button className="p-2 rounded hover:bg-slate-50 text-slate-600 font-bold">
                  +
                </button>
              </div>
            </div>

            {/* Right Sidebar: Node Properties (Conditional) */}
            {selectedNode && (
              <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 z-30 animate-in slide-in-from-right duration-200 shadow-xl">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Settings2 size={14} /> Node Properties
                  </h3>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    className="text-slate-400 hover:text-slate-600"
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
            )}
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
    </div>
  );
};

export default Workflows;
