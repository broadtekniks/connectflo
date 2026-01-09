# Agent Transfer Availability Analysis Report

## Current Behavior When Transferring to Unavailable Agent

### Scenario: Transfer Call to Agent (via Workflow) - Agent Not Checked In / Extension Not Active

---

## 📋 Analysis Summary

When a call is transferred to an agent through a workflow's "Call Forwarding" or "Call Group" node and the agent is **not checked in** or their **extension is not active**, the system has **built-in fallback logic** but with **potential gaps**.

---

## 🔍 Detailed Code Flow

### 1. Agent Availability Check (`userIsAvailable` function)

**Location**: `backend/src/services/twilioRealtimeVoice.ts` (lines 1627-1634)

```typescript
const userIsAvailable = (user: any): boolean => {
  const ready =
    tenantId && user?.id
      ? isWebPhoneReady({ tenantId, userId: String(user.id) })
      : false;
  if (onlyCheckedIn && !user?.isCheckedIn && !ready) return false;
  if (!agentIsOpenNow(user)) return false;
  const targets = userTargets(user);
  return targets.numbers.length > 0 || targets.clients.length > 0;
};
```

**Logic**:

- Checks if web phone is ready (extension active/online)
- **IF `onlyCheckedIn` is TRUE** (workflow setting "Only ring checked-in agents"):
  - Agent must be checked in OR have active web phone
  - If neither, returns `false` (agent unavailable)
- Checks working hours (if enabled)
- Checks if agent has any dial targets (numbers or client identities)

---

### 2. Target Resolution (`userTargets` function)

**Location**: `backend/src/services/twilioRealtimeVoice.ts` (lines 1605-1624)

```typescript
const userTargets = (user: any): ResolvedTargets => {
  const numbers: string[] = [];
  const clients: string[] = [];

  const ready =
    tenantId && user?.id
      ? isWebPhoneReady({ tenantId, userId: String(user.id) })
      : false;
  if (ready) {
    clients.push(toTwilioClientIdentity({ tenantId, userId: String(user.id) }));
  }

  const number = normalizeE164Like(
    user?.forwardingPhoneNumber || user?.phoneNumber || ""
  );
  if (number) numbers.push(number);

  return { numbers, clients };
};
```

**Fallback Priority**:

