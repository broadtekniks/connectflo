import prisma from "../lib/prisma";

export enum OperatorType {
  // Equality
  EQUALS = "equals",
  NOT_EQUALS = "not_equals",

  // Numeric
  GREATER_THAN = "greater_than",
  LESS_THAN = "less_than",
  GREATER_EQUAL = "greater_equal",
  LESS_EQUAL = "less_equal",

  // String
  CONTAINS = "contains",
  NOT_CONTAINS = "not_contains",
  STARTS_WITH = "starts_with",
  ENDS_WITH = "ends_with",
  MATCHES_REGEX = "matches_regex",

  // Existence
  IS_EMPTY = "is_empty",
  IS_NOT_EMPTY = "is_not_empty",
  EXISTS = "exists",
  NOT_EXISTS = "not_exists",

  // Arrays
  INCLUDES = "includes",
  NOT_INCLUDES = "not_includes",
  COUNT = "count",

  // Time
  IS_WITHIN_LAST = "is_within_last",
  IS_OLDER_THAN = "is_older_than",
  IS_BETWEEN = "is_between",
  IS_BEFORE = "is_before",
  IS_AFTER = "is_after",

  // Special
  IN = "in",
  NOT_IN = "not_in",
}

export interface FieldSchema {
  path: string;
  label: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object";
  category: string;
  description?: string;
  allowedOperators: OperatorType[];
  examples?: string[];
}

