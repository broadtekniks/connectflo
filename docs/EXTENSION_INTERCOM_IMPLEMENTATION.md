# Internal Extension Calling (Intercom/VoIP) - Feasibility & Implementation

**Document Version:** 1.0  
**Created:** January 6, 2026  
**Status:** Ready for Implementation

---

## Executive Summary

### Is Internal Calling Without PSTN Possible?

**✅ YES - Absolutely Feasible**

Using **Twilio Client SDK (WebRTC)**, internal calls between extensions can be made **completely free** without touching the PSTN network. Your application **already has this infrastructure implemented** (see [AGENT_WEB_PHONE_GUIDE.md](AGENT_WEB_PHONE_GUIDE.md)).

### Current Implementation Status

**✅ Already Built (60% Complete):**

- Twilio Voice JavaScript SDK integration ([WebPhoneDialer.tsx](components/WebPhoneDialer.tsx))
- Client identity system (`tenant_X_user_Y`) ([twilioClientIdentity.ts](backend/src/services/twilioClientIdentity.ts))
- Voice token generation endpoint
- Browser-based calling (inbound/outbound)
- TwiML `<Dial><Client>` support

**🔄 Needs Extension:**

- Extension number assignment (101, 102, etc.)
- Extension directory/lookup service
- Direct extension dialing UI
- Extension-to-extension routing without PSTN
- Call transfer between extensions

---

## Table of Contents

