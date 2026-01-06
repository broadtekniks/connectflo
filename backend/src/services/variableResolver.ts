/**
 * Variable Resolver Service
 * Handles variable interpolation and context management for workflows
 */

export interface WorkflowContext {
  execution: {
    id: string;
    workflowId: string;
    tenantId: string;
    startedAt: Date;
  };
  trigger: {
    type: string;
    source: any; // Original webhook/API data
  };
  variables: {
    workflow: Record<string, any>; // Workflow-scoped variables
    conversation: Record<string, any>; // Conversation-scoped variables
    global: Record<string, any>; // Tenant-wide variables
  };
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    metadata?: Record<string, any>;
  };
  conversation?: {
    id?: string;
    channel?: string; // 'phone', 'chat', 'email'
    status?: string;
    messages?: any[];
    lastMessage?: string;
    createdAt?: Date;
  };
  call?: {
    sid?: string;
    from?: string;
    to?: string;
    status?: string;
    direction?: string;
    duration?: number;
  };
  resources: {
    aiConfig?: any;
    assignedAgent?: any;
    documents: any[];
    phoneNumbers: any[];
    integrations: any[];
  };
}

export class VariableResolver {
  /**
   * Resolve {{variable}} syntax in strings
   * Examples:
   *   "Hello {{customer.name}}" → "Hello John Doe"
   *   "Order #{{trigger.orderId}}" → "Order #12345"
   */
  resolve(template: string, context: WorkflowContext): string {
    if (typeof template !== "string") {
      return template;
    }

    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.get(path.trim(), context);
      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  /**
   * Resolve variables in entire object (recursive)
   * Handles strings, arrays, and nested objects
   */
  resolveObject(obj: any, context: WorkflowContext): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "string") {
      return this.resolve(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveObject(item, context));
    }

    if (typeof obj === "object") {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveObject(value, context);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Get variable by path (e.g., 'customer.email', 'workflow.step')
   * Supports nested paths with dot notation
   */
  get(path: string, context: WorkflowContext): any {
    const parts = path.split(".");
    let current: any = context;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Set variable by path
   * Creates nested objects as needed
   */
  set(path: string, value: any, context: WorkflowContext): void {
    const parts = path.split(".");
    const lastPart = parts.pop()!;

    let current: any = context;
    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[lastPart] = value;
  }

  /**
   * Check if a variable exists
   */
  exists(path: string, context: WorkflowContext): boolean {
    const value = this.get(path, context);
    return value !== undefined && value !== null;
  }

  /**
   * Delete a variable
   */
  delete(path: string, context: WorkflowContext): void {
    const parts = path.split(".");
    const lastPart = parts.pop()!;

    let current: any = context;
    for (const part of parts) {
      if (!(part in current)) {
        return; // Path doesn't exist
      }
      current = current[part];
    }

    delete current[lastPart];
  }

  /**
   * Merge additional context into existing context
   */
  merge(context: WorkflowContext, additional: Partial<WorkflowContext>): void {
    if (additional.customer) {
      context.customer = { ...context.customer, ...additional.customer };
    }
    if (additional.conversation) {
      context.conversation = {
        ...context.conversation,
        ...additional.conversation,
      };
    }
    if (additional.call) {
      context.call = { ...context.call, ...additional.call };
    }
    if (additional.variables) {
      if (additional.variables.workflow) {
        context.variables.workflow = {
          ...context.variables.workflow,
          ...additional.variables.workflow,
        };
      }
      if (additional.variables.conversation) {
        context.variables.conversation = {
          ...context.variables.conversation,
          ...additional.variables.conversation,
        };
      }
      if (additional.variables.global) {
        context.variables.global = {
          ...context.variables.global,
          ...additional.variables.global,
        };
      }
    }
  }
}

// Singleton instance
export const variableResolver = new VariableResolver();