1. **VoIP (Client)**: If web phone is ready/online → Add to `clients` array
2. **PSTN Numbers**:
   - First tries `user.forwardingPhoneNumber` (personal forwarding number)
   - Falls back to `user.phoneNumber` (user's registered phone)
3. **Extension Forwarding**: ❌ **NOT CHECKED** - missing integration with new `extensionForwardingNumber` field

---

### 3. What Happens in Each Case

#### Case A: Agent Checked In + Web Phone Connected

✅ **Result**: Call routes to web phone via VoIP (FREE)

- `isWebPhoneReady()` returns `true`
- Client identity added to dial targets
- TwiML uses `<Client>tenant_xxx_user_yyy</Client>`

#### Case B: Agent NOT Checked In + Web Phone NOT Connected + Has Personal Forwarding Number

⚠️ **Result**: Depends on workflow settings

- **IF workflow has "Only ring checked-in agents" enabled**:
  - `onlyCheckedIn && !user?.isCheckedIn && !ready` → returns `false`
  - Agent skipped, **no dial attempt made**
- **IF workflow does NOT enforce check-in**:
  - Falls back to `forwardingPhoneNumber` or `phoneNumber`
  - Call routes to PSTN number (costs apply)

#### Case C: Agent NOT Checked In + Web Phone NOT Connected + NO Phone Numbers

❌ **Result**: Agent marked as unavailable

- `userTargets()` returns empty arrays
- `userIsAvailable()` returns `false`
- Agent is **skipped entirely**

#### Case D: Agent Has `extensionForwardingNumber` But NOT Checked In

⚠️ **POTENTIAL ISSUE**: Extension forwarding number is **NOT USED**

- Current code checks `forwardingPhoneNumber` and `phoneNumber`
- **Does NOT check `extensionForwardingNumber`** from the new extension system
- Call may fail even though external forwarding number was configured by admin

---

## 🔴 Current Issues Identified

### Issue 1: Extension Forwarding Number Not Used in Transfers

**Location**: `twilioRealtimeVoice.ts` - `userTargets()` function

**Problem**:

- Admin can set `extensionForwardingNumber` via Settings → Extensions
- This field is used for direct extension dialing but **NOT** for workflow transfers
- Agent could be unavailable even though they have a fallback number configured

**Impact**:

- Calls fail to reach agents who have extension forwarding numbers set
- Inconsistent behavior between extension dialing and workflow transfers

**Current Code**:

```typescript
const number = normalizeE164Like(
  user?.forwardingPhoneNumber || user?.phoneNumber || ""
);
```

**Should Be**:

```typescript
const number = normalizeE164Like(
  user?.extensionForwardingNumber ||
    user?.forwardingPhoneNumber ||
    user?.phoneNumber ||
    ""
);
```

---

### Issue 2: No Clear Feedback When All Agents Unavailable

**Location**: `twilioRealtimeVoice.ts` (lines 1850-1870)

**Current Behavior**:

```typescript
if (!resolved || (!resolved.numbers.length && !resolved.clients.length)) {
  if (fallbackToVoicemail && phoneNumberId) {
    // Routes to voicemail
  }

  console.warn(
    `[TwilioRealtime] Human transfer requested but no available target (reason=${reason}).`
  );
  // Keep the realtime session alive if we didn't actually transfer.
  session.transferInProgress = false;
  return;
}
```

**What Happens**:

- If no agents available and voicemail disabled → **call stays with AI**
- No explicit message to caller that agents are unavailable
- Transfer silently fails, AI continues conversation

**Expected Behavior**:

- AI should notify caller: "I'm sorry, no agents are available right now..."
- Offer alternatives: voicemail, callback, or return to AI

---

### Issue 3: "Only Checked-In Agents" Setting May Be Too Restrictive

**Location**: Workflow configuration + `userIsAvailable()` check

**Problem**:

```typescript
if (onlyCheckedIn && !user?.isCheckedIn && !ready) return false;
```

**Scenario**:

- Agent forgot to check in but has web phone connected OR has valid forwarding number
- Setting enforces check-in requirement, agent is skipped
- Call doesn't route even though agent is reachable

**Recommendation**:

- Current behavior may be intentional for strict availability control
- Consider adding workflow option: "Allow fallback to phone numbers even if not checked in"

---

## 📊 Transfer Outcome Matrix

| Agent State | Web Phone | Checked In | Has Forwarding # | "Only Checked-In" ON | "Only Checked-In" OFF | Extension Fwd # Set |
| ----------- | --------- | ---------- | ---------------- | -------------------- | --------------------- | ------------------- |
| Ready       | Online    | Yes        | -                | ✅ VoIP              | ✅ VoIP               | N/A                 |
| Ready       | Online    | No         | -                | ✅ VoIP              | ✅ VoIP               | N/A                 |
| Offline     | Offline   | Yes        | Yes              | ✅ PSTN (Personal)   | ✅ PSTN (Personal)    | ❌ Not Used         |
| Offline     | Offline   | Yes        | No               | ❌ Skipped           | ❌ Skipped            | ❌ Not Used         |
| Offline     | Offline   | No         | Yes              | ❌ Skipped           | ✅ PSTN (Personal)    | ❌ Not Used         |
| Offline     | Offline   | No         | No               | ❌ Skipped           | ❌ Skipped            | ❌ Should Use       |

---

## 🎯 Recommendations

### Priority 1: Add Extension Forwarding Number Support

**File**: `backend/src/services/twilioRealtimeVoice.ts`

Update `userTargets()` to include `extensionForwardingNumber`:

```typescript
const number = normalizeE164Like(
  user?.extensionForwardingNumber ||
    user?.forwardingPhoneNumber ||
    user?.phoneNumber ||
    ""
);
```

Also need to update the user query to include this field:

```typescript
select: {
  id: true,
  isCheckedIn: true,
  agentTimeZone: true,
  workingHours: true,
  extensionForwardingNumber: true,  // ADD THIS
  forwardingPhoneNumber: true,
  phoneNumber: true,
}
```

### Priority 2: Improve Caller Notification

When no agents available and transfer fails:

- AI should verbally inform the caller
- Offer explicit alternatives
- Log the failure for monitoring

### Priority 3: Add Monitoring/Alerts

- Track transfer failures due to unavailable agents
- Alert admins when transfers consistently fail
- Dashboard metric: "Failed transfers / Total transfer attempts"

---

## 🧪 Test Cases to Verify

1. **Test with agent checked out, extension forwarding number set**

   - Expected: Should route to extension forwarding number
   - Current: ❌ Likely fails

2. **Test with "Only checked-in agents" enabled, agent offline with forwarding number**

   - Expected: Agent skipped per workflow settings
   - Current: ✅ Working as designed

3. **Test with all agents unavailable, no voicemail**
   - Expected: AI notifies caller
   - Current: ⚠️ Transfer silently fails, AI continues

---

## 📝 Summary

**Current System**:

- ✅ Properly checks agent availability (check-in status, web phone status, working hours)
- ✅ Has fallback to PSTN numbers when web phone offline
- ⚠️ Respects workflow "Only ring checked-in agents" setting
- ❌ **Missing**: Extension forwarding number integration in transfers
- ❌ **Missing**: Clear caller notification when all agents unavailable

**Critical Gap**:
The new `extensionForwardingNumber` field (added for extension fallback routing) is **not being used** in workflow transfer logic. This creates inconsistent behavior where:

- Direct extension dialing uses the forwarding number
- Workflow transfers ignore it

**Immediate Action Needed**:
Update `userTargets()` function in `twilioRealtimeVoice.ts` to check `extensionForwardingNumber` as the highest priority fallback number.
