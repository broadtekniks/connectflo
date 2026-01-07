# Call Routing & Billing Implementation Plan

**Document Version:** 1.0  
**Created:** January 6, 2026  
**Status:** Pending Approval

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Call Routing Strategy](#call-routing-strategy)
3. [Billing Model & Plans](#billing-model--plans)
4. [Technical Implementation](#technical-implementation)
5. [Database Schema Changes](#database-schema-changes)
6. [Timeline & Phases](#timeline--phases)

---

## Executive Summary

### Problem Statement

The current implementation routes ALL incoming calls directly to AI (OpenAI Realtime API) with no option for:

- Direct extension dialing for power users
- Human escalation paths
- Traditional PBX-style routing

Additionally, billing plans need to be formalized with clear pricing models that align with actual business value.

### Key Decisions

**Call Routing:**

- ✅ **AI-First Approach**: AI answers all calls immediately (no IVR menu)
- ✅ **Optional Extension Dialing**: 5-second DTMF timeout for power users who know extensions
- ✅ **Smart Transfer**: AI uses function calling to transfer when appropriate
- ❌ **Reject IVR Menus**: Avoid "Press 1 for sales, Press 2 for support" approach (users always choose human)

**Billing Model:**

- ✅ **Conversation-Based Pricing**: Like Gorgias/Chatfuel model
- ✅ **Channel-Specific Units**: Voice calls, SMS messages, AI minutes as separate quotas
- ✅ **Overage Billing**: Clear per-unit costs when quotas exceeded
- ❌ **Reject Seat-Based**: Too complex for SMBs, doesn't align with value
- ❌ **Reject Pure Usage**: Too unpredictable, causes billing anxiety

---

## Call Routing Strategy

### 1. Default Behavior: AI-First

**User Experience:**

```
[Incoming Call] → [Optional 5-sec DTMF Timeout] → [AI Answers] → [Conversation]
                                                                    ↓
                                                          [AI Determines Intent]
                                                                    ↓
                                                    ┌───────────────┴───────────────┐
                                                    ↓                               ↓
                                        [Simple Query Resolved]         [Transfer to Human via Function Call]
                                                    ↓                               ↓
                                            [Call Ends]                    [Agent Answers]
```

**Benefits:**

- **60-70% Call Resolution**: AI handles simple queries (hours, directions, FAQs)
- **Natural UX**: No robotic menus, conversational interface
- **Smart Escalation**: AI detects complexity and transfers proactively
- **Cost Efficiency**: AI costs $0.10-$0.15/min vs human labor $15-25/hour

**When AI Transfers:**

- User explicitly requests to "speak with someone"
- Query requires domain expertise (technical support, billing issues)
- Sentiment analysis detects frustration/anger
- Task requires account access/authentication
- Transaction processing (orders, payments)

### 2. Power User Bypass: Extension Dialing

**User Experience:**

```
[Incoming Call] → [Greeting: "Welcome to ConnectFlo. If you know an extension, dial now..."]
                            ↓
                    [5-second DTMF gather timeout]
                            ↓
                ┌───────────┴───────────┐
                ↓                       ↓
        [Extension Entered]      [Timeout: No Input]
                ↓                       ↓
        [Route to Extension]      [AI Answers]
                ↓
        ┌───────┴────────┐
        ↓                ↓
   [Valid Ext]      [Invalid Ext]
        ↓                ↓
   [Connect]    [Speak: "Extension not found"] → [AI Answers]
```

**Configuration (Per Phone Number):**

- `allowExtensionDialing`: Boolean (default: `true`)
- `extensionTimeout`: Integer seconds (default: `5`, range: 3-10)
- `extensionDigits`: Integer (default: `4` digits)

**Extension Format:**

- Extensions: 1000-9999 (4 digits)
- Admin override: 0 or \*\*\* (operator/reception)
- Future: # suffix for department (e.g., 1000# = "Sales team mailbox")

**Benefits:**

- Frequent callers bypass AI instantly
- VIP customers reach account managers directly
- Internal calls (employee-to-employee) avoid AI
- Professional PBX feel for enterprise customers

### 3. After-Hours Handling

**Current Implementation:**

```typescript
enum AfterHoursMode {
  VOICEMAIL        // Play message + record voicemail
  AI_WORKFLOW      // Route to specific "after hours" workflow
}
```

**Recommended Enhancement:**

```typescript
enum AfterHoursMode {
  VOICEMAIL        // Existing: Play message + record
  AI_WORKFLOW      // Existing: Route to specific workflow
  AI_WITH_CALLBACK // New: AI takes message + schedules callback
  EMERGENCY_ONLY   // New: "Press 9 for emergency, else leave voicemail"
}
```

---

## Billing Model & Plans

### Pricing Philosophy

**Conversation-Based Approach:**

- **Unit of Value**: Actual conversations/interactions (not seats or raw minutes)
- **Predictability**: Monthly quotas with known overage rates
- **Scalability**: Plans grow with business activity
- **Fairness**: Pay for what you use, not team size

### Recommended Plan Tiers

#### **1. Starter Plan - $35/month**

**Target Customer:** Solopreneurs, freelancers, side hustles (1-2 person teams)

**Included Quotas:**

- 50 Voice Calls/month (inbound + outbound combined)
- 500 SMS Messages/month
- 20 AI Minutes/month
- 1 Phone Number
- 5 Workflows
- 10 Documents (5MB each)
- 1 Integration (e.g., Google Calendar OR Stripe)

**Limits:**

- 1 Agent Seat
- Max 2 Phone Numbers/Workflow
- Max 10 Documents/Workflow

**Overage Rates:**

- Voice: $0.20/call
- SMS: $0.02/message
- AI Minutes: $0.12/minute

**Perfect For:**

- Personal assistants
- Small consulting practices
- Appointment scheduling services
- Single-location retail shops

---

#### **2. Professional Plan - $95/month**

**Target Customer:** Small businesses, growing teams (3-10 people)

**Included Quotas:**

- 200 Voice Calls/month
- 2,000 SMS Messages/month
- 60 AI Minutes/month
- 3 Phone Numbers
- 15 Workflows
- 50 Documents (10MB each)
- 3 Integrations

**Limits:**

- 3 Agent Seats
- Max 3 Phone Numbers/Workflow
- Max 20 Documents/Workflow

**Overage Rates:**

- Voice: $0.18/call
- SMS: $0.018/message
- AI Minutes: $0.10/minute

**Perfect For:**

- Multi-location businesses
- Sales teams
- Customer support departments
- Professional services (legal, accounting)

---

#### **3. Business Plan - $250/month**

**Target Customer:** Medium businesses, call centers (10-50 people)

**Included Quotas:**

- 1,000 Voice Calls/month
- 10,000 SMS Messages/month
- 200 AI Minutes/month
- 10 Phone Numbers
- 50 Workflows
- 200 Documents (25MB each)
- 10 Integrations

**Limits:**

- 10 Agent Seats
- Max 5 Phone Numbers/Workflow
- Max 50 Documents/Workflow

**Overage Rates:**

- Voice: $0.15/call
- SMS: $0.015/message
- AI Minutes: $0.08/minute

**Perfect For:**

- Call centers
- E-commerce businesses
- SaaS companies
- Healthcare clinics

---

#### **4. Enterprise Plan - Custom Pricing**

**Target Customer:** Large enterprises, high-volume operations (50+ people)

**Included Quotas:**

- Custom Voice Calls quota
- Custom SMS Messages quota
- Custom AI Minutes quota
- Unlimited Phone Numbers
- Unlimited Workflows
- Unlimited Documents (custom size limits)
- Unlimited Integrations

**Limits:**

- Custom Agent Seats
- Custom resource limits per workflow
- Custom document size limits

**Features:**

- Dedicated account manager
- SLA guarantees (99.9% uptime)
- Priority support (1-hour response)
- Custom integrations
- White-label options
- Advanced analytics

**Overage Rates:**

- Negotiated contract rates
- Volume discounts available

---

### Pricing Rationale

**Cost Analysis (Internal):**

| Channel           | Wholesale Cost                                       | Markup | Retail Price     |
| ----------------- | ---------------------------------------------------- | ------ | ---------------- |
| Voice (Twilio)    | $0.0085/min                                          | 1,800% | $0.15-$0.20/call |
| SMS (Twilio)      | $0.0079/msg                                          | 190%   | $0.015-$0.02/msg |
| AI Voice (OpenAI) | $0.06/min input + $0.24/min output = $0.10-$0.15/min | 25%    | $0.08-$0.12/min  |

**Competitive Comparison:**

| Competitor | Model        | Price Range                  |
| ---------- | ------------ | ---------------------------- |
| Zendesk    | Seat-based   | $19-$169/agent/month         |
| Dialpad    | Seat-based   | $15-$25/user/month           |
| Aircall    | Seat-based   | $30-$50/user/month           |
| Twilio     | Pure Usage   | Pay-as-you-go (~$0.0085/min) |
| Gorgias    | Conversation | $10-$900 for 50-5K tickets   |
| Chatfuel   | Conversation | $24/1K conversations         |

**Our Positioning:**

- **Lower than seat-based** competitors (no per-agent penalty)
- **More predictable** than pure usage (monthly quotas)
- **Better value** than Gorgias for voice-heavy use cases
- **Enterprise-friendly** with custom plans

---

## Technical Implementation

### Phase 1: Extension Dialing System

**Database Schema Changes:**

```prisma
model User {
  // ... existing fields ...
  extension         String?       @unique @db.VarChar(10)  // 1000-9999 or custom
  extensionEnabled  Boolean       @default(true)
  @@index([extension])
}

model PhoneNumber {
  // ... existing fields ...
  allowExtensionDialing Boolean   @default(true)
  extensionTimeout      Int       @default(5)              // seconds
  extensionDigits       Int       @default(4)              // number of digits
  playExtensionGreeting Boolean   @default(true)
  extensionGreeting     String?   @db.VarChar(500)
}
```

**TwiML Flow (twilioWebhooks.ts):**

```typescript
// POST /voice webhook
if (phoneNumber.allowExtensionDialing) {
  const greeting =
    phoneNumber.extensionGreeting ||
    "Welcome to ConnectFlo. If you know an extension, dial it now.";

  return res.type("text/xml").send(`
    <Response>
      <Gather 
        numDigits="${phoneNumber.extensionDigits}"
        timeout="${phoneNumber.extensionTimeout}"
        action="${BACKEND_URL}/twilio/extension-input?callSid=${CallSid}&phoneNumberId=${phoneNumber.id}"
      >
        <Say>${greeting}</Say>
      </Gather>
      <!-- If no input, fall through to AI -->
      <Redirect>${BACKEND_URL}/twilio/ai-answer?callSid=${CallSid}&phoneNumberId=${phoneNumber.id}</Redirect>
    </Response>
  `);
}
```

**Extension Input Handler:**

```typescript
// POST /extension-input
router.post("/extension-input", async (req, res) => {
  const { Digits, CallSid, From } = req.body;
  const { phoneNumberId } = req.query;

  // Find user by extension
  const user = await prisma.user.findUnique({
    where: {
      extension: Digits,
      extensionEnabled: true,
      tenantId: phoneNumber.tenantId,
    },
  });

  if (user && user.phoneNumber) {
    // Valid extension - dial agent
    return res.type("text/xml").send(`
      <Response>
        <Dial timeout="20" action="/twilio/dial-status">
          <Number>${user.phoneNumber}</Number>
        </Dial>
        <!-- If no answer, offer voicemail or AI -->
        <Say>Sorry, that person is unavailable.</Say>
        <Redirect>/twilio/ai-answer?callSid=${CallSid}</Redirect>
      </Response>
    `);
  } else {
    // Invalid extension - route to AI
    return res.type("text/xml").send(`
      <Response>
        <Say>Extension not found. Connecting you to an assistant.</Say>
        <Redirect>/twilio/ai-answer?callSid=${CallSid}</Redirect>
      </Response>
    `);
  }
});
```

### Phase 2: AI Function Calling for Transfers

**OpenAI Function Definition (twilioRealtimeVoice.ts):**

```typescript
const transferTools = [
  {
    type: "function",
    name: "transfer_to_human",
    description:
      "Transfer the call to a human agent when the AI cannot resolve the query or user requests human assistance",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Reason for transfer (e.g., 'billing_issue', 'technical_support', 'sales_inquiry', 'frustrated_customer')",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgency level based on conversation sentiment",
        },
        summary: {
          type: "string",
          description: "Brief summary of conversation so far for agent context",
        },
      },
      required: ["reason", "urgency", "summary"],
    },
  },
  {
    type: "function",
    name: "transfer_to_extension",
    description: "Transfer the call to a specific extension number",
    parameters: {
      type: "object",
      properties: {
        extension: {
          type: "string",
          description: "The 4-digit extension number to transfer to",
        },
        department: {
          type: "string",
          description: "Department name (e.g., 'sales', 'support', 'billing')",
        },
      },
      required: ["extension"],
    },
  },
];

// Send tools to OpenAI
openAiWs.send(
  JSON.stringify({
    type: "session.update",
    session: {
      tools: transferTools,
      tool_choice: "auto",
    },
  })
);
```

**Function Call Handler:**

```typescript
openAiWs.on("message", async (data) => {
  const message = JSON.parse(data.toString());

  if (message.type === "response.function_call_arguments.done") {
    const { name, arguments: args } = message;

    if (name === "transfer_to_human") {
      const { reason, urgency, summary } = JSON.parse(args);

      // Find available agent
      const agent = await findAvailableAgent(tenantId, reason);

      if (agent) {
        // Log transfer reason for analytics
        await prisma.callTransfer.create({
          data: {
            callSid,
            fromAI: true,
            toUserId: agent.id,
            reason,
            urgency,
            conversationSummary: summary,
            tenantId,
          },
        });

        // Initiate transfer via Twilio
        await twilioClient.calls(callSid).update({
          twiml: `
            <Response>
              <Say>Transferring you to ${
                agent.name || "an agent"
              }. Please hold.</Say>
              <Dial timeout="30">
                <Number>${agent.phoneNumber}</Number>
              </Dial>
            </Response>
          `,
        });

        // Close OpenAI WebSocket
        openAiWs.close();
      } else {
        // No agents available
        openAiWs.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: "No agents are currently available. Offer to take a message or schedule a callback.",
                },
              ],
            },
          })
        );
      }
    }
  }
});
```

**Agent Availability Service:**

```typescript
// services/agentAvailability.ts
interface AgentStatus {
  userId: string;
  available: boolean;
  onCall: boolean;
  lastActivity: Date;
}

async function findAvailableAgent(
  tenantId: string,
  reason: string
): Promise<User | null> {
  // Priority 1: Find agents with matching specialization
  const specialized = await prisma.user.findFirst({
    where: {
      tenantId,
      role: "AGENT",
      extensionEnabled: true,
      agentStatus: "AVAILABLE",
      specializations: { has: reason },
    },
    orderBy: {
      lastCallAt: "asc", // Least recently called
    },
  });

  if (specialized) return specialized;

  // Priority 2: Any available agent
  return prisma.user.findFirst({
    where: {
      tenantId,
      role: "AGENT",
      extensionEnabled: true,
      agentStatus: "AVAILABLE",
    },
    orderBy: {
      lastCallAt: "asc",
    },
  });
}
```

### Phase 3: Billing Implementation

**Database Schema (Plan Pricing):**

```prisma
model Plan {
  // ... existing fields ...

  // Pricing
  basePrice             Float     @default(0)           // Monthly base fee
  agentSeats            Int       @default(1)           // Number of agent seats included
  additionalSeatPrice   Float     @default(0)           // Cost per additional seat

  // Voice Quotas
  voiceCallsIncluded    Int       @default(0)           // Monthly voice call quota
  voiceOverageRate      Float     @default(0)           // Per-call overage rate

  // SMS Quotas
  smsMessagesIncluded   Int       @default(0)           // Monthly SMS quota
  smsOverageRate        Float     @default(0)           // Per-message overage rate

  // AI Quotas
  aiMinutesIncluded     Int       @default(0)           // Monthly AI minutes quota
  aiOverageRate         Float     @default(0)           // Per-minute overage rate

  // Resource Limits (existing)
  documentLimit         Int       @default(5)
  docSizeLimitMB        Int       @default(10)
  maxWorkflows          Int       @default(10)
  maxPhoneNumbersPerWorkflow  Int @default(2)
  maxIntegrationsPerWorkflow  Int @default(3)
  maxDocumentsPerWorkflow     Int @default(10)
}

model Subscription {
  id              String    @id @default(cuid())
  tenantId        String    @unique
  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  planId          String
  plan            Plan      @relation(fields: [planId], references: [id])

  status          SubscriptionStatus  @default(ACTIVE)
  currentPeriodStart  DateTime
  currentPeriodEnd    DateTime

  // Usage tracking
  voiceCallsUsed      Int       @default(0)
  smsMessagesUsed     Int       @default(0)
  aiMinutesUsed       Float     @default(0)

  // Billing
  stripeCustomerId        String?   @unique
  stripeSubscriptionId    String?   @unique
  lastBillingDate         DateTime?
  nextBillingDate         DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([tenantId])
  @@index([status])
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}
```

**Seed Data (Initial Plans):**

```typescript
// prisma/seed.ts
const plans = [
  {
    name: "Starter",
    description: "Perfect for solopreneurs and small teams",
    basePrice: 35,
    agentSeats: 1,
    additionalSeatPrice: 20,
    voiceCallsIncluded: 50,
    voiceOverageRate: 0.2,
    smsMessagesIncluded: 500,
    smsOverageRate: 0.02,
    aiMinutesIncluded: 20,
    aiOverageRate: 0.12,
    documentLimit: 10,
    docSizeLimitMB: 5,
    maxWorkflows: 5,
    maxPhoneNumbersPerWorkflow: 2,
    maxIntegrationsPerWorkflow: 1,
    maxDocumentsPerWorkflow: 10,
  },
  {
    name: "Professional",
    description: "For growing businesses and teams",
    basePrice: 95,
    agentSeats: 3,
    additionalSeatPrice: 18,
    voiceCallsIncluded: 200,
    voiceOverageRate: 0.18,
    smsMessagesIncluded: 2000,
    smsOverageRate: 0.018,
    aiMinutesIncluded: 60,
    aiOverageRate: 0.1,
    documentLimit: 50,
    docSizeLimitMB: 10,
    maxWorkflows: 15,
    maxPhoneNumbersPerWorkflow: 3,
    maxIntegrationsPerWorkflow: 3,
    maxDocumentsPerWorkflow: 20,
  },
  {
    name: "Business",
    description: "For call centers and medium businesses",
    basePrice: 250,
    agentSeats: 10,
    additionalSeatPrice: 15,
    voiceCallsIncluded: 1000,
    voiceOverageRate: 0.15,
    smsMessagesIncluded: 10000,
    smsOverageRate: 0.015,
    aiMinutesIncluded: 200,
    aiOverageRate: 0.08,
    documentLimit: 200,
    docSizeLimitMB: 25,
    maxWorkflows: 50,
    maxPhoneNumbersPerWorkflow: 5,
    maxIntegrationsPerWorkflow: 10,
    maxDocumentsPerWorkflow: 50,
  },
];

for (const plan of plans) {
  await prisma.plan.upsert({
    where: { name: plan.name },
    update: plan,
    create: plan,
  });
}
```

**Usage Aggregation Service:**

```typescript
// services/billing.ts
export class BillingService {
  async calculateMonthlyUsage(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    const usage = await prisma.usageRecord.groupBy({
      by: ["type"],
      where: {
        tenantId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _sum: {
        quantity: true,
        wholesaleCost: true,
        retailPrice: true,
      },
    });

    return {
      voiceCalls:
        usage.find(
          (u) => u.type === "VOICE_INBOUND" || u.type === "VOICE_OUTBOUND"
        )?._sum.quantity || 0,
      smsMessages:
        usage.find((u) => u.type === "SMS_INBOUND" || u.type === "SMS_OUTBOUND")
          ?._sum.quantity || 0,
      aiMinutes:
        usage.find(
          (u) => u.type === "AI_TOKENS_INPUT" || u.type === "AI_TOKENS_OUTPUT"
        )?._sum.quantity || 0,
      totalCost: usage.reduce((sum, u) => sum + (u._sum.retailPrice || 0), 0),
    };
  }

  async calculateOverages(tenantId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) throw new Error("No subscription found");

    const usage = await this.calculateMonthlyUsage(
      tenantId,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd
    );

    const overages = {
      voice: Math.max(
        0,
        usage.voiceCalls - subscription.plan.voiceCallsIncluded
      ),
      sms: Math.max(
        0,
        usage.smsMessages - subscription.plan.smsMessagesIncluded
      ),
      aiMinutes: Math.max(
        0,
        usage.aiMinutes - subscription.plan.aiMinutesIncluded
      ),
    };

    const overageCosts = {
      voice: overages.voice * subscription.plan.voiceOverageRate,
      sms: overages.sms * subscription.plan.smsOverageRate,
      aiMinutes: overages.aiMinutes * subscription.plan.aiOverageRate,
      total: 0,
    };

    overageCosts.total =
      overageCosts.voice + overageCosts.sms + overageCosts.aiMinutes;

    return { usage, overages, overageCosts };
  }
}
```

---

## Database Schema Changes

### Summary of New/Modified Models

```prisma
// User extensions
model User {
  extension         String?   @unique
  extensionEnabled  Boolean   @default(true)
  agentStatus       AgentStatus @default(OFFLINE)
  specializations   String[]  // e.g., ["billing_issue", "technical_support"]
  lastCallAt        DateTime?
}

enum AgentStatus {
  AVAILABLE
  ON_CALL
  AWAY
  OFFLINE
}

// PhoneNumber extensions
model PhoneNumber {
  allowExtensionDialing Boolean   @default(true)
  extensionTimeout      Int       @default(5)
  extensionDigits       Int       @default(4)
  playExtensionGreeting Boolean   @default(true)
  extensionGreeting     String?
}

// Plan pricing
model Plan {
  basePrice             Float
  agentSeats            Int
  additionalSeatPrice   Float
  voiceCallsIncluded    Int
  voiceOverageRate      Float
  smsMessagesIncluded   Int
  smsOverageRate        Float
  aiMinutesIncluded     Int
  aiOverageRate         Float
}

// New: Subscription
model Subscription {
  id                      String    @id @default(cuid())
  tenantId                String    @unique
  planId                  String
  status                  SubscriptionStatus
  currentPeriodStart      DateTime
  currentPeriodEnd        DateTime
  voiceCallsUsed          Int
  smsMessagesUsed         Int
  aiMinutesUsed           Float
  stripeCustomerId        String?
  stripeSubscriptionId    String?
}

// New: Call Transfer Tracking
model CallTransfer {
  id                    String    @id @default(cuid())
  callSid               String
  fromAI                Boolean
  toUserId              String
  reason                String
  urgency               String
  conversationSummary   String?
  transferredAt         DateTime  @default(now())
  tenantId              String
}
```

---

## Timeline & Phases

### Phase 1: Extension Dialing (Week 1-2)

**Deliverables:**

- ✅ Database migration: Add extension fields to User and PhoneNumber models
- ✅ TwiML update: Add `<Gather>` for DTMF collection
- ✅ POST /extension-input endpoint
- ✅ Extension lookup service
- ✅ Admin UI: Extension management in Settings

**Testing:**

- Call and enter valid extension → Routes to agent
- Call and enter invalid extension → Falls back to AI
- Call and wait (no input) → Falls back to AI after timeout
- Disable extension dialing on phone number → Goes straight to AI

**Estimate:** 12-16 hours

---

### Phase 2: AI Function Calling (Week 2-3)

**Deliverables:**

- ✅ OpenAI function definitions (transfer_to_human, transfer_to_extension)
- ✅ Function call handlers in twilioRealtimeVoice.ts
- ✅ Agent availability service (findAvailableAgent)
- ✅ CallTransfer model and tracking
- ✅ Analytics: Transfer reasons, AI resolution rate

**Testing:**

- AI conversation → User says "I want to speak to someone" → Transfers
- AI detects complexity → Proactively transfers
- No agents available → AI takes message
- Track transfer reasons in dashboard

**Estimate:** 16-20 hours

---

### Phase 3: Billing Database (Week 3-4)

**Deliverables:**

- ✅ Database migration: Add pricing fields to Plan model
- ✅ Create Subscription model
- ✅ Seed initial plans (Starter, Professional, Business)
- ✅ BillingService implementation
- ✅ Usage aggregation and overage calculation

**Testing:**

- Create subscription → Tracks usage correctly
- Usage exceeds quota → Calculates overages
- Monthly rollover → Resets usage counters
- Plan upgrade/downgrade → Pro-rates correctly

**Estimate:** 16-20 hours

---

### Phase 4: Stripe Integration (Week 4-6)

**Deliverables:**

- ✅ Stripe account setup and API keys
- ✅ Product and price creation in Stripe
- ✅ Webhook handlers (invoice.paid, subscription.updated)
- ✅ Payment method management
- ✅ Subscription lifecycle (create, upgrade, cancel)

**Testing:**

- User subscribes → Stripe subscription created
- Monthly billing → Invoice generated and paid
- Payment fails → Subscription marked PAST_DUE
- User cancels → Subscription canceled at period end

**Estimate:** 24-32 hours

---

### Phase 5: Billing UI (Week 6-7)

**Deliverables:**

- ✅ Pricing page (public)
- ✅ Plan selection and checkout flow
- ✅ Billing dashboard (usage meters, invoices)
- ✅ Payment method management
- ✅ Plan upgrade/downgrade UI

**Pages:**

- `/pricing` - Public pricing table with plan comparison
- `/billing` - Tenant billing dashboard (current plan, usage, invoices)
- `/billing/upgrade` - Plan upgrade flow
- `/billing/payment-methods` - Manage credit cards

**Estimate:** 24-32 hours

---

### Total Implementation Timeline

- **Phase 1 (Extension Dialing):** 12-16 hours → ~2 weeks
- **Phase 2 (AI Transfers):** 16-20 hours → ~2 weeks
- **Phase 3 (Billing DB):** 16-20 hours → ~2 weeks
- **Phase 4 (Stripe):** 24-32 hours → ~3 weeks
- **Phase 5 (Billing UI):** 24-32 hours → ~3 weeks

**Total:** 92-120 hours → **12-15 weeks** (part-time) or **6-7 weeks** (full-time)

---

## Success Metrics

### Call Routing KPIs

- **AI Resolution Rate:** Target 60-70% of calls resolved without human
- **Extension Dialing Usage:** % of calls that use extension bypass
- **Transfer Reasons:** Top 5 reasons for AI→human transfers
- **Average Handle Time:** AI vs human conversation duration
- **Customer Satisfaction:** Post-call CSAT scores (AI vs human)

### Billing KPIs

- **Subscription Conversion:** % of free trials that convert to paid
- **Plan Distribution:** % of customers on each tier
- **Average Revenue Per Account (ARPA):** Monthly revenue / active subscriptions
- **Overage Revenue:** % of total revenue from overages
- **Churn Rate:** % of subscriptions canceled monthly
- **Expansion Revenue:** Upgrades vs downgrades

---

## Risk Assessment

### Technical Risks

**Risk:** OpenAI function calling is unreliable for transfers  
**Mitigation:** Add fallback DTMF option ("Press 0 for an agent anytime")

**Risk:** Extension dialing conflicts with existing workflows  
**Mitigation:** Make it optional per phone number, disabled by default

**Risk:** Agent availability service is inaccurate  
**Mitigation:** Real-time presence tracking via WebSocket heartbeats

### Business Risks

**Risk:** Users abuse AI to avoid paying for seats  
**Mitigation:** Cap AI minutes aggressively, encourage seat purchases with discounts

**Risk:** Overage billing causes customer complaints  
**Mitigation:** Usage alerts at 80%, 90%, 100% of quota; grace period for first overage

**Risk:** Competitors undercut pricing  
**Mitigation:** Focus on value (AI + human hybrid), not price; emphasize ROI

---

## Appendix

### Competitor Pricing (Full Analysis)

See full competitive research in conversation history for detailed comparison of:

- Zendesk (Seat-based: $19-$169/agent)
- Dialpad (Seat-based: $15-$25/user)
- Aircall (Seat-based: $30-$50/user)
- Twilio (Pure usage: $0.0085/min)
- Voiceflow (Token/credit-based)
- Bird (Tiered consumption)
- Respond.io (MAC model)
- Landbot (Chat quotas)
- ManyChat (Contact-based)
- Gorgias (Conversation-based: $10-$900)
- Chatfuel (Conversation-based: $24/1K)

### Cost Structure (Internal)

**Voice (Twilio):**

- Inbound: $0.0085/min
- Outbound: $0.013/min
- Average: ~$0.01/min
- **Markup:** 1,500-2,000% → $0.15-$0.20/call (avg 2-3 min)

**SMS (Twilio):**

- Inbound: Free
- Outbound: $0.0079/segment
- **Markup:** 190-250% → $0.015-$0.02/message

**AI (OpenAI Realtime):**

- Audio Input: $0.06/min
- Audio Output: $0.24/min
- Average: $0.10-$0.15/min (33% input, 67% output)
- **Markup:** 0-25% → $0.08-$0.12/min (competitive pricing)

### Example Invoices

**Starter Plan ($35/month) - Under Quota:**

- Base: $35.00
- Usage: 40 calls, 300 SMS, 15 AI min
- Overage: $0.00
- **Total: $35.00**

**Starter Plan ($35/month) - With Overages:**

- Base: $35.00
- Usage: 75 calls, 800 SMS, 35 AI min
- Overage: (25 × $0.20) + (300 × $0.02) + (15 × $0.12) = $5.00 + $6.00 + $1.80 = $12.80
- **Total: $47.80**

**Professional Plan ($95/month) - Typical Usage:**

- Base: $95.00
- Usage: 180 calls, 1,800 SMS, 55 AI min
- Overage: $0.00
- **Total: $95.00**

---

## Approval & Sign-off

**Prepared by:** GitHub Copilot (AI Assistant)  
**Date:** January 6, 2026  
**Status:** ⏳ Pending Approval

**Decision Required:**

- [ ] Approve call routing strategy (AI-first + extension dialing)
- [ ] Approve billing model (Conversation-Based pricing)
- [ ] Approve plan tiers and pricing (Starter $35, Pro $95, Business $250)
- [ ] Approve implementation timeline (6-7 weeks full-time)
- [ ] Authorize Phase 1 development (Extension Dialing)

**Next Steps After Approval:**

1. Create database migration for Phase 1 (extension fields)
2. Implement TwiML changes for DTMF gathering
3. Build extension lookup service
4. Add extension management to Settings UI
5. Test end-to-end call flow

---

**Document End**
