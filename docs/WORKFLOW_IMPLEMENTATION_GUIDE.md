# ConnectFlo Workflow System - Implementation Guide

**Document Version:** 1.0  
**Date:** December 29, 2024  
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Architecture Overview](#architecture-overview)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Detailed Component Specifications](#detailed-component-specifications)
6. [Testing Strategy](#testing-strategy)
7. [Performance & Scalability](#performance--scalability)

---

## Executive Summary

### What We Have

- **Visual Workflow Builder**: Fully functional drag-and-drop UI with 30+ node types across 5 categories
- **Basic Execution Engine**: Linear workflow execution for simple flows
- **Voice Integration**: OpenAI Realtime + Twilio for phone calls
- **Resource Management**: Workflow-scoped phone numbers, documents, and AI configs

### What We Need

- **Conditional Logic**: If/Else branching, loops, and dynamic path selection
- **Variable System**: Context passing, data collection, and state management
- **Action Nodes**: Email, agent assignment, tagging, chat closure
- **Integration Implementations**: Shopify, Stripe, Salesforce, etc.
- **Advanced Features**: Error handling, human handoff, sub-workflows

### Success Metrics

- Execute complex multi-branch workflows
- Handle 1000+ concurrent workflow executions
- <500ms average node execution time
- 99.9% workflow completion rate

---

## Current State Analysis

### ✅ Working Components

#### 1. Visual Builder (`pages/Workflows.tsx`)

**Status:** Production-ready  
**Features:**

- Drag-and-drop node placement
- Visual connection drawing
- Node property editor sidebar
- Real-time canvas updates
- Save/load workflows from database

**Component Library:**

```typescript
TRIGGERS: 6 types
  - Incoming Message, Incoming Call, Intent Detected
  - Sentiment Negative, SLA Breached, New Order

CONFIGURATION: 2 types
  - Knowledge Base, AI Configuration

LOGIC: 4 types
  - Condition, Wait/Delay, Loop, A/B Split

ACTIONS: 6 types
  - Send Reply, Send Email, Assign Agent
  - Add Tag, AI Generate, End Chat

INTEGRATIONS: 12 types
  - Shopify, Stripe, Salesforce, HubSpot, Jira
  - Slack, Teams, Postgres, Zendesk
  - Twilio SMS, SendGrid, Odoo
```

#### 2. Workflow Engine (`backend/src/services/workflowEngine.ts`)

**Status:** Basic functionality only  
**Capabilities:**

- Trigger workflow from external events
- Linear node traversal (first edge only)
- Basic action execution (Send Reply, AI Generate)
- Call state management for voice workflows

**Current Flow:**

```
trigger(triggerType, context)
  ↓
findWorkflow(triggerType, isActive=true)
  ↓
loadResources(aiConfig, documents, phoneNumbers)
  ↓
executeNode(startNode)
  ↓
handleAction(node) → findNextEdge() → executeNode(nextNode)
```

#### 3. Resource Management

**Status:** Full CRUD implemented  
**API Endpoints:**

- `POST /workflow-resources/:workflowId/documents/:documentId`
- `POST /workflow-resources/:workflowId/phone-numbers/:phoneNumberId`
- `PUT /workflow-resources/:workflowId/ai-config/:aiConfigId`
- Plan limits enforced (maxDocumentsPerWorkflow, etc.)

### ⚠️ Partially Implemented

#### 1. Condition Nodes

**Current Implementation:**

```typescript
case "condition":
  // Logic to determine which edge to follow
  // For now, we'll just take the first one
  break;
```

**What's Missing:**

- Expression evaluation engine
- Comparison operators (==, !=, >, <, contains, etc.)
- Boolean logic (AND, OR, NOT)
- Variable resolution
- Edge label interpretation ("yes"/"no", "true"/"false")

#### 2. Context System

**Current Implementation:**

```typescript
interface Context {
  type?: string; // 'voice', 'chat', etc.
  callControlId?: string;
  phoneNumber?: string;
  fromNumber?: string;
  workflowId?: string;
  workflowTenantId?: string;
  workflowResources?: {
    aiConfig;
    phoneNumbers;
    documents;
    integrations;
  };
}
```

**What's Missing:**

- User-defined variables
- Variable scoping (workflow, conversation, global)
- Data transformation functions
- Session state persistence
- Variable interpolation in text

### ❌ Not Implemented

#### 1. Action Nodes

- **Send Email**: No email service integration
- **Assign Agent**: No agent queue system
- **Add Tag**: No tagging/categorization system
- **End Chat**: No conversation closure logic
- **Human Handoff**: No escalation mechanism

#### 2. Integration Nodes

All 12 integration types are UI placeholders only:

- No OAuth flows
- No API credential management
- No request/response handling
- No rate limiting
- No error retry logic

#### 3. Logic Nodes

- **Wait/Delay**: No scheduling system
- **Loop**: No iteration logic
- **A/B Split**: No random distribution

#### 4. Advanced Features

- **Sub-workflows**: No workflow composition
- **Error Handling**: No try/catch nodes
- **Analytics Tracking**: No execution metrics
- **Rollback/Undo**: No state restoration

---

## Architecture Overview

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     External Trigger                         │
│  (Twilio Webhook, Chat Widget, API Call, Schedule)          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              WorkflowEngine.trigger()                        │
│  • Find active workflow by triggerType                       │
│  • Load resources (documents, AI config, integrations)       │
│  • Initialize context object                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│          Context Initialization & Enrichment                 │
│  • Set workflowId, tenantId                                  │
│  • Load customer data from DB                                │
│  • Initialize variable scope                                 │
│  • Set execution metadata (timestamp, source)                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              executeNode(startNode)                          │
│                                                              │
│  ┌──────────────────────────────────────────────┐           │
│  │  Pre-Execution Phase                         │           │
│  │  • Resolve variables in node config          │           │
│  │  • Check execution conditions                │           │
│  │  • Log node entry                            │           │
│  └────────────────┬─────────────────────────────┘           │
│                   │                                          │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────┐           │
│  │  Node Type Router                            │           │
│  │                                               │           │
│  │  TRIGGER → Pass through, enrich context      │           │
│  │  ACTION → handleAction()                     │           │
│  │  CONDITION → evaluateCondition()             │           │
│  │  INTEGRATION → executeIntegration()          │           │
│  │  LOOP → executeLoop()                        │           │
│  └────────────────┬─────────────────────────────┘           │
│                   │                                          │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────┐           │
│  │  Node Execution                              │           │
│  │  • Execute node-specific logic               │           │
│  │  • Update context variables                  │           │
│  │  • Generate output/side effects              │           │
│  │  • Handle errors                             │           │
│  └────────────────┬─────────────────────────────┘           │
│                   │                                          │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────┐           │
│  │  Post-Execution Phase                        │           │
│  │  • Log execution result                      │           │
│  │  • Update analytics                          │           │
│  │  • Determine next node                       │           │
│  └────────────────┬─────────────────────────────┘           │
└──────────────────┬┘                                          │
                   │                                           │
                   ▼                                           │
         ┌─────────────────────┐                              │
         │  Find Next Node(s)  │                              │
         │                     │                              │
         │  Linear: First edge │                              │
         │  Condition: Edge by label                          │
         │  Loop: Back edge or continue                       │
         │  Parallel: Multiple edges                          │
         └─────────┬───────────┘                              │
                   │                                           │
                   ├─────── No next node ─────┐               │
                   │                           │               │
                   ▼                           ▼               │
         ┌─────────────────┐      ┌──────────────────────┐    │
         │  Next Node      │      │  Workflow Complete   │    │
         │  executeNode()  │      │  • Persist state     │    │
         │  (recursive)    │      │  • Send metrics      │    │
         └─────────────────┘      │  • Cleanup resources │    │
                                  └──────────────────────┘    │
```

### Database Schema (Current)

```sql
-- Core Workflow Tables
Workflow {
  id: string (UUID)
  tenantId: string
  name: string
  description: string?
  triggerType: string       -- 'Incoming Call', 'Incoming Message', etc.
  nodes: JSON               -- Array<WorkflowNode>
  edges: JSON               -- Array<WorkflowEdge>
  isActive: boolean
  createdAt: DateTime
  updatedAt: DateTime
}

-- Resource Assignment Tables
WorkflowDocument {
  workflowId: string
  documentId: string
  assignedAt: DateTime
}

WorkflowPhoneNumber {
  workflowId: string
  phoneNumberId: string
  assignedAt: DateTime
}

WorkflowIntegration {
  workflowId: string
  integrationId: string
  assignedAt: DateTime
}

-- AI Config Link
Workflow.aiConfigId: string? (Foreign key)
```

### Required Schema Additions

```prisma
// Workflow Execution Tracking
model WorkflowExecution {
  id              String   @id @default(uuid())
  workflowId      String
  workflow        Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  tenantId        String

  status          String   // 'running', 'completed', 'failed', 'cancelled'
  startedAt       DateTime @default(now())
  completedAt     DateTime?

  triggerContext  Json     // Original trigger data
  finalContext    Json?    // Final state when completed

  // Analytics
  totalNodes      Int      @default(0)
  executedNodes   Int      @default(0)
  failedNodes     Int      @default(0)
  executionTimeMs Int?

  error           String?

  @@index([workflowId, status])
  @@index([tenantId, startedAt])
}

// Node Execution Log
model NodeExecution {
  id                  String            @id @default(uuid())
  executionId         String
  execution           WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  nodeId              String            // Node ID from workflow.nodes JSON
  nodeType            String
  nodeLabel           String

  startedAt           DateTime          @default(now())
  completedAt         DateTime?
  executionTimeMs     Int?

  inputContext        Json              // Variables at node entry
  outputContext       Json?             // Variables after node execution

  status              String            // 'pending', 'running', 'completed', 'failed', 'skipped'
  error               String?

  @@index([executionId, startedAt])
}

// Workflow Variables (Session State)
model WorkflowVariable {
  id              String   @id @default(uuid())
  executionId     String
  execution       WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  key             String
  value           Json
  scope           String   // 'workflow', 'conversation', 'global'

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([executionId, key, scope])
  @@index([executionId])
}

// Integration Credentials
model Integration {
  id              String   @id @default(uuid())
  tenantId        String

  type            String   // 'shopify', 'stripe', 'salesforce', etc.
  name            String

  credentials     Json     // Encrypted OAuth tokens, API keys
  config          Json     // Provider-specific settings

  isActive        boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, type])
}

// Scheduled Workflows
model WorkflowSchedule {
  id              String   @id @default(uuid())
  workflowId      String
  workflow        Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  cronExpression  String   // '0 9 * * 1' = Every Monday at 9am
  timezone        String   @default("UTC")

  isActive        boolean  @default(true)
  lastRunAt       DateTime?
  nextRunAt       DateTime

  @@index([isActive, nextRunAt])
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Implement core execution engine improvements

#### 1.1 Variable System

**Priority:** CRITICAL  
**Effort:** 8 hours

**Tasks:**

- [ ] Design variable data structure

  ```typescript
  interface WorkflowContext {
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
      workflow: Record<string, any>; // Workflow-scoped
      conversation: Record<string, any>; // Conversation-scoped
      global: Record<string, any>; // Tenant-wide
    };
    customer?: {
      id: string;
      name: string;
      email: string;
      phone: string;
      metadata: Record<string, any>;
    };
    resources: {
      aiConfig?: any;
      documents: any[];
      phoneNumbers: any[];
      integrations: any[];
    };
  }
  ```

- [ ] Implement variable resolver

  ```typescript
  class VariableResolver {
    resolve(template: string, context: WorkflowContext): string {
      // Replace {{variable.path}} with actual values
      // Examples:
      //   "Hello {{customer.name}}" → "Hello John Doe"
      //   "Order #{{trigger.orderId}}" → "Order #12345"
      //   "{{workflow.step}}" → "confirmation"
    }

    set(path: string, value: any, context: WorkflowContext): void {
      // Set nested variable: "workflow.currentStep" = "review"
    }

    get(path: string, context: WorkflowContext): any {
      // Get nested variable: "customer.email"
    }
  }
  ```

- [ ] Add persistence layer (WorkflowVariable model)
- [ ] Unit tests for variable operations

**Acceptance Criteria:**

- Can set/get variables in any scope
- Variable interpolation works in all text fields
- Variables persist across node executions
- Nested path access works (e.g., `customer.address.city`)

#### 1.2 Condition Evaluation Engine

**Priority:** CRITICAL  
**Effort:** 12 hours

**Tasks:**

- [ ] Design expression syntax

  ```typescript
  interface ConditionExpression {
    left: string; // Variable path or literal
    operator: Operator;
    right: string; // Variable path or literal
    logicalOp?: "AND" | "OR";
    next?: ConditionExpression;
  }

  enum Operator {
    EQUALS = "==",
    NOT_EQUALS = "!=",
    GREATER_THAN = ">",
    LESS_THAN = "<",
    CONTAINS = "contains",
    STARTS_WITH = "starts_with",
    IS_EMPTY = "is_empty",
    EXISTS = "exists",
  }
  ```

- [ ] Implement expression evaluator

  ```typescript
  class ConditionEvaluator {
    evaluate(
      expression: ConditionExpression,
      context: WorkflowContext
    ): boolean {
      const leftValue = this.resolveValue(expression.left, context);
      const rightValue = this.resolveValue(expression.right, context);

      const result = this.compare(leftValue, expression.operator, rightValue);

      if (expression.next && expression.logicalOp) {
        const nextResult = this.evaluate(expression.next, context);
        return expression.logicalOp === "AND"
          ? result && nextResult
          : result || nextResult;
      }

      return result;
    }
  }
  ```

- [ ] Update `executeNode()` to handle conditions

  ```typescript
  case "condition":
    const condition = node.config?.condition;
    const result = await this.conditionEvaluator.evaluate(condition, context);

    // Find edge labeled "yes" or "true" if result is true
    // Find edge labeled "no" or "false" if result is false
    const targetLabel = result ? "yes" : "no";
    const nextEdge = outgoingEdges.find(e =>
      e.label?.toLowerCase() === targetLabel
    );
    break;
  ```

- [ ] Add UI for condition builder in node properties
- [ ] Integration tests for complex conditions

**Acceptance Criteria:**

- Can evaluate simple comparisons (`customer.age > 18`)
- Can evaluate compound conditions (`status == "active" AND balance > 100`)
- Correctly routes workflow based on condition result
- Handles null/undefined values gracefully

#### 1.3 Execution Tracking

**Priority:** HIGH  
**Effort:** 6 hours

**Tasks:**

- [ ] Apply Prisma migration for execution tables
- [ ] Create `WorkflowExecution` record on trigger
- [ ] Create `NodeExecution` record for each node
- [ ] Update execution status on completion/failure
- [ ] Add execution history API endpoint

**Acceptance Criteria:**

- Can view execution history for a workflow
- Can see which nodes executed and their timing
- Can inspect context at each node
- Failed executions show error details

### Phase 2: Core Action Nodes (Week 2-3)

**Goal:** Implement missing action node types

#### 2.1 Send Email Action

**Priority:** HIGH  
**Effort:** 8 hours

**Tasks:**

- [ ] Integrate email service (SendGrid or AWS SES)
- [ ] Create email template system
- [ ] Implement `SendEmailAction`
  ```typescript
  interface SendEmailConfig {
    to: string; // Variable or literal
    cc?: string[];
    bcc?: string[];
    subject: string; // Supports {{variables}}
    body: string; // HTML or plain text
    templateId?: string;
    attachments?: Array<{
      filename: string;
      url: string;
    }>;
  }
  ```
- [ ] Add email sending to `handleAction()`
- [ ] Track email delivery status
- [ ] Add retry logic for failures

**Acceptance Criteria:**

- Can send emails with variables in subject/body
- Supports HTML templates
- Tracks sent emails in database
- Handles bounces/failures gracefully

#### 2.2 Assign Agent Action

**Priority:** MEDIUM  
**Effort:** 10 hours

**Tasks:**

- [ ] Design agent queue system
- [ ] Create `ConversationAssignment` model
- [ ] Implement routing logic (round-robin, skill-based)
- [ ] Add real-time notification to agent
- [ ] Update inbox UI to show assignments

**Acceptance Criteria:**

- Can assign conversation to specific agent
- Can assign to agent group/queue
- Agent receives real-time notification
- Assignment appears in agent's inbox

#### 2.3 Add Tag Action

**Priority:** LOW  
**Effort:** 4 hours

**Tasks:**

- [ ] Create `Tag` and `ConversationTag` models
- [ ] Implement tagging logic
- [ ] Add tag filtering to inbox
- [ ] Create tag management UI

#### 2.4 End Chat Action

**Priority:** MEDIUM  
**Effort:** 4 hours

**Tasks:**

- [ ] Implement conversation closure logic
- [ ] Send goodbye message
- [ ] Mark conversation as resolved
- [ ] Trigger cleanup tasks

### Phase 3: Logic Nodes (Week 3-4)

**Goal:** Implement advanced control flow

#### 3.1 Loop Node

**Priority:** MEDIUM  
**Effort:** 10 hours

**Tasks:**

- [ ] Design loop configuration

  ```typescript
  interface LoopConfig {
    type: "forEach" | "while" | "count";

    // For forEach
    arrayPath?: string; // Variable containing array
    itemVariable?: string; // Name for current item

    // For while
    condition?: ConditionExpression;

    // For count
    count?: number;

    // Safety
    maxIterations?: number; // Prevent infinite loops
  }
  ```

- [ ] Implement loop execution logic
- [ ] Track loop iteration in context
- [ ] Handle break/continue conditions
- [ ] Add loop visualization in UI

**Acceptance Criteria:**

- Can iterate over arrays
- Can loop while condition is true
- Can loop N times
- Prevents infinite loops (max 1000 iterations)

#### 3.2 Wait/Delay Node

**Priority:** MEDIUM  
**Effort:** 8 hours

**Tasks:**

- [ ] Implement delay scheduling system
- [ ] Store execution state in database
- [ ] Resume execution after delay
- [ ] Support dynamic delays (based on variables)

**Acceptance Criteria:**

- Can pause workflow for specified duration
- Can wait until specific datetime
- Workflow resumes correctly after delay
- Multiple workflows can be delayed simultaneously

#### 3.3 A/B Split Node

**Priority:** LOW  
**Effort:** 4 hours

**Tasks:**

- [ ] Implement random distribution
- [ ] Track variant selection
- [ ] Store A/B test results

### Phase 4: Integrations (Week 4-6)

**Goal:** Implement top 5 integrations

#### Priority Order:

1. **Shopify** (E-commerce) - 12 hours
2. **Stripe** (Payments) - 10 hours
3. **Twilio SMS** (Messaging) - 6 hours
4. **SendGrid** (Email) - 6 hours
5. **Postgres** (Database) - 8 hours

#### 4.1 Integration Framework

**Tasks:**

- [ ] Create `IntegrationExecutor` base class

  ```typescript
  abstract class IntegrationExecutor {
    abstract name: string;

    async execute(
      action: string,
      config: any,
      context: WorkflowContext
    ): Promise<any> {
      // Load credentials
      const integration = await this.getIntegration(context.tenantId);

      // Execute action
      const result = await this.executeAction(action, config, integration);

      // Store result in context
      context.variables.workflow[config.outputVariable] = result;

      return result;
    }

    protected abstract executeAction(
      action: string,
      config: any,
      integration: Integration
    ): Promise<any>;
  }
  ```

- [ ] Implement OAuth flow for integrations
- [ ] Create credential encryption system
- [ ] Add integration management UI

#### 4.2 Shopify Integration

**Actions:**

- Get Order (`/admin/api/2024-01/orders/{id}.json`)
- Create Order
- Update Order
- Refund Order
- Get Customer
- Update Inventory

**Config Example:**

```typescript
{
  action: 'getOrder',
  orderId: '{{trigger.orderId}}',
  outputVariable: 'shopifyOrder'
}
```

#### 4.3 Stripe Integration

**Actions:**

- Create Refund
- Get Payment Intent
- Create Customer
- Get Subscription
- Cancel Subscription

### Phase 5: Advanced Features (Week 6-8)

#### 5.1 Error Handling

**Tasks:**

- [ ] Add try/catch node type
- [ ] Implement error routing
- [ ] Add retry logic configuration
- [ ] Create error notification system

#### 5.2 Human Handoff

**Tasks:**

- [ ] Detect handoff conditions
- [ ] Queue for agent review
- [ ] Agent approval/rejection flow
- [ ] Resume workflow after approval

#### 5.3 Sub-Workflows

**Tasks:**

- [ ] Add "Execute Workflow" node
- [ ] Pass context to sub-workflow
- [ ] Merge sub-workflow results
- [ ] Handle nested execution

---

## Detailed Component Specifications

### 1. Enhanced WorkflowEngine

```typescript
// backend/src/services/workflowEngine.ts

export class WorkflowEngine {
  private variableResolver: VariableResolver;
  private conditionEvaluator: ConditionEvaluator;
  private integrationExecutor: IntegrationExecutor;
  private executionLogger: ExecutionLogger;

  async trigger(triggerType: string, triggerContext: any): Promise<string> {
    // 1. Find workflow
    const workflow = await this.findWorkflow(triggerType, triggerContext);
    if (!workflow) {
      throw new Error(`No active workflow for trigger: ${triggerType}`);
    }

    // 2. Create execution record
    const execution = await this.createExecution(workflow, triggerContext);

    // 3. Initialize context
    const context: WorkflowContext = {
      execution: {
        id: execution.id,
        workflowId: workflow.id,
        tenantId: workflow.tenantId,
        startedAt: new Date(),
      },
      trigger: {
        type: triggerType,
        source: triggerContext,
      },
      variables: {
        workflow: {},
        conversation: {},
        global: await this.loadGlobalVariables(workflow.tenantId),
      },
      customer: await this.loadCustomer(triggerContext),
      resources: await this.loadResources(workflow),
    };

    // 4. Execute workflow
    try {
      await this.executeWorkflow(workflow, context);

      // Mark as completed
      await this.completeExecution(execution.id, context);

      return execution.id;
    } catch (error) {
      // Mark as failed
      await this.failExecution(execution.id, error);
      throw error;
    }
  }

  private async executeWorkflow(
    workflow: Workflow,
    context: WorkflowContext
  ): Promise<void> {
    const nodes = workflow.nodes as WorkflowNode[];
    const edges = workflow.edges as WorkflowEdge[];

    // Find start node
    const startNode = nodes.find(
      (n) => n.type === "trigger" && n.label === context.trigger.type
    );

    if (!startNode) {
      throw new Error("No trigger node found");
    }

    // Execute from start
    await this.executeNode(startNode, nodes, edges, context);
  }

  private async executeNode(
    node: WorkflowNode,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    context: WorkflowContext
  ): Promise<void> {
    // Log node execution start
    const nodeExecution = await this.executionLogger.startNode(
      context.execution.id,
      node
    );

    try {
      // Resolve variables in node config
      const resolvedConfig = this.variableResolver.resolveObject(
        node.config,
        context
      );

      // Execute based on type
      let nextNodeIds: string[] = [];

      switch (node.type) {
        case "trigger":
          nextNodeIds = await this.executeTrigger(
            node,
            resolvedConfig,
            context
          );
          break;

        case "action":
          nextNodeIds = await this.executeAction(node, resolvedConfig, context);
          break;

        case "condition":
          nextNodeIds = await this.executeCondition(
            node,
            resolvedConfig,
            context,
            edges
          );
          break;

        case "integration":
          nextNodeIds = await this.executeIntegration(
            node,
            resolvedConfig,
            context
          );
          break;
      }

      // Log node completion
      await this.executionLogger.completeNode(nodeExecution.id, context);

      // Execute next nodes
      for (const nextNodeId of nextNodeIds) {
        const nextNode = nodes.find((n) => n.id === nextNodeId);
        if (nextNode) {
          await this.executeNode(nextNode, nodes, edges, context);
        }
      }
    } catch (error) {
      await this.executionLogger.failNode(nodeExecution.id, error);
      throw error;
    }
  }

  private async executeAction(
    node: WorkflowNode,
    config: any,
    context: WorkflowContext
  ): Promise<string[]> {
    switch (node.label) {
      case "Send Reply":
        await this.sendReply(config, context);
        break;

      case "Send Email":
        await this.sendEmail(config, context);
        break;

      case "Assign Agent":
        await this.assignAgent(config, context);
        break;

      case "Add Tag":
        await this.addTag(config, context);
        break;

      case "AI Generate":
        await this.aiGenerate(config, context);
        break;

      case "End Chat":
        await this.endChat(config, context);
        break;

      case "Set Variable":
        this.variableResolver.set(config.path, config.value, context);
        break;
    }

    // Return all outgoing edges (linear flow)
    return this.getNextNodeIds(node.id, edges);
  }

  private async executeCondition(
    node: WorkflowNode,
    config: any,
    context: WorkflowContext,
    edges: WorkflowEdge[]
  ): Promise<string[]> {
    const result = await this.conditionEvaluator.evaluate(
      config.condition,
      context
    );

    // Find edge with matching label
    const outgoingEdges = edges.filter((e) => e.source === node.id);
    const targetLabel = result ? "yes" : "no";

    const nextEdge = outgoingEdges.find(
      (e) => e.label?.toLowerCase() === targetLabel
    );

    return nextEdge ? [nextEdge.target] : [];
  }

  private async executeIntegration(
    node: WorkflowNode,
    config: any,
    context: WorkflowContext
  ): Promise<string[]> {
    const result = await this.integrationExecutor.execute(
      node.label, // e.g., 'Shopify Get Order'
      config,
      context
    );

    // Store result in context if outputVariable is specified
    if (config.outputVariable) {
      this.variableResolver.set(
        `workflow.${config.outputVariable}`,
        result,
        context
      );
    }

    return this.getNextNodeIds(node.id, edges);
  }
}
```

### 2. Variable Resolver Implementation

```typescript
// backend/src/services/variableResolver.ts

export class VariableResolver {
  /**
   * Resolve {{variable}} syntax in strings
   */
  resolve(template: string, context: WorkflowContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.get(path.trim(), context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Resolve variables in entire object (recursive)
   */
  resolveObject(obj: any, context: WorkflowContext): any {
    if (typeof obj === "string") {
      return this.resolve(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveObject(item, context));
    }

    if (obj && typeof obj === "object") {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveObject(value, context);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Get variable by path (e.g., 'customer.email')
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
}
```

### 3. Condition Evaluator Implementation

```typescript
// backend/src/services/conditionEvaluator.ts

export class ConditionEvaluator {
  constructor(private variableResolver: VariableResolver) {}

  evaluate(expression: ConditionExpression, context: WorkflowContext): boolean {
    const leftValue = this.resolveValue(expression.left, context);
    const rightValue = this.resolveValue(expression.right, context);

    const result = this.compare(leftValue, expression.operator, rightValue);

    if (expression.next && expression.logicalOp) {
      const nextResult = this.evaluate(expression.next, context);

      if (expression.logicalOp === "AND") {
        return result && nextResult;
      } else {
        return result || nextResult;
      }
    }

    return result;
  }

  private resolveValue(value: string, context: WorkflowContext): any {
    // Check if it's a variable reference (contains dots or starts with $)
    if (value.includes(".") || value.startsWith("$")) {
      return this.variableResolver.get(value, context);
    }

    // Try to parse as number
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return num;
    }

    // Try to parse as boolean
    if (value === "true") return true;
    if (value === "false") return false;

    // Return as string
    return value;
  }

  private compare(left: any, operator: Operator, right: any): boolean {
    switch (operator) {
      case Operator.EQUALS:
        return left == right;

      case Operator.NOT_EQUALS:
        return left != right;

      case Operator.GREATER_THAN:
        return left > right;

      case Operator.LESS_THAN:
        return left < right;

      case Operator.GREATER_THAN_OR_EQUAL:
        return left >= right;

      case Operator.LESS_THAN_OR_EQUAL:
        return left <= right;

      case Operator.CONTAINS:
        return String(left).includes(String(right));

      case Operator.STARTS_WITH:
        return String(left).startsWith(String(right));

      case Operator.ENDS_WITH:
        return String(left).endsWith(String(right));

      case Operator.IS_EMPTY:
        return (
          !left || left === "" || (Array.isArray(left) && left.length === 0)
        );

      case Operator.EXISTS:
        return left !== undefined && left !== null;

      default:
        return false;
    }
  }
}
```

### 4. UI: Condition Builder Component

```typescript
// components/ConditionBuilder.tsx

interface ConditionBuilderProps {
  condition: ConditionExpression;
  onChange: (condition: ConditionExpression) => void;
  context: WorkflowContext;
}

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  condition,
  onChange,
  context,
}) => {
  return (
    <div className="space-y-3">
      {/* First Condition */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Variable or value"
          value={condition.left}
          onChange={(e) => onChange({ ...condition, left: e.target.value })}
          className="flex-1 px-3 py-2 border rounded"
        />

        <select
          value={condition.operator}
          onChange={(e) =>
            onChange({ ...condition, operator: e.target.value as Operator })
          }
          className="px-3 py-2 border rounded"
        >
          <option value="==">equals</option>
          <option value="!=">not equals</option>
          <option value=">">greater than</option>
          <option value="<">less than</option>
          <option value="contains">contains</option>
          <option value="starts_with">starts with</option>
          <option value="is_empty">is empty</option>
          <option value="exists">exists</option>
        </select>

        <input
          type="text"
          placeholder="Value"
          value={condition.right}
          onChange={(e) => onChange({ ...condition, right: e.target.value })}
          className="flex-1 px-3 py-2 border rounded"
        />
      </div>

      {/* AND/OR for additional conditions */}
      {condition.next && (
        <>
          <div className="flex items-center gap-2">
            <select
              value={condition.logicalOp}
              onChange={(e) =>
                onChange({
                  ...condition,
                  logicalOp: e.target.value as "AND" | "OR",
                })
              }
              className="px-3 py-2 border rounded font-bold"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          </div>

          <ConditionBuilder
            condition={condition.next}
            onChange={(next) => onChange({ ...condition, next })}
            context={context}
          />
        </>
      )}

      {/* Add Another Condition */}
      {!condition.next && (
        <button
          onClick={() =>
            onChange({
              ...condition,
              logicalOp: "AND",
              next: { left: "", operator: Operator.EQUALS, right: "" },
            })
          }
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          + Add Condition
        </button>
      )}
    </div>
  );
};
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/variableResolver.test.ts

describe("VariableResolver", () => {
  const resolver = new VariableResolver();

  const context: WorkflowContext = {
    execution: {
      id: "1",
      workflowId: "1",
      tenantId: "1",
      startedAt: new Date(),
    },
    trigger: { type: "Test", source: {} },
    variables: {
      workflow: { step: "confirmation", count: 5 },
      conversation: { customerId: "123" },
      global: { companyName: "Acme Inc" },
    },
    customer: { id: "123", name: "John Doe", email: "john@example.com" },
  };

  test("resolves simple variable", () => {
    expect(resolver.resolve("Hello {{customer.name}}", context)).toBe(
      "Hello John Doe"
    );
  });

  test("resolves nested variable", () => {
    expect(resolver.resolve("Step: {{workflow.step}}", context)).toBe(
      "Step: confirmation"
    );
  });

  test("resolves multiple variables", () => {
    expect(
      resolver.resolve("{{customer.name}} <{{customer.email}}>", context)
    ).toBe("John Doe <john@example.com>");
  });

  test("handles missing variable", () => {
    expect(resolver.resolve("{{customer.missing}}", context)).toBe(
      "{{customer.missing}}"
    );
  });

  test("sets nested variable", () => {
    resolver.set("workflow.newVar", "value", context);
    expect(context.variables.workflow.newVar).toBe("value");
  });
});
```

### Integration Tests

```typescript
// __tests__/workflowExecution.test.ts

describe("WorkflowEngine", () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  test("executes linear workflow", async () => {
    const workflow = {
      id: "1",
      nodes: [
        { id: "n1", type: "trigger", label: "Test" },
        {
          id: "n2",
          type: "action",
          label: "Set Variable",
          config: { path: "workflow.result", value: "success" },
        },
        {
          id: "n3",
          type: "action",
          label: "Send Reply",
          config: { message: "Done!" },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
    };

    const executionId = await engine.trigger("Test", {});

    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    expect(execution.status).toBe("completed");
    expect(execution.executedNodes).toBe(3);
  });

  test("executes conditional branch", async () => {
    const workflow = {
      id: "1",
      nodes: [
        { id: "n1", type: "trigger", label: "Test" },
        {
          id: "n2",
          type: "condition",
          label: "Check Age",
          config: {
            condition: { left: "customer.age", operator: ">", right: "18" },
          },
        },
        { id: "n3", type: "action", label: "Adult Path" },
        { id: "n4", type: "action", label: "Minor Path" },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3", label: "yes" },
        { id: "e3", source: "n2", target: "n4", label: "no" },
      ],
    };

    const executionId = await engine.trigger("Test", {
      customer: { age: 25 },
    });

    const nodeExecutions = await prisma.nodeExecution.findMany({
      where: { executionId },
    });

    expect(nodeExecutions.some((n) => n.nodeLabel === "Adult Path")).toBe(true);
    expect(nodeExecutions.some((n) => n.nodeLabel === "Minor Path")).toBe(
      false
    );
  });
});
```

---

## Performance & Scalability

### Optimization Targets

| Metric                    | Current | Target |
| ------------------------- | ------- | ------ |
| Node execution time       | ~100ms  | <50ms  |
| Workflow completion time  | ~2s     | <1s    |
| Concurrent workflows      | 10      | 1000+  |
| Variable access time      | N/A     | <1ms   |
| Database queries per node | 2-3     | 1      |

### Optimization Strategies

#### 1. Caching

- Cache workflow definitions (1 hour TTL)
- Cache tenant resources (5 min TTL)
- Cache global variables (10 min TTL)

#### 2. Database Optimization

- Batch node execution logs (write every 5 nodes)
- Use database transactions for atomic updates
- Add indexes on execution lookups

#### 3. Async Execution

- Execute independent branches in parallel
- Queue long-running integrations
- Use message queue for scheduled workflows

#### 4. Resource Pooling

- Reuse HTTP clients for integrations
- Pool database connections
- Cache compiled condition expressions

---

## Next Steps

### Immediate Actions (This Week)

1. Review and approve this implementation plan
2. Create Jira tickets for Phase 1 tasks
3. Set up execution tracking tables in database
4. Begin implementing VariableResolver

### Questions to Answer

1. Should we support JavaScript expressions in conditions? (e.g., `customer.orders.length > 5`)
2. What's the maximum workflow execution time before timeout?
3. Should we implement workflow versioning (save old versions when editing)?
4. Do we need workflow testing/preview mode?

### Dependencies

- Email service account (SendGrid/AWS SES)
- Integration OAuth apps (Shopify, Stripe, etc.)
- Message queue service (BullMQ/Redis)
- Monitoring/alerting setup (execution failures)

---

**Document Owner:** Development Team  
**Last Updated:** December 29, 2024  
**Next Review:** January 5, 2025
