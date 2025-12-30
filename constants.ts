import {
  ChannelType,
  Conversation,
  ConversationStatus,
  MessageSender,
  Sentiment,
  Integration,
  Metric,
  User,
  PhoneNumber,
  Workflow,
} from "./types";

export const CURRENT_USER: User = {
  id: "agent-1",
  name: "Sarah Jenkins",
  email: "sarah@connectflo.com",
  role: "AGENT",
  avatar: "https://picsum.photos/id/1005/200/200",
};

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "c-1",
    channel: ChannelType.VOICE,
    status: ConversationStatus.OPEN,
    priority: "HIGH",
    customer: {
      id: "cust-1",
      name: "Alice Freeman",
      email: "alice.f@example.com",
      role: "CUSTOMER",
      avatar: "https://picsum.photos/id/338/200/200",
    },
    sentiment: Sentiment.NEGATIVE,
    tags: ["billing", "urgent"],
    lastActivity: new Date().toISOString(),
    isVoiceActive: true,
    messages: [
      {
        id: "m-1-1",
        sender: MessageSender.SYSTEM,
        content: "Call started via IVR. Customer verified.",
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
      {
        id: "m-1-2",
        sender: MessageSender.AI,
        content:
          "Hello Alice, I see you are calling about your recent invoice #INV-2024. Is that correct?",
        timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
      },
      {
        id: "m-1-3",
        sender: MessageSender.CUSTOMER,
        content: "Yes, I was overcharged. This is ridiculous!",
        timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      },
    ],
  },
  {
    id: "c-2",
    channel: ChannelType.CHAT,
    status: ConversationStatus.OPEN,
    priority: "MEDIUM",
    customer: {
      id: "cust-2",
      name: "Bob Smith",
      email: "bob.smith@gmail.com",
      role: "CUSTOMER",
      avatar: "https://picsum.photos/id/64/200/200",
    },
    sentiment: Sentiment.NEUTRAL,
    tags: ["product-inquiry"],
    lastActivity: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    messages: [
      {
        id: "m-2-1",
        sender: MessageSender.CUSTOMER,
        content: "Hi, does the new model support 5G?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
      {
        id: "m-2-2",
        sender: MessageSender.AI,
        content: "Yes, Bob! The X-2000 model fully supports global 5G bands.",
        timestamp: new Date(Date.now() - 1000 * 60 * 59).toISOString(),
      },
      {
        id: "m-2-3",
        sender: MessageSender.CUSTOMER,
        content: "Great, and what about battery life?",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
    ],
  },
  {
    id: "c-3",
    channel: ChannelType.EMAIL,
    status: ConversationStatus.PENDING,
    priority: "LOW",
    subject: "Feature Request: Dark Mode",
    customer: {
      id: "cust-3",
      name: "Charlie Davis",
      email: "charlie@techcorp.io",
      role: "CUSTOMER",
      avatar: "https://picsum.photos/id/1025/200/200",
    },
    sentiment: Sentiment.POSITIVE,
    tags: ["feedback"],
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    messages: [
      {
        id: "m-3-1",
        sender: MessageSender.CUSTOMER,
        content:
          "Hey team, loving the app. Just wondering when dark mode is coming?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      },
      {
        id: "m-3-2",
        sender: MessageSender.AGENT,
        content:
          "Hi Charlie! Thanks for the love. Dark mode is on our roadmap for Q3.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
    ],
  },
];

export const MOCK_METRICS: Metric[] = [
  { label: "Active Conversations", value: 24, change: 12, trend: "UP" },
  { label: "AI Resolution Rate", value: "68%", change: 5, trend: "UP" },
  { label: "Avg Response Time", value: "1m 42s", change: -8, trend: "DOWN" }, // Down is good for time
  { label: "CSAT Score", value: 4.8, change: 0, trend: "FLAT" },
];

export const MOCK_INTEGRATIONS: Integration[] = [
  // Ecommerce
  {
    id: "int-shop",
    name: "Shopify",
    category: "ECOMMERCE",
    connected: true,
    description: "Sync orders, customers, and inventory status.",
    icon: "https://cdn.simpleicons.org/shopify",
  },
  {
    id: "int-woo",
    name: "WooCommerce",
    category: "ECOMMERCE",
    connected: false,
    description: "Connect your WordPress store for support.",
    icon: "https://cdn.simpleicons.org/woocommerce",
  },
  {
    id: "int-mag",
    name: "Magento",
    category: "ECOMMERCE",
    connected: false,
    description: "Enterprise ecommerce data synchronization.",
    icon: "https://cdn.simpleicons.org/magento",
  },
  {
    id: "int-bigc",
    name: "BigCommerce",
    category: "ECOMMERCE",
    connected: false,
    description: "Unified retail operations sync.",
    icon: "https://cdn.simpleicons.org/bigcommerce",
  },

  // CRM
  {
    id: "int-sf",
    name: "Salesforce",
    category: "CRM",
    connected: false,
    description: "Two-way sync for leads and contacts.",
    icon: "https://cdn.simpleicons.org/salesforce",
  },
  {
    id: "int-hub",
    name: "HubSpot",
    category: "CRM",
    connected: true,
    description: "Marketing and sales pipeline visibility.",
    icon: "https://cdn.simpleicons.org/hubspot",
  },
  {
    id: "int-zoho",
    name: "Zoho CRM",
    category: "CRM",
    connected: false,
    description: "Customer relationship management integration.",
    icon: "https://cdn.simpleicons.org/zoho",
  },
  {
    id: "int-pipe",
    name: "Pipedrive",
    category: "CRM",
    connected: false,
    description: "Sales CRM for deal tracking.",
    icon: "https://cdn.simpleicons.org/pipedrive",
  },
  {
    id: "int-odoo",
    name: "Odoo",
    category: "CRM",
    connected: false,
    description: "All-in-one management software integration.",
    icon: "https://cdn.simpleicons.org/odoo",
  },

  // Database
  {
    id: "int-pg",
    name: "PostgreSQL",
    category: "DATABASE",
    connected: false,
    description: "Connect your primary SQL database for RAG.",
    icon: "https://cdn.simpleicons.org/postgresql",
  },
  {
    id: "int-mongo",
    name: "MongoDB",
    category: "DATABASE",
    connected: false,
    description: "NoSQL document storage connection.",
    icon: "https://cdn.simpleicons.org/mongodb",
  },
  {
    id: "int-mysql",
    name: "MySQL",
    category: "DATABASE",
    connected: false,
    description: "Relational database connection.",
    icon: "https://cdn.simpleicons.org/mysql",
  },
  {
    id: "int-snow",
    name: "Snowflake",
    category: "DATABASE",
    connected: false,
    description: "Cloud data warehousing for analytics.",
    icon: "https://cdn.simpleicons.org/snowflake",
  },

  // Ticketing
  {
    id: "int-jira",
    name: "Jira",
    category: "TICKETING",
    connected: true,
    description: "Create and link engineering issues from chats.",
    icon: "https://cdn.simpleicons.org/jira",
  },
  {
    id: "int-zendesk",
    name: "Zendesk",
    category: "TICKETING",
    connected: false,
    description: "Sync tickets and help center articles.",
    icon: "https://cdn.simpleicons.org/zendesk",
  },
  {
    id: "int-service",
    name: "ServiceNow",
    category: "TICKETING",
    connected: false,
    description: "Enterprise IT service management workflows.",
    icon: "https://cdn.simpleicons.org/servicenow",
  },
  {
    id: "int-fresh",
    name: "Freshdesk",
    category: "TICKETING",
    connected: false,
    description: "Customer support ticket synchronization.",
    icon: "https://cdn.simpleicons.org/fresh",
  },

  // Communication
  {
    id: "int-slack",
    name: "Slack",
    category: "COMMUNICATION",
    connected: true,
    description: "Notify channels about urgent tickets and VIPs.",
    icon: "https://cdn.simpleicons.org/slack",
  },
  {
    id: "int-teams",
    name: "MS Teams",
    category: "COMMUNICATION",
    connected: false,
    description: "Microsoft ecosystem collaboration.",
    icon: "https://cdn.simpleicons.org/microsoftteams",
  },
  {
    id: "int-gcal",
    name: "Google Calendar",
    category: "COMMUNICATION",
    connected: false,
    description: "Schedule meetings and check availability automatically.",
    icon: "https://cdn.simpleicons.org/googlecalendar",
  },
  {
    id: "int-gmail",
    name: "Gmail",
    category: "COMMUNICATION",
    connected: false,
    description: "Send professional emails with better deliverability.",
    icon: "https://cdn.simpleicons.org/gmail",
  },
  {
    id: "int-discord",
    name: "Discord",
    category: "COMMUNICATION",
    connected: false,
    description: "Community server integration and support.",
    icon: "https://cdn.simpleicons.org/discord",
  },
  {
    id: "int-whatsapp",
    name: "WhatsApp",
    category: "COMMUNICATION",
    connected: true,
    description: "Official Business API for messaging.",
    icon: "https://cdn.simpleicons.org/whatsapp",
  },

  // Accounting
  {
    id: "int-stripe",
    name: "Stripe",
    category: "ACCOUNTING",
    connected: true,
    description: "View payments, subscriptions and process refunds.",
    icon: "https://cdn.simpleicons.org/stripe",
  },
  {
    id: "int-paypal",
    name: "PayPal",
    category: "ACCOUNTING",
    connected: false,
    description: "Payment gateway integration for status checks.",
    icon: "https://cdn.simpleicons.org/paypal",
  },
  {
    id: "int-qb",
    name: "QuickBooks",
    category: "ACCOUNTING",
    connected: false,
    description: "Invoicing and accounting synchronization.",
    icon: "https://cdn.simpleicons.org/quickbooks",
  },
  {
    id: "int-xero",
    name: "Xero",
    category: "ACCOUNTING",
    connected: false,
    description: "Small business accounting data.",
    icon: "https://cdn.simpleicons.org/xero",
  },

  // Storage
  {
    id: "int-drive",
    name: "Google Drive",
    category: "STORAGE",
    connected: false,
    description: "Upload files and share documents automatically.",
    icon: "https://cdn.simpleicons.org/googledrive",
  },
  {
    id: "int-sheets",
    name: "Google Sheets",
    category: "STORAGE",
    connected: false,
    description: "Log conversations and data to spreadsheets.",
    icon: "https://cdn.simpleicons.org/googlesheets",
  },
  {
    id: "int-dropbox",
    name: "Dropbox",
    category: "STORAGE",
    connected: false,
    description: "File hosting service integration.",
    icon: "https://cdn.simpleicons.org/dropbox",
  },
  {
    id: "int-aws",
    name: "AWS S3",
    category: "STORAGE",
    connected: false,
    description: "Object storage buckets for logs/files.",
    icon: "https://cdn.simpleicons.org/amazons3",
  },

  // Analytics
  {
    id: "int-ga",
    name: "Google Analytics",
    category: "ANALYTICS",
    connected: false,
    description: "Track support widget usage on site.",
    icon: "https://cdn.simpleicons.org/googleanalytics",
  },
  {
    id: "int-mix",
    name: "Mixpanel",
    category: "ANALYTICS",
    connected: false,
    description: "Product usage analytics integration.",
    icon: "https://cdn.simpleicons.org/mixpanel",
  },
];

export const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: "wf-1",
    name: "Order Status Automation",
    description:
      'Automatically checks Shopify for order status when a customer asks "Where is my order?".',
    isActive: true,
    triggerType: "Intent: Check Order",
    runs: 1245,
    lastRun: "2 mins ago",
    nodes: [
      {
        id: "n1",
        type: "trigger",
        label: "Intent Detected",
        subLabel: "Where is my order?",
        x: 300,
        y: 50,
      },
      {
        id: "n2",
        type: "action",
        label: "Extract Order ID",
        subLabel: "From message entities",
        x: 300,
        y: 180,
      },
      {
        id: "n3",
        type: "integration",
        label: "Fetch Shopify Order",
        subLabel: "GET /orders/{id}",
        x: 300,
        y: 310,
        icon: "https://cdn.simpleicons.org/shopify",
      },
      { id: "n4", type: "condition", label: "Order Found?", x: 300, y: 440 },
      {
        id: "n5",
        type: "action",
        label: "Reply: Status",
        subLabel: "Send shipping info",
        x: 150,
        y: 580,
      },
      {
        id: "n6",
        type: "action",
        label: "Reply: Not Found",
        subLabel: "Ask for details",
        x: 450,
        y: 580,
      },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
      { id: "e4", source: "n4", target: "n5", label: "Yes" },
      { id: "e5", source: "n4", target: "n6", label: "No" },
    ],
  },
  {
    id: "wf-2",
    name: "Negative Sentiment Escalation",
    description:
      "Routes highly negative conversations to the VIP support team instantly.",
    isActive: true,
    triggerType: "Sentiment: Negative",
    runs: 89,
    lastRun: "1 hour ago",
    nodes: [
      {
        id: "n1",
        type: "trigger",
        label: "Sentiment: Negative",
        x: 300,
        y: 50,
      },
      {
        id: "n2",
        type: "action",
        label: "Tag Conversation",
        subLabel: "Tags: Urgent, Risk",
        x: 300,
        y: 180,
      },
      {
        id: "n3",
        type: "action",
        label: "Notify Manager",
        subLabel: "Via Slack",
        x: 300,
        y: 310,
        icon: "https://cdn.simpleicons.org/slack",
      },
      {
        id: "n4",
        type: "action",
        label: "Assign to Team",
        subLabel: "Team: Retention",
        x: 300,
        y: 440,
      },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
    ],
  },
];

// --- New Analytics Data ---

export const MOCK_AGENT_LEADERBOARD = [
  {
    id: 1,
    name: "Sarah Jenkins",
    resolved: 145,
    csat: 4.9,
    avgTime: "3m 12s",
    avatar: "https://picsum.photos/id/1005/100/100",
  },
  {
    id: 2,
    name: "Mike Chen",
    resolved: 132,
    csat: 4.7,
    avgTime: "2m 58s",
    avatar: "https://picsum.photos/id/1012/100/100",
  },
  {
    id: 3,
    name: "Jessica Alva",
    resolved: 98,
    csat: 4.8,
    avgTime: "4m 05s",
    avatar: "https://picsum.photos/id/1027/100/100",
  },
  {
    id: 4,
    name: "Tom Wilson",
    resolved: 87,
    csat: 4.5,
    avgTime: "3m 45s",
    avatar: "https://picsum.photos/id/300/100/100",
  },
];

export const MOCK_SENTIMENT_HISTORY = [
  { time: "09:00", positive: 65, neutral: 25, negative: 10 },
  { time: "10:00", positive: 60, neutral: 30, negative: 10 },
  { time: "11:00", positive: 55, neutral: 25, negative: 20 },
  { time: "12:00", positive: 70, neutral: 20, negative: 10 },
  { time: "13:00", positive: 75, neutral: 15, negative: 10 },
  { time: "14:00", positive: 65, neutral: 30, negative: 5 },
];

export const MOCK_VOICE_COSTS = [
  { day: "Mon", cost: 14.5, minutes: 120 },
  { day: "Tue", cost: 18.2, minutes: 145 },
  { day: "Wed", cost: 12.1, minutes: 98 },
  { day: "Thu", cost: 22.5, minutes: 180 },
  { day: "Fri", cost: 19.0, minutes: 160 },
];

export const MOCK_INTENTS = [
  { name: "Order Status", value: 450 },
  { name: "Refund Request", value: 300 },
  { name: "Product Info", value: 210 },
  { name: "Technical Issue", value: 150 },
  { name: "Shipping", value: 90 },
];