// Base schema - core fields available to all workflows
const BASE_SCHEMA: FieldSchema[] = [
  // Customer fields
  {
    path: "customer.name",
    label: "Customer Name",
    type: "string",
    category: "Customer",
    description: "Full name of the customer",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.NOT_EQUALS,
      OperatorType.CONTAINS,
      OperatorType.STARTS_WITH,
      OperatorType.ENDS_WITH,
      OperatorType.IS_EMPTY,
      OperatorType.IS_NOT_EMPTY,
      OperatorType.EXISTS,
    ],
    examples: ["John Doe", "{{workflow.customerName}}"],
  },
  {
    path: "customer.email",
    label: "Customer Email",
    type: "string",
    category: "Customer",
    description: "Email address of the customer",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.NOT_EQUALS,
      OperatorType.CONTAINS,
      OperatorType.ENDS_WITH,
      OperatorType.MATCHES_REGEX,
      OperatorType.IS_EMPTY,
      OperatorType.EXISTS,
    ],
    examples: ["user@example.com", "{{trigger.email}}"],
  },
  {
    path: "customer.phone",
    label: "Customer Phone",
    type: "string",
    category: "Customer",
    description: "Phone number of the customer",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.CONTAINS,
      OperatorType.STARTS_WITH,
      OperatorType.EXISTS,
    ],
    examples: ["+1234567890", "{{call.from}}"],
  },
  {
    path: "customer.id",
    label: "Customer ID",
    type: "string",
    category: "Customer",
    description: "Unique identifier for the customer",
    allowedOperators: [OperatorType.EQUALS, OperatorType.EXISTS],
    examples: ["uuid-123", "{{trigger.customerId}}"],
  },

  // Conversation fields
  {
    path: "conversation.id",
    label: "Conversation ID",
    type: "string",
    category: "Conversation",
    description: "Unique identifier for the conversation",
    allowedOperators: [OperatorType.EQUALS, OperatorType.EXISTS],
    examples: ["conv-123"],
  },
  {
    path: "conversation.channel",
    label: "Conversation Channel",
    type: "string",
    category: "Conversation",
    description: "Communication channel (voice, chat, sms, etc.)",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.NOT_EQUALS,
      OperatorType.IN,
    ],
    examples: ["voice", "chat", "sms", "email"],
  },
  {
    path: "conversation.status",
    label: "Conversation Status",
    type: "string",
    category: "Conversation",
    description: "Current status of the conversation",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.NOT_EQUALS,
      OperatorType.IN,
    ],
    examples: ["active", "pending", "resolved", "closed"],
  },
  {
    path: "conversation.sentiment",
    label: "Conversation Sentiment",
    type: "string",
    category: "Conversation",
    description: "AI-detected sentiment of the conversation",
    allowedOperators: [OperatorType.EQUALS, OperatorType.NOT_EQUALS],
    examples: ["positive", "negative", "neutral"],
  },
  {
    path: "conversation.intent",
    label: "Detected Intent",
    type: "string",
    category: "Conversation",
    description: "AI-detected intent of the conversation",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.CONTAINS,
      OperatorType.IN,
    ],
    examples: ["cancel_subscription", "request_refund", "support_query"],
  },
  {
    path: "conversation.messageCount",
    label: "Message Count",
    type: "number",
    category: "Conversation",
    description: "Total number of messages in the conversation",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.GREATER_THAN,
      OperatorType.LESS_THAN,
      OperatorType.GREATER_EQUAL,
      OperatorType.LESS_EQUAL,
    ],
    examples: ["10", "{{workflow.maxMessages}}"],
  },

  // Call-specific fields
  {
    path: "call.sid",
    label: "Call SID",
    type: "string",
    category: "Call",
    description: "Twilio call session identifier",
    allowedOperators: [OperatorType.EQUALS, OperatorType.EXISTS],
    examples: ["CA1234567890"],
  },
  {
    path: "call.from",
    label: "Caller Number",
    type: "string",
    category: "Call",
    description: "Phone number of the caller",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.CONTAINS,
      OperatorType.STARTS_WITH,
    ],
    examples: ["+1234567890"],
  },
  {
    path: "call.to",
    label: "Called Number",
    type: "string",
    category: "Call",
    description: "Phone number that was called",
    allowedOperators: [OperatorType.EQUALS, OperatorType.STARTS_WITH],
    examples: ["+1987654321"],
  },
  {
    path: "call.direction",
    label: "Call Direction",
    type: "string",
    category: "Call",
    description: "Direction of the call (inbound/outbound)",
    allowedOperators: [OperatorType.EQUALS],
    examples: ["inbound", "outbound"],
  },
  {
    path: "call.status",
    label: "Call Status",
    type: "string",
    category: "Call",
    description: "Current status of the call",
    allowedOperators: [OperatorType.EQUALS, OperatorType.IN],
    examples: ["ringing", "in-progress", "completed"],
  },

  // System/Time fields
  {
    path: "current.time",
    label: "Current Time",
    type: "string",
    category: "System",
    description: "Current time in HH:MM format",
    allowedOperators: [
      OperatorType.IS_BETWEEN,
      OperatorType.GREATER_THAN,
      OperatorType.LESS_THAN,
    ],
    examples: ["09:00", "17:00"],
  },
  {
    path: "current.day",
    label: "Current Day",
    type: "string",
    category: "System",
    description: "Current day of the week",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.NOT_EQUALS,
      OperatorType.IN,
      OperatorType.NOT_IN,
    ],
    examples: ["Monday", "Saturday", "Sunday"],
  },
  {
    path: "current.date",
    label: "Current Date",
    type: "date",
    category: "System",
    description: "Current date",
    allowedOperators: [
      OperatorType.IS_BEFORE,
      OperatorType.IS_AFTER,
      OperatorType.EQUALS,
    ],
    examples: ["2025-01-01"],
  },
  {
    path: "current.hour",
    label: "Current Hour",
    type: "number",
    category: "System",
    description: "Current hour (0-23)",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.GREATER_THAN,
      OperatorType.LESS_THAN,
      OperatorType.IS_BETWEEN,
    ],
    examples: ["9", "17"],
  },

  // Workflow variables
  {
    path: "workflow.retryCount",
    label: "Retry Count",
    type: "number",
    category: "Workflow",
    description: "Number of times the workflow has retried",
    allowedOperators: [
      OperatorType.EQUALS,
      OperatorType.GREATER_THAN,
      OperatorType.LESS_THAN,
    ],
    examples: ["3", "{{workflow.maxRetries}}"],
  },
  {
    path: "workflow.lastAction",
    label: "Last Action",
    type: "string",
    category: "Workflow",
    description: "The last action executed in the workflow",
    allowedOperators: [OperatorType.EQUALS, OperatorType.NOT_EQUALS],
    examples: ["send_email", "assign_agent", "add_tag"],
  },
  {
    path: "workflow.executionTime",
    label: "Execution Time (ms)",
    type: "number",
    category: "Workflow",
    description: "Total workflow execution time in milliseconds",
    allowedOperators: [
      OperatorType.GREATER_THAN,
      OperatorType.LESS_THAN,
      OperatorType.GREATER_EQUAL,
    ],
    examples: ["5000", "{{workflow.timeout}}"],
  },

  // Trigger context
  {
    path: "trigger.type",
    label: "Trigger Type",
    type: "string",
    category: "Trigger",
    description: "Type of event that triggered the workflow",
    allowedOperators: [OperatorType.EQUALS, OperatorType.IN],
    examples: [
      "Incoming Call",
      "Incoming Message",
      "SLA Breached",
    ],
  },
  {
    path: "trigger.source",
    label: "Trigger Source",
    type: "string",
    category: "Trigger",
    description: "Source system that triggered the workflow",
    allowedOperators: [OperatorType.EQUALS],
    examples: ["twilio", "telnyx", "api", "webhook"],
  },
];

