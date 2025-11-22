export enum ChannelType {
  CHAT = "CHAT",
  EMAIL = "EMAIL",
  VOICE = "VOICE",
  SMS = "SMS",
}

export enum MessageSender {
  CUSTOMER = "CUSTOMER",
  AGENT = "AGENT",
  AI = "AI",
  SYSTEM = "SYSTEM",
}

export enum ConversationStatus {
  OPEN = "OPEN",
  PENDING = "PENDING",
  RESOLVED = "RESOLVED",
}

export enum Sentiment {
  POSITIVE = "POSITIVE",
  NEUTRAL = "NEUTRAL",
  NEGATIVE = "NEGATIVE",
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  role: "ADMIN" | "AGENT" | "CUSTOMER";
}

export interface Message {
  id: string;
  conversationId?: string;
  content: string;
  sender: MessageSender;
  timestamp: string; // ISO string
  isPrivateNote?: boolean;
  attachments?: string[];
}

export interface Conversation {
  id: string;
  customer: User;
  channel: ChannelType;
  status: ConversationStatus;
  subject?: string; // For email
  messages: Message[];
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee?: User;
  lastActivity: string;
  sentiment: Sentiment;
  tags: string[];
  isVoiceActive?: boolean; // Simulates a live call
}

export interface Metric {
  label: string;
  value: string | number;
  change: number; // Percentage
  trend: "UP" | "DOWN" | "FLAT";
}

export interface Integration {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  description: string;
  category:
    | "ECOMMERCE"
    | "DATABASE"
    | "CRM"
    | "TICKETING"
    | "COMMUNICATION"
    | "ACCOUNTING"
    | "ANALYTICS"
    | "STORAGE"
    | "OTHER";
}

export interface PhoneNumber {
  id: string;
  number: string;
  friendlyName: string;
  country: string; // ISO code e.g. US, GB
  region: string;
  type: "local" | "toll-free" | "mobile";
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  monthlyCost: number;
  setupCost?: number;
  status: "active" | "available";
}

// Workflow Types
export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "integration";
  label: string;
  subLabel?: string;
  x: number;
  y: number;
  icon?: string;
  config?: any;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string; // e.g., "Yes", "No"
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  triggerType: string;
  runs: number;
  lastRun: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