1. [Technology Overview](#technology-overview)
2. [Cost Analysis](#cost-analysis)
3. [Conference & Transfer Capabilities](#conference--transfer-capabilities)
4. [Architecture Options](#architecture-options)
5. [Recommended Implementation](#recommended-implementation)
6. [Database Schema](#database-schema)
7. [Backend Implementation](#backend-implementation)
8. [Frontend Implementation](#frontend-implementation)
9. [Call Flow Diagrams](#call-flow-diagrams)
10. [Cost Savings Projection](#cost-savings-projection)
11. [Migration Path](#migration-path)

---

## Technology Overview

### 1. Twilio Client SDK (Recommended - Already Implemented)

**What It Is:**

- WebRTC-based voice SDK for browsers and mobile apps
- Enables VoIP calling between "Client Identities" (virtual devices)
- Calls between clients bypass PSTN entirely (no per-minute charges)

**How It Works:**

```
Extension 101 (Browser) → Twilio Cloud → Extension 102 (Browser)
                    ↑
              WebRTC/SIP (No PSTN involved)
```

**Pricing:**

- **Client-to-Client calls: $0.0000/min** (FREE!)
- **Client-to-PSTN calls: $0.013/min** (regular Twilio outbound rate)
- **PSTN-to-Client calls: $0.0085/min** (regular Twilio inbound rate)

**Your Current Implementation:**

- ✅ Twilio Device SDK initialized in [WebPhoneDialer.tsx](components/WebPhoneDialer.tsx) (line 185)
- ✅ Voice token endpoint: `GET /api/twilio/voice-token`
- ✅ Client identity format: `tenant_{tenantId}_user_{userId}`
- ✅ Outbound TwiML handler: `POST /webhooks/twilio/client-voice`
- ✅ Inbound TwiML with `<Client>` support in `buildTwilioDialTwiml()`

### 2. Alternative: Pure WebRTC (Not Recommended)

**Pros:**

- No Twilio dependency
- Complete control

**Cons:**

- Requires signaling server (Socket.IO/WebSocket)
- Need STUN/TURN servers for NAT traversal ($$$)
- Complex peer connection management
- Audio codec negotiation
- No PSTN fallback
- **Estimated effort: 6-8 weeks vs 2-3 days with Twilio**

**Verdict:** ❌ Not worth rebuilding what Twilio already provides

### 3. Alternative: SIP-Based PBX (Asterisk, FreeSWITCH)

**Pros:**

- Traditional PBX features (call parking, paging, conferencing)
- SIP trunk integration

**Cons:**

- Requires dedicated PBX server
- Complex infrastructure (SIP registrar, dialplan, etc.)
- High operational overhead
- **Your app is multi-tenant SaaS** - each tenant would need isolated PBX

**Verdict:** ❌ Overkill for current requirements

---

## Conference & Transfer Capabilities

### ✅ YES - Full Support for Conferencing and Transfer

Twilio Client SDK and TwiML provide **comprehensive support** for both call conferencing and call transfer. Here's what's possible:

---

### 1. Call Transfer (Warm Transfer / Attended Transfer)

**What It Is:**
Agent talks to another agent/extension privately before transferring the customer call.

**How It Works:**

```
Customer ←→ Agent 101 (Browser)
                ↓
Agent 101 puts customer on hold (mute customer audio)
                ↓
Agent 101 calls Extension 102 (VoIP - FREE)
                ↓
Agent 101 talks privately with Extension 102
                ↓
Agent 101 merges calls into 3-way conference
                ↓
Customer ←→ Conference ←→ Agent 102
                ↓
Agent 101 drops out → Customer ←→ Agent 102
```

**Implementation:**

```typescript
// Client SDK (Browser)
const activeCall = device.activeConnection();

// Step 1: Put customer on hold
activeCall.mute(true);

// Step 2: Call extension (creates second connection)
const consultCall = await device.connect({ extension: "102" });

// Step 3: Talk privately (customer is muted)
// ... conversation with agent 102 ...

// Step 4: Merge into conference (3-way)
// Use Twilio REST API to modify call
await fetch("/api/calls/conference", {
  method: "POST",
  body: JSON.stringify({
    callSid: activeCall.parameters.CallSid,
    targetExtension: "102",
  }),
});

// Step 5: Agent 101 drops out (optional)
activeCall.disconnect();
// Now customer is connected directly to Agent 102
```

**TwiML Backend:**

```typescript
// POST /api/calls/conference
async function createConference(req, res) {
  const { callSid, targetExtension } = req.body;

  // Create unique conference room
  const conferenceName = `transfer-${callSid}-${Date.now()}`;

  // Move original call to conference
  await twilioClient.calls(callSid).update({
    twiml: `
      <Response>
        <Dial>
          <Conference 
            beep="false" 
            endConferenceOnExit="false"
            statusCallback="/api/calls/conference-status"
          >
            ${conferenceName}
          </Conference>
        </Dial>
      </Response>
    `,
  });

  // Dial target extension into same conference
  const target = await extensionDirectory.findByExtension(
    tenantId,
    targetExtension
  );
  const clientIdentity = toTwilioClientIdentity({
    tenantId,
    userId: target.userId,
  });

  await twilioClient.calls.create({
    from: callerId,
    to: `client:${clientIdentity}`,
    twiml: `
      <Response>
        <Dial>
          <Conference 
            beep="false"
            endConferenceOnExit="true"
            statusCallback="/api/calls/conference-status"
          >
            ${conferenceName}
          </Conference>
        </Dial>
      </Response>
    `,
  });
}
```

**Cost:**

- **Warm transfer between extensions (VoIP): FREE** ($0.00/min for consult call)
- **Conference bridge:** Included (no extra charge)
- **Total cost:** Only PSTN legs are charged

---

### 2. Blind Transfer (Cold Transfer)

**What It Is:**
Agent transfers customer immediately without talking to target agent first.

**How It Works:**

```
Customer ←→ Agent 101
                ↓
Agent 101 initiates blind transfer to Extension 102
                ↓
Customer ←→ Extension 102 (Agent 101 disconnects)
```

**Implementation:**

```typescript
// Client SDK (Browser)
const activeCall = device.activeConnection();

// Blind transfer - agent disconnects immediately
await fetch("/api/calls/blind-transfer", {
  method: "POST",
  body: JSON.stringify({
    callSid: activeCall.parameters.CallSid,
    targetExtension: "102",
  }),
});

activeCall.disconnect(); // Agent 101 leaves
```

**TwiML Backend:**

```typescript
// POST /api/calls/blind-transfer
async function blindTransfer(req, res) {
  const { callSid, targetExtension } = req.body;

  const target = await extensionDirectory.findByExtension(
    tenantId,
    targetExtension
  );

  if (!target) {
    return res.status(404).json({ error: "Extension not found" });
  }

  const clientIdentity = toTwilioClientIdentity({
    tenantId,
    userId: target.userId,
  });

  // Redirect call to target extension
  await twilioClient.calls(callSid).update({
    twiml: `
      <Response>
        <Say voice="alice">Transferring to extension ${targetExtension}.</Say>
        <Dial timeout="20" action="/api/calls/transfer-action">
          <Client>${clientIdentity}</Client>
        </Dial>
        <Say voice="alice">The transfer failed. Please try again.</Say>
        <Hangup/>
      </Response>
    `,
  });

  res.json({ success: true });
}
```

**Cost:**

- **Transfer to online extension (VoIP): FREE**
- **Transfer to offline extension (PSTN fallback): $0.013/min**

---

### 3. Three-Way Conference

**What It Is:**
Customer, Agent 101, and Agent 102 all on the call simultaneously.

**How It Works:**

```
Customer ←→ Conference Room ←→ Agent 101 (Browser)
              ↑
              └→ Agent 102 (Browser) - VoIP
```

**Implementation:**

```typescript
// Client SDK (Browser) - Agent 101
const activeCall = device.activeConnection();

// Create conference and add Agent 102
await fetch("/api/calls/add-to-conference", {
  method: "POST",
  body: JSON.stringify({
    callSid: activeCall.parameters.CallSid,
    extensionToAdd: "102",
  }),
});

// Agent 102 joins via VoIP - still FREE!
```

**TwiML Backend:**

```typescript
// POST /api/calls/add-to-conference
async function addToConference(req, res) {
  const { callSid, extensionToAdd } = req.body;

  const conferenceName = `conf-${callSid}`;

  // Move customer + agent to conference
  await twilioClient.calls(callSid).update({
    twiml: `
      <Response>
        <Dial>
          <Conference 
            beep="onEnter" 
            endConferenceOnExit="false"
            maxParticipants="10"
          >
            ${conferenceName}
          </Conference>
        </Dial>
      </Response>
    `,
  });

  // Dial extension into conference
  const target = await extensionDirectory.findByExtension(
    tenantId,
    extensionToAdd
  );
  const clientIdentity = toTwilioClientIdentity({
    tenantId,
    userId: target.userId,
  });

  await twilioClient.calls.create({
    from: callerId,
    to: `client:${clientIdentity}`,
    twiml: `
      <Response>
        <Dial>
          <Conference 
            beep="onEnter"
            endConferenceOnExit="false"
          >
            ${conferenceName}
          </Conference>
        </Dial>
      </Response>
    `,
  });

  res.json({ success: true, conferenceName });
}
```

**Features:**

- Up to **10 participants** per conference
- VoIP participants are **FREE**
- PSTN participants charged normal rates
- Conference controls: mute, hold, kick participants

---

### 4. Call Hold / Resume

**What It Is:**
Put customer on hold (play music), then resume.

**Implementation:**

```typescript
// Client SDK (Browser)
const activeCall = device.activeConnection();

// Hold customer (mute their audio + play hold music)
await fetch("/api/calls/hold", {
  method: "POST",
  body: JSON.stringify({
    callSid: activeCall.parameters.CallSid,
    onHold: true,
  }),
});

// Resume
await fetch("/api/calls/hold", {
  method: "POST",
  body: JSON.stringify({
    callSid: activeCall.parameters.CallSid,
    onHold: false,
  }),
});
```

**TwiML Backend:**

```typescript
// POST /api/calls/hold
async function toggleHold(req, res) {
  const { callSid, onHold } = req.body;

  if (onHold) {
    // Play hold music
    await twilioClient.calls(callSid).update({
      twiml: `
        <Response>
          <Play loop="0">https://example.com/hold-music.mp3</Play>
        </Response>
      `,
    });
  } else {
    // Resume original call flow
    await twilioClient.calls(callSid).update({
      twiml: `
        <Response>
          <Say voice="alice">Thank you for holding.</Say>
          <Connect>
            <Stream url="${process.env.PUBLIC_URL}/ws/twilio" />
          </Connect>
        </Response>
      `,
    });
  }

  res.json({ success: true });
}
```

---

### 5. Transfer to External Number

**What It Is:**
Transfer call from extension to external PSTN number (customer's phone, external support).

**Implementation:**

```typescript
// Blind transfer to external number
await fetch("/api/calls/blind-transfer", {
  method: "POST",
  body: JSON.stringify({
    callSid: activeCall.parameters.CallSid,
    targetNumber: "+15551234567", // External number
  }),
});
```

**TwiML:**

```xml
<Response>
  <Say voice="alice">Transferring to external number.</Say>
  <Dial callerId="+1800COMPANY">
    <Number>+15551234567</Number>
  </Dial>
</Response>
```

**Cost:**

- External transfer: **$0.013/min** (regular Twilio outbound rate)

---

### Conference & Transfer Cost Summary

| Feature                     | Agent-to-Agent        | Agent-to-External               | Customer Leg |
| --------------------------- | --------------------- | ------------------------------- | ------------ |
| **Warm Transfer (Consult)** | FREE (VoIP)           | $0.013/min (PSTN)               | Included     |
| **Blind Transfer**          | FREE (VoIP)           | $0.013/min (PSTN)               | Included     |
| **3-Way Conference**        | FREE per agent (VoIP) | $0.013/min per PSTN participant | Included     |
| **Hold/Resume**             | N/A                   | N/A                             | Included     |

**Key Insight:** Conference and transfer between extensions using **VoIP is completely FREE**. Only PSTN legs incur charges.

---

## Cost Analysis

### Current Cost (PSTN-Only Internal Calls)

**Scenario:** Agent A calls Agent B (both in same office/tenant)

```
Current Flow:
Agent A Browser → PSTN ($0.013/min) → Twilio → PSTN ($0.0085/min) → Agent B Phone

Cost per minute: $0.0215/min
Cost per 30-min call: $0.65
```

### Future Cost (Extension-to-Extension VoIP)

**Scenario:** Agent 101 calls Extension 102 (both have web phone enabled)

```
New Flow:
Extension 101 Browser → Twilio Cloud (WebRTC) → Extension 102 Browser

Cost per minute: $0.00/min ✅ FREE
Cost per 30-min call: $0.00
```

### Hybrid Cost (PSTN Fallback When Offline)

**Scenario:** Extension 101 calls Extension 102, but Agent 102's web phone is offline

```
Hybrid Flow:
Extension 101 Browser → Twilio Cloud → PSTN ($0.013/min) → Agent 102 Phone

Cost per minute: $0.013/min (50% savings vs current)
Cost per 30-min call: $0.39
```

### Annual Savings Example

**Assumptions:**

- 10 agents
- 50 internal calls/day (average 5 min each)
- 250 working days/year
- 70% of agents have web phone enabled

**Current Annual Cost:**

```
250 days × 50 calls × 5 min × $0.0215/min = $2,687.50/year
```

**With Extension System (70% VoIP, 30% PSTN fallback):**

```
VoIP: 250 × 50 × 0.7 × 5 × $0.00 = $0.00
PSTN: 250 × 50 × 0.3 × 5 × $0.013 = $243.75
Total: $243.75/year
Savings: $2,443.75/year (91% reduction)
```

**For 100-agent call center:**

- Current: $26,875/year
- With VoIP: $2,437.50/year
- **Savings: $24,437.50/year**

---

## Architecture Options

### Option A: Extension = User ID (Simplest)

**Mapping:**

```typescript
extension: "101" → userId: "clx123..."
extension: "102" → userId: "clx456..."
```

**Pros:**

- Simple 1:1 mapping
- Extension uniqueness guaranteed by User.id uniqueness
- Easy to implement

**Cons:**

- Can't share extensions across devices
- Can't transfer extension when employee leaves

**Verdict:** ✅ Recommended for MVP

---

### Option B: Extension = Separate Resource (Enterprise)

**Mapping:**

```typescript
model Extension {
  id        String  @id @default(cuid())
  number    String  @unique    // "101"
  tenantId  String
  userId    String?             // Can be reassigned
  label     String?             // "Sales Desk"
  deviceIds String[]            // Multiple devices
}
```

**Pros:**

- Extensions are portable (reassign when employee leaves)
- Multiple devices per extension (desk phone + mobile)
- Department extensions (ring multiple people)
- Better for enterprise use cases

**Cons:**

- More complex schema
- Additional UI for extension management

**Verdict:** 🔄 Phase 2 (Future Enhancement)

---

## Recommended Implementation

### Extension System Architecture (Option A - Simple)

**Components:**

1. **User Model Extension**

   - Add `extension` field (unique within tenant)
   - Add `extensionEnabled` field (privacy control)
   - Extensions: 3-4 digit numbers (100-9999)

2. **Extension Directory Service**

   - Fast lookup: extension → userId
   - Availability check: Is web phone online?
   - TenantId scoping (extension 101 in Tenant A ≠ extension 101 in Tenant B)

3. **Call Routing Logic**

   - If destination is extension → Route via `<Client>` (VoIP)
   - If web phone offline → Fallback to PSTN (`User.forwardingPhoneNumber`)
   - Track which path was used for billing

4. **UI Components**
   - Extension assignment in Settings
   - Extension directory/picker in dialpad
   - Presence indicators (Available, Busy, Offline)

---

## Database Schema

### User Model Extensions

```prisma
model User {
  // ... existing fields ...

  // Extension System
  extension         String?       @db.VarChar(10)        // e.g., "101", "5432"
  extensionEnabled  Boolean       @default(true)         // Allow others to dial extension
  extensionLabel    String?       @db.VarChar(100)       // e.g., "Sales Manager"

  // Web Phone Presence
  webPhoneStatus    WebPhoneStatus @default(OFFLINE)
  webPhoneLastSeen  DateTime?

  @@unique([tenantId, extension])  // Extension unique within tenant
  @@index([extension])              // Fast extension lookup
}

enum WebPhoneStatus {
  ONLINE          // Web phone connected and ready
  BUSY            // On a call
  AWAY            // Browser open but user idle
  OFFLINE         // Web phone disconnected
}
```

### CallLog Enhancement (Track Internal Calls)

```prisma
model CallLog {
  // ... existing fields ...

  // Extension Tracking
  fromExtension     String?       @db.VarChar(10)
  toExtension       String?       @db.VarChar(10)
  callType          CallType      @default(EXTERNAL)
  cost              Float         @default(0)           // $0 for internal VoIP

  @@index([fromExtension])
  @@index([toExtension])
}

enum CallType {
  EXTERNAL          // PSTN involved
  INTERNAL_VOIP     // Extension-to-extension (free)
  INTERNAL_PSTN     // Extension-to-extension but fallback to PSTN
}
```

---

## Backend Implementation

### Phase 1: Extension Assignment & Directory

#### 1. Extension Service

```typescript
// backend/src/services/extensionDirectory.ts

import prisma from "../lib/prisma";
import { isWebPhoneReady } from "./webPhonePresence";

export class ExtensionDirectory {
  /**
   * Find user by extension number (tenant-scoped)
   */
  async findByExtension(
    tenantId: string,
    extension: string
  ): Promise<{ userId: string; name: string; available: boolean } | null> {
    const user = await prisma.user.findUnique({
      where: {
        tenantId_extension: {
          tenantId,
          extension: extension.trim(),
        },
      },
      select: {
        id: true,
        name: true,
        extensionEnabled: true,
        forwardingPhoneNumber: true,
        webPhoneStatus: true,
      },
    });

    if (!user || !user.extensionEnabled) return null;

    // Check if web phone is actually connected (real-time via Socket.IO presence)
    const isOnline = isWebPhoneReady(tenantId, user.id);

    return {
      userId: user.id,
      name: user.name || "Unknown",
      available: isOnline && user.webPhoneStatus === "ONLINE",
    };
  }

  /**
   * List all extensions in tenant
   */
  async listExtensions(tenantId: string) {
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        extension: { not: null },
        extensionEnabled: true,
      },
      select: {
        id: true,
        extension: true,
        extensionLabel: true,
        name: true,
        email: true,
        webPhoneStatus: true,
        forwardingPhoneNumber: true,
      },
      orderBy: { extension: "asc" },
    });

    return users.map((u) => ({
      extension: u.extension!,
      label: u.extensionLabel || u.name || "Unknown",
      name: u.name,
      email: u.email,
      status: u.webPhoneStatus,
      hasWebPhone: isWebPhoneReady(tenantId, u.id),
      hasPSTNFallback: Boolean(u.forwardingPhoneNumber),
    }));
  }

  /**
   * Assign extension to user
   */
  async assignExtension(userId: string, tenantId: string, extension: string) {
    // Validate extension format (3-4 digits)
    if (!/^\d{3,4}$/.test(extension)) {
      throw new Error("Extension must be 3-4 digits");
    }

    // Check if already taken
    const existing = await prisma.user.findUnique({
      where: { tenantId_extension: { tenantId, extension } },
    });

    if (existing && existing.id !== userId) {
      throw new Error(`Extension ${extension} is already assigned`);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { extension, extensionEnabled: true },
    });
  }

  /**
   * Remove extension from user
   */
  async removeExtension(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { extension: null, extensionEnabled: false },
    });
  }
}

export const extensionDirectory = new ExtensionDirectory();
```

#### 2. Extension Routing TwiML Builder

```typescript
// backend/src/routes/twilioWebhooks.ts (add new function)

/**
 * Build TwiML to dial an extension (VoIP-first with PSTN fallback)
 */
function buildExtensionDialTwiml(options: {
  tenantId: string;
  extension: string;
  callerId: string;
  fromExtension?: string;
  actionUrl: string;
}): string {
  const { tenantId, extension, callerId, fromExtension, actionUrl } = options;

  // Lookup extension
  const target = await extensionDirectory.findByExtension(tenantId, extension);

  if (!target) {
    return `
      <Response>
        <Say voice="alice">Extension ${extension
          .split("")
          .join(" ")} is not available.</Say>
        <Hangup/>
      </Response>
    `;
  }

  // Build client identity for VoIP call
  const clientIdentity = toTwilioClientIdentity({
    tenantId,
    userId: target.userId,
  });

  // If web phone is online, dial via VoIP (FREE)
  if (target.available) {
    console.log(
      `[Extension] Dialing ${extension} via VoIP (client: ${clientIdentity})`
    );

    return `
      <Response>
        <Dial 
          callerId="${callerId}" 
          timeout="20" 
          action="${actionUrl}" 
          answerOnBridge="true"
        >
          <Client>${clientIdentity}</Client>
        </Dial>
      </Response>
    `;
  }

  // Fallback to PSTN if web phone offline but user has forwarding number
  const user = await prisma.user.findUnique({
    where: { id: target.userId },
    select: { forwardingPhoneNumber: true, name: true },
  });

  if (user?.forwardingPhoneNumber) {
    console.log(
      `[Extension] ${extension} offline, fallback to PSTN: ${user.forwardingPhoneNumber}`
    );

    return `
      <Response>
        <Say voice="alice">Calling ${
          target.name || "extension " + extension
        }.</Say>
        <Dial 
          callerId="${callerId}" 
          timeout="30" 
          action="${actionUrl}"
          answerOnBridge="true"
        >
          <Number>${user.forwardingPhoneNumber}</Number>
        </Dial>
      </Response>
    `;
  }

  // No VoIP, no PSTN fallback
  return `
    <Response>
      <Say voice="alice">Extension ${extension
        .split("")
        .join(" ")} is unavailable.</Say>
      <Hangup/>
    </Response>
  `;
}
```

#### 3. Extension Dialing Endpoint

```typescript
// backend/src/routes/twilioWebhooks.ts (add new endpoint)

/**
 * Handle extension-to-extension calls from web phone
 * Called when agent's browser Device.connect({ extension: "102" })
 */
router.post("/dial-extension", async (req: Request, res: Response) => {
  try {
    const fromRaw = String(req.body?.From || "").trim();
    const identity = fromRaw.startsWith("client:")
      ? fromRaw.slice("client:".length)
      : fromRaw;

    const parsed = parseTwilioClientIdentity(identity);
    if (!parsed?.tenantId || !parsed?.userId) {
      return res.type("text/xml").send("<Response><Reject/></Response>");
    }

    const { tenantId, userId } = parsed;

    // Get extension to dial (from custom parameters)
    const toExtension = String(
      req.body?.extension || req.body?.to || ""
    ).trim();
    if (!/^\d{3,4}$/.test(toExtension)) {
      return res.type("text/xml").send(`
        <Response>
          <Say voice="alice">Invalid extension.</Say>
          <Hangup/>
        </Response>
      `);
    }

    // Get caller's extension
    const caller = await prisma.user.findUnique({
      where: { id: userId },
      select: { extension: true, name: true },
    });

    // Choose caller ID (tenant's main number or first Twilio number)
    let callerId = "";
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { tenantId, status: "active", provider: "TWILIO" },
      select: { number: true },
    });
    callerId = phoneNumber?.number || "";

    if (!callerId) {
      return res.type("text/xml").send("<Response><Reject/></Response>");
    }

    // Build action URL for status tracking
    const actionUrl = `${process.env.PUBLIC_URL}/webhooks/twilio/extension-dial-action`;

    // Build TwiML to dial extension
    const twiml = await buildExtensionDialTwiml({
      tenantId,
      extension: toExtension,
      callerId,
      fromExtension: caller?.extension || undefined,
      actionUrl,
    });

    // Log call attempt
    await prisma.callLog.create({
      data: {
        tenantId,
        fromExtension: caller?.extension,
        toExtension,
        direction: "outbound",
        callType: "INTERNAL_VOIP", // Assume VoIP, update in action callback
        status: "initiated",
        fromUserId: userId,
      },
    });

    res.type("text/xml").send(twiml);
  } catch (error) {
    console.error("[Extension] Dial error:", error);
    res.status(500).send("Internal error");
  }
});

/**
 * Handle extension dial action callback (track result and cost)
 */
router.post("/extension-dial-action", async (req: Request, res: Response) => {
  try {
    const { DialCallStatus, DialCallDuration, CallSid } = req.body;

    // Determine if PSTN was used (update cost)
    const callLog = await prisma.callLog.findFirst({
      where: { callSid: CallSid },
      orderBy: { createdAt: "desc" },
    });

    if (callLog) {
      const duration = parseInt(DialCallDuration || "0", 10);
      let cost = 0;
      let callType = "INTERNAL_VOIP";

      // If call completed, check if PSTN was involved
      if (DialCallStatus === "completed" && duration > 0) {
        // Check if <Client> answered or <Number> answered
        // Twilio doesn't directly tell us, but we can infer:
        // - If duration > 0 and web phone was offline → PSTN was used
        // - Otherwise → VoIP

        const target = await extensionDirectory.findByExtension(
          callLog.tenantId,
          callLog.toExtension!
        );

        if (!target?.available) {
          // PSTN fallback was used
          callType = "INTERNAL_PSTN";
          cost = duration * 0.013; // Twilio outbound rate
        }
      }

      await prisma.callLog.update({
        where: { id: callLog.id },
        data: {
          status: DialCallStatus,
          duration,
          cost,
          callType,
          endedAt: new Date(),
        },
      });

      // Track usage if PSTN was used
      if (cost > 0) {
        await usageService.trackVoiceCall({
          tenantId: callLog.tenantId,
          phoneNumberId: "", // Internal call, no specific phone number
          callSid: CallSid,
          durationSeconds: duration,
          direction: "internal",
        });
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("[Extension] Dial action error:", error);
    res.sendStatus(500);
  }
});
```

#### 4. Extension API Routes

```typescript
// backend/src/routes/extensions.ts

import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { extensionDirectory } from "../services/extensionDirectory";
import prisma from "../lib/prisma";

const router = Router();

/**
 * GET /api/extensions - List all extensions in tenant
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const extensions = await extensionDirectory.listExtensions(tenantId);
    res.json(extensions);
  } catch (error) {
    console.error("Extension list error:", error);
    res.status(500).json({ error: "Failed to list extensions" });
  }
});

/**
 * POST /api/extensions/assign - Assign extension to user
 */
router.post("/assign", authenticateToken, async (req, res) => {
  try {
    const { userId, extension } = req.body;
    const tenantId = req.user!.tenantId;

    // Check if user exists and belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await extensionDirectory.assignExtension(userId, tenantId, extension);
    res.json({ success: true, extension });
  } catch (error: any) {
    console.error("Extension assign error:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/extensions/:userId - Remove extension from user
 */
router.delete("/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify user belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await extensionDirectory.removeExtension(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Extension remove error:", error);
    res.status(500).json({ error: "Failed to remove extension" });
  }
});

/**
 * GET /api/extensions/lookup/:extension - Lookup extension
 */
router.get("/lookup/:extension", authenticateToken, async (req, res) => {
  try {
    const { extension } = req.params;
    const tenantId = req.user!.tenantId;

    const result = await extensionDirectory.findByExtension(
      tenantId,
      extension
    );

    if (!result) {
      return res.status(404).json({ error: "Extension not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Extension lookup error:", error);
    res.status(500).json({ error: "Failed to lookup extension" });
  }
});

export default router;
```

---

## Frontend Implementation

### 1. Extension Dialer Component

```typescript
// components/ExtensionDialer.tsx

import React, { useState, useEffect } from "react";
import { Phone, User, Hash } from "lucide-react";
import { api } from "../services/api";

interface Extension {
  extension: string;
  label: string;
  name: string;
  status: "ONLINE" | "BUSY" | "AWAY" | "OFFLINE";
  hasWebPhone: boolean;
}

export function ExtensionDialer() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [selectedExtension, setSelectedExtension] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadExtensions();
  }, []);

  const loadExtensions = async () => {
    try {
      const result = await api.get("/extensions");
      setExtensions(result.data);
    } catch (error) {
      console.error("Failed to load extensions:", error);
    }
  };

  const dialExtension = async (extension: string) => {
    try {
      // Use Twilio Device SDK to call extension
      const device = (window as any).twilioDevice;
      if (!device) {
        alert("Web phone not connected");
        return;
      }

      await device.connect({
        params: { extension },
      });
    } catch (error) {
      console.error("Failed to dial extension:", error);
      alert("Failed to place call");
    }
  };

  const filteredExtensions = extensions.filter(
    (ext) =>
      ext.extension.includes(searchQuery) ||
      ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="extension-dialer">
      <div className="search-bar">
        <Hash size={16} />
        <input
          type="text"
          placeholder="Search extensions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="extension-list">
        {filteredExtensions.map((ext) => (
          <div key={ext.extension} className="extension-item">
            <div className="extension-info">
              <User size={16} />
              <div>
                <div className="extension-number">Ext {ext.extension}</div>
                <div className="extension-name">{ext.label || ext.name}</div>
              </div>
              <div
                className={`status-indicator status-${ext.status.toLowerCase()}`}
              >
                {ext.hasWebPhone ? "🟢" : "⚪"}
              </div>
            </div>
            <button
              onClick={() => dialExtension(ext.extension)}
              disabled={ext.status === "OFFLINE" && !ext.hasWebPhone}
              className="dial-button"
            >
              <Phone size={16} />
              Call
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2. Extension Settings UI

```typescript
// pages/Settings.tsx (add extension section)

<section className="extension-settings">
  <h3>Your Extension</h3>
  <p>Assign yourself a 3-4 digit extension number that colleagues can dial</p>

  <div className="extension-input">
    <input
      type="text"
      pattern="[0-9]{3,4}"
      maxLength={4}
      placeholder="e.g., 101"
      value={extension}
      onChange={(e) => setExtension(e.target.value.replace(/\D/g, ""))}
    />
    <button onClick={saveExtension}>Save Extension</button>
  </div>

  {currentExtension && (
    <div className="current-extension">
      ✓ Your extension: <strong>#{currentExtension}</strong>
      <button onClick={removeExtension}>Remove</button>
    </div>
  )}

  <div className="extension-directory-link">
    <a href="/extensions">View Extension Directory →</a>
  </div>
</section>
```

---

## Call Flow Diagrams

### 1. Extension-to-Extension Call (VoIP - FREE)

```
┌─────────────┐                                           ┌─────────────┐
│ Extension   │                                           │ Extension   │
│ 101         │                                           │ 102         │
│ (Browser)   │                                           │ (Browser)   │
└──────┬──────┘                                           └──────▲──────┘
       │                                                          │
       │ 1. device.connect({ extension: "102" })                 │
       │                                                          │
       ▼                                                          │
┌────────────────────────────────────────────────────────────────┴──────┐
│                        Twilio Cloud Platform                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  POST /webhooks/twilio/dial-extension                          │  │
│  │  1. Parse caller identity: tenant_X_user_Y                     │  │
│  │  2. Lookup extension "102" in tenant                           │  │
│  │  3. Check if Extension 102 web phone is ONLINE ✓              │  │
│  │  4. Build client identity: tenant_X_user_Z                     │  │
│  │  5. Return TwiML: <Dial><Client>tenant_X_user_Z</Client></Dial>│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  WebRTC Media Path (No PSTN):                                        │
│  Extension 101 ←────────[RTP Audio Packets]────────→ Extension 102  │
│                                                                       │
│  Cost: $0.00/min ✅                                                  │
└───────────────────────────────────────────────────────────────────────┘
```

### 2. Extension-to-Extension Call (PSTN Fallback)

```
┌─────────────┐                                           ┌─────────────┐
│ Extension   │                                           │ Extension   │
│ 101         │                                           │ 102         │
│ (Browser)   │                                           │ (Offline)   │
└──────┬──────┘                                           └─────────────┘
       │                                                          ▲
       │ 1. device.connect({ extension: "102" })                 │
       │                                                          │
       ▼                                                          │
┌────────────────────────────────────────────────────────────────┴──────┐
│                        Twilio Cloud Platform                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  POST /webhooks/twilio/dial-extension                          │  │
│  │  1. Parse caller identity: tenant_X_user_Y                     │  │
│  │  2. Lookup extension "102" in tenant                           │  │
│  │  3. Check if Extension 102 web phone is ONLINE ✗              │  │
│  │  4. Fallback: Get user's forwardingPhoneNumber: +1234567890   │  │
│  │  5. Return TwiML: <Dial><Number>+1234567890</Number></Dial>   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Hybrid Path (VoIP → PSTN):                                          │
│  Extension 101 (WebRTC) → Twilio → PSTN ($0.013/min) → +1234567890  │
│                                                                       │
│  Cost: $0.013/min (50% savings vs full PSTN) ⚡                      │
└───────────────────────────────────────────────────────────────────────┘
```

### 3. External Call to Extension (PSTN → VoIP)

```
┌─────────────┐                                           ┌─────────────┐
│ Customer    │                                           │ Extension   │
│ Phone       │                                           │ 101         │
│ (PSTN)      │                                           │ (Browser)   │
└──────┬──────┘                                           └──────▲──────┘
       │                                                          │
       │ 1. Dial +1-800-COMPANY                                  │
       │                                                          │
       ▼                                                          │
┌────────────────────────────────────────────────────────────────┴──────┐
│                        Twilio Cloud Platform                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  POST /webhooks/twilio/voice                                   │  │
│  │  1. Incoming call from customer                                │  │
│  │  2. Customer presses extension "101" (DTMF)                    │  │
│  │  3. Lookup extension "101" → userId: clx123...                 │  │
│  │  4. Check web phone online ✓                                  │  │
│  │  5. Return TwiML: <Dial><Client>tenant_X_user_Y</Client></Dial>│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Hybrid Path (PSTN → VoIP):                                          │
│  Customer (PSTN $0.0085/min) → Twilio → WebRTC (FREE) → Extension   │
│                                                                       │
│  Cost: $0.0085/min (inbound PSTN only, browser leg is free) ✅      │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Cost Savings Projection

### Small Team (10 Agents)

| Metric                 | Current (PSTN Only) | With Extensions (70% VoIP) | Savings    |
| ---------------------- | ------------------- | -------------------------- | ---------- |
| Internal Calls/Day     | 50                  | 50                         | -          |
| Avg Call Duration      | 5 min               | 5 min                      | -          |
| Working Days/Year      | 250                 | 250                        | -          |
| **Total Minutes/Year** | **62,500 min**      | **62,500 min**             | -          |
| VoIP Minutes (70%)     | 0                   | 43,750 min                 | -          |
| PSTN Minutes (30%)     | 62,500              | 18,750                     | -70%       |
| Cost per PSTN Minute   | $0.0215             | $0.013                     | -          |
| **Annual Cost**        | **$1,343.75**       | **$243.75**                | **$1,100** |
| **Savings %**          | -                   | -                          | **82%**    |

### Medium Team (50 Agents)

| Metric             | Current    | With Extensions | Savings    |
| ------------------ | ---------- | --------------- | ---------- |
| Internal Calls/Day | 200        | 200             | -          |
| **Annual Cost**    | **$5,375** | **$975**        | **$4,400** |
| **Savings %**      | -          | -               | **82%**    |

### Large Call Center (200 Agents)

| Metric             | Current     | With Extensions | Savings     |
| ------------------ | ----------- | --------------- | ----------- |
| Internal Calls/Day | 1,000       | 1,000           | -           |
| **Annual Cost**    | **$26,875** | **$4,875**      | **$22,000** |
| **Savings %**      | -           | -               | **82%**     |

---

## Migration Path

### Phase 1: Foundation (Week 1-2) - **3-5 days**

**Deliverables:**

- ✅ Database migration: Add `extension`, `extensionEnabled`, `extensionLabel`, `webPhoneStatus` to User model
- ✅ Extension directory service (lookup, assign, remove)
- ✅ Extension API routes (`GET /api/extensions`, `POST /api/extensions/assign`)
- ✅ Update web phone presence tracking to set `webPhoneStatus`

**Testing:**

- Assign extensions to users
- Verify uniqueness within tenant
- List extensions via API

**Estimate:** 12-16 hours

---

### Phase 2: Call Routing (Week 2-3) - **3-5 days**

**Deliverables:**

- ✅ `buildExtensionDialTwiml()` function (VoIP-first with PSTN fallback)
- ✅ `POST /webhooks/twilio/dial-extension` endpoint
- ✅ `POST /webhooks/twilio/extension-dial-action` callback (track cost)
- ✅ Update `CallLog` model with `fromExtension`, `toExtension`, `callType`, `cost`
- ✅ Update Twilio Device SDK connection in [WebPhoneDialer.tsx](components/WebPhoneDialer.tsx) to support extension parameter

**Testing:**

- Extension 101 calls Extension 102 (both online) → VoIP call, $0 cost
- Extension 101 calls Extension 102 (102 offline) → PSTN fallback to `forwardingPhoneNumber`
- Extension 101 calls Extension 999 (doesn't exist) → "Extension not available" message
- Verify `CallLog` records show correct `callType` and `cost`

**Estimate:** 16-20 hours

---

### Phase 3: UI/UX (Week 3-4) - **5-7 days**

**Deliverables:**

- ✅ Extension settings section in [Settings.tsx](pages/Settings.tsx) (assign/remove extension)
- ✅ Extension directory page (`/extensions`) with search and presence indicators
- ✅ Extension dialer component (quick dial from directory)
- ✅ Dialpad extension mode (dial extension instead of phone number)
- ✅ Update [WebPhoneDialer.tsx](components/WebPhoneDialer.tsx) to show extension in call UI
- ✅ **Transfer controls:** Warm transfer, blind transfer, conference buttons
- ✅ **Hold/Resume button** in active call UI
- ✅ **Conference participant list** with kick/mute controls

**Testing:**

- User assigns extension "101" → Saved successfully, visible in directory
- Colleague sees Extension 101 in directory with online status
- Click "Call" → Dials via VoIP, call connects
- Search directory by extension or name
- **Warm transfer:** Agent 101 calls Extension 102, talks privately, merges customer
- **Blind transfer:** Agent 101 transfers customer to Extension 102, disconnects
- **3-way conference:** Add Extension 103 to active call with customer
- **Hold:** Put customer on hold, resume successfully

**Estimate:** 32-40 hours (updated for transfer/conference features)

---

### Phase 4: Analytics & Optimization (Week 4-5) - **3-5 days**

**Deliverables:**

- ✅ Extension usage analytics dashboard (# of internal calls, VoIP vs PSTN ratio, cost savings)
- ✅ Presence optimization (auto-set AWAY after idle, auto-set BUSY on call)
- ✅ Extension directory export (CSV)
- ✅ Admin controls (require extensions for team, auto-assign next available)

**Testing:**

- Dashboard shows accurate internal call metrics
- Presence auto-updates correctly
- Admin can enforce extension assignment policy

**Estimate:** 16-24 hours

---

### Total Implementation Timeline

**Estimated76-108 hours = **2-3 weeks** (full-time) or **5-7 weeks\*\* (part-time)

**Note:** Conference and transfer features add ~8-16 hours to Phase 3 (UI controls + TwiML endpoints).

- **Phase 1 (Foundation):** 12-16 hours
- **Phase 2 (Routing):** 16-20 hours
- **Phase 3 (UI/UX):** 24-32 hours
- **Phase 4 (Analytics):** 16-24 hours

**Total:** 68-92 hours = **2-3 weeks** (full-time) or **4-6 weeks** (part-time)

---

## Requirements Summary

### ✅ **Is Internal Calling Without PSTN Possible?**

**YES - Using Twilio Client SDK (Already Implemented)**

### 💰 **Cost Savings**

- **Internal VoIP calls: FREE** ($0.00/min)
- **PSTN fallback: $0.013/min** (50% cheaper than current)
- **Projected annual savings: 80-90%** for internal calls

### 🏗️ **Technical Feasibility**

- **Infrastructure:** ✅ Already built (60% complete)
- **Complexity:** ⭐⭐⭐ Moderate (2-3 weeks implementation)
- **Risk:** Low (leverages proven Twilio Client SDK)

### 🎯 **Recommended Approach**

1. **Use Twilio Client SDK** (current implementation)
2. **Extension = User.extension field** (simple 1:1 mapping)
3. **VoIP-first routing** with PSTN fallback
4. **Track cost accurately** (VoIP = $0, PSTN = actual cost)

---

## Next Steps

### Immediate Actions

1. **Review & Approve** this document
2. **Create database migration** for extension fields
3. **Implement Phase 1** (foundation) - 3-5 days
4. **Test with 2-3 pilot users** before full rollout

### Decision Points

- [ ] Approve extension numbering scheme (100-999? 1000-9999?)
- [ ] Approve VoIP-first with PSTN fallback approach
- [ ] Approve timeline (2-3 weeks full-time implementation)
- [ ] Assign developer resources

---

**Document End**