// Integration-specific schemas
const INTEGRATION_SCHEMAS: Record<string, FieldSchema[]> = {
  shopify: [
    {
      path: "shopify.order.id",
      label: "Shopify Order ID",
      type: "string",
      category: "Shopify",
      description: "Unique Shopify order identifier",
      allowedOperators: [OperatorType.EQUALS, OperatorType.EXISTS],
      examples: ["12345678"],
    },
    {
      path: "shopify.order.totalPrice",
      label: "Shopify Order Total",
      type: "number",
      category: "Shopify",
      description: "Total price of the Shopify order",
      allowedOperators: [
        OperatorType.GREATER_THAN,
        OperatorType.LESS_THAN,
        OperatorType.EQUALS,
        OperatorType.GREATER_EQUAL,
        OperatorType.LESS_EQUAL,
      ],
      examples: ["100.00", "{{workflow.minimumOrderValue}}"],
    },
    {
      path: "shopify.order.status",
      label: "Shopify Order Status",
      type: "string",
      category: "Shopify",
      description: "Status of the Shopify order",
      allowedOperators: [OperatorType.EQUALS, OperatorType.NOT_EQUALS],
      examples: ["pending", "fulfilled", "cancelled", "refunded"],
    },
    {
      path: "shopify.customer.ordersCount",
      label: "Shopify Customer Order Count",
      type: "number",
      category: "Shopify",
      description: "Total number of orders by this customer",
      allowedOperators: [
        OperatorType.GREATER_THAN,
        OperatorType.LESS_THAN,
        OperatorType.EQUALS,
      ],
      examples: ["5", "{{workflow.vipThreshold}}"],
    },
    {
      path: "shopify.customer.totalSpent",
      label: "Shopify Customer Total Spent",
      type: "number",
      category: "Shopify",
      description: "Total amount spent by customer",
      allowedOperators: [
        OperatorType.GREATER_THAN,
        OperatorType.LESS_THAN,
        OperatorType.GREATER_EQUAL,
      ],
      examples: ["1000.00"],
    },
  ],

  stripe: [
    {
      path: "stripe.payment.id",
      label: "Stripe Payment ID",
      type: "string",
      category: "Stripe",
      description: "Unique Stripe payment identifier",
      allowedOperators: [OperatorType.EQUALS, OperatorType.EXISTS],
      examples: ["pi_1234567890"],
    },
    {
      path: "stripe.payment.amount",
      label: "Stripe Payment Amount",
      type: "number",
      category: "Stripe",
      description: "Payment amount in cents",
      allowedOperators: [
        OperatorType.GREATER_THAN,
        OperatorType.LESS_THAN,
        OperatorType.EQUALS,
        OperatorType.GREATER_EQUAL,
      ],
      examples: ["10000", "{{workflow.minimumPayment}}"],
    },
    {
      path: "stripe.payment.status",
      label: "Stripe Payment Status",
      type: "string",
      category: "Stripe",
      description: "Status of the payment",
      allowedOperators: [OperatorType.EQUALS, OperatorType.NOT_EQUALS],
      examples: ["succeeded", "pending", "failed", "canceled"],
    },
    {
      path: "stripe.customer.subscriptionStatus",
      label: "Stripe Subscription Status",
      type: "string",
      category: "Stripe",
      description: "Customer subscription status",
      allowedOperators: [OperatorType.EQUALS, OperatorType.IN],
      examples: ["active", "canceled", "past_due", "trialing"],
    },
  ],

  salesforce: [
    {
      path: "salesforce.lead.id",
      label: "Salesforce Lead ID",
      type: "string",
      category: "Salesforce",
      description: "Unique Salesforce lead identifier",
      allowedOperators: [OperatorType.EQUALS, OperatorType.EXISTS],
      examples: ["00Q1234567890"],
    },
    {
      path: "salesforce.lead.status",
      label: "Salesforce Lead Status",
      type: "string",
      category: "Salesforce",
      description: "Status of the lead",
      allowedOperators: [OperatorType.EQUALS, OperatorType.IN],
      examples: ["Open", "Contacted", "Qualified", "Converted"],
    },
    {
      path: "salesforce.lead.score",
      label: "Salesforce Lead Score",
      type: "number",
      category: "Salesforce",
      description: "Lead scoring value",
      allowedOperators: [
        OperatorType.GREATER_THAN,
        OperatorType.LESS_THAN,
        OperatorType.EQUALS,
      ],
      examples: ["75", "{{workflow.hotLeadThreshold}}"],
    },
    {
      path: "salesforce.opportunity.stage",
      label: "Salesforce Opportunity Stage",
      type: "string",
      category: "Salesforce",
      description: "Current stage of the opportunity",
      allowedOperators: [OperatorType.EQUALS, OperatorType.IN],
      examples: ["Prospecting", "Qualification", "Negotiation", "Closed Won"],
    },
  ],

  hubspot: [
    {
      path: "hubspot.contact.lifecycleStage",
      label: "HubSpot Lifecycle Stage",
      type: "string",
      category: "HubSpot",
      description: "Contact lifecycle stage",
      allowedOperators: [OperatorType.EQUALS, OperatorType.IN],
      examples: ["lead", "opportunity", "customer", "evangelist"],
    },
    {
      path: "hubspot.deal.amount",
      label: "HubSpot Deal Amount",
      type: "number",
      category: "HubSpot",
      description: "Deal amount value",
      allowedOperators: [
        OperatorType.GREATER_THAN,
        OperatorType.LESS_THAN,
        OperatorType.EQUALS,
      ],
      examples: ["5000", "{{workflow.dealThreshold}}"],
    },
  ],
};

export class HybridSchemaBuilder {
  /**
   * Build complete schema for a workflow
   */
  async buildSchema(
    tenantId: string,
    workflowId?: string
  ): Promise<FieldSchema[]> {
    let schema: FieldSchema[] = [...BASE_SCHEMA];

    // Add custom fields from database
    try {
      const customFields = await this.getCustomFields(tenantId);
      schema.push(...customFields);
    } catch (error) {
      console.error("Error loading custom fields:", error);
      // Continue without custom fields
    }

    // Add integration-specific fields
    if (workflowId) {
      try {
        const integrationFields = await this.getIntegrationFields(workflowId);
        schema.push(...integrationFields);
      } catch (error) {
        console.error("Error loading integration fields:", error);
        // Continue without integration fields
      }
    }

    return schema;
  }

  /**
   * Get custom fields defined by tenant
   */
  private async getCustomFields(tenantId: string): Promise<FieldSchema[]> {
    // For now, return empty array since CustomField model doesn't exist yet
    // Will be implemented when Prisma migration is added
    return [];

    /*
    const customFields = await prisma.customField.findMany({
      where: { tenantId },
    });

    return customFields.map((cf) => ({
      path: `customer.customFields.${cf.name}`,
      label: cf.label,
      type: cf.type as FieldSchema["type"],
      category: "Custom Fields",
      allowedOperators: this.getOperatorsForType(cf.type as FieldSchema["type"]),
      description: cf.description || undefined,
    }));
    */
  }

  /**
   * Get integration-specific fields for a workflow
   */
  private async getIntegrationFields(
    workflowId: string
  ): Promise<FieldSchema[]> {
    // For now, return empty array since WorkflowIntegration model doesn't exist yet
    // Will be implemented when Prisma migration is added
    return [];

    /*
    const integrations = await prisma.workflowIntegration.findMany({
      where: { workflowId },
      include: { integration: true },
    });

    const fields: FieldSchema[] = [];

    for (const wi of integrations) {
      const integrationSchema = this.getIntegrationSchema(
        wi.integration.type
      );
      fields.push(...integrationSchema);
    }

    return fields;
    */
  }

  /**
   * Get predefined schema for an integration type
   */
  private getIntegrationSchema(integrationType: string): FieldSchema[] {
    return INTEGRATION_SCHEMAS[integrationType] || [];
  }

  /**
   * Get allowed operators for a field type
   */
  private getOperatorsForType(type: FieldSchema["type"]): OperatorType[] {
    switch (type) {
      case "string":
        return [
          OperatorType.EQUALS,
          OperatorType.NOT_EQUALS,
          OperatorType.CONTAINS,
          OperatorType.NOT_CONTAINS,
          OperatorType.STARTS_WITH,
          OperatorType.ENDS_WITH,
          OperatorType.IS_EMPTY,
          OperatorType.IS_NOT_EMPTY,
        ];
      case "number":
        return [
          OperatorType.EQUALS,
          OperatorType.NOT_EQUALS,
          OperatorType.GREATER_THAN,
          OperatorType.LESS_THAN,
          OperatorType.GREATER_EQUAL,
          OperatorType.LESS_EQUAL,
        ];
      case "boolean":
        return [OperatorType.EQUALS];
      case "date":
        return [
          OperatorType.IS_BEFORE,
          OperatorType.IS_AFTER,
          OperatorType.IS_WITHIN_LAST,
          OperatorType.IS_OLDER_THAN,
          OperatorType.EQUALS,
        ];
      case "array":
        return [
          OperatorType.INCLUDES,
          OperatorType.NOT_INCLUDES,
          OperatorType.COUNT,
        ];
      default:
        return [OperatorType.EQUALS, OperatorType.EXISTS];
    }
  }

  /**
   * Group schema by category
   */
  groupByCategory(schema: FieldSchema[]): Record<string, FieldSchema[]> {
    return schema.reduce((acc, field) => {
      if (!acc[field.category]) {
        acc[field.category] = [];
      }
      acc[field.category].push(field);
      return acc;
    }, {} as Record<string, FieldSchema[]>);
  }
}

// Singleton instance
export const schemaBuilder = new HybridSchemaBuilder();
