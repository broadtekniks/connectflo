# Agent Web Phone (Optional) — Implementation Guide (Twilio Voice WebRTC)

This guide describes how to add an **embedded web phone** for agents so they can **receive and make calls from the app** when desired, while keeping your existing PSTN routing as the primary/fallback path.

The design assumes the current ConnectFlo architecture:

- Twilio inbound calls hit `POST /webhooks/twilio/voice`.
- Call routing nodes (Call Group / Call Forwarding) run **before** AI Media Streams.
- Agents already have a per-user PSTN forwarding number (`User.forwardingPhoneNumber`) and tenant allowlist restrictions.

---

## Goals

- **Not a replacement** for PSTN: web phone is optional per agent/session.
- **Browser-first when available**, but fast fallback to PSTN forwarding.
- Minimal initial call controls: **answer, hangup, mute**.
- Reuse existing billing primitives: track inbound call minutes; track dialed leg minutes.

---

## How agents use the phone app (day-to-day)

This is the expected agent workflow once the web phone feature is enabled.

### 1) Turn on the Web Phone

- Open the app and go to the area where the **Web Phone** panel lives (commonly Inbox/Calls).
- Toggle **Web Phone: On**.
- The browser will ask for microphone permission; click **Allow**.

You should see a status like:

- **Ready** (good)
- **Mic blocked** (click the browser lock icon → allow microphone)
- **No audio device** (plug in a headset / select a mic)

### 2) Receive calls in the browser

- When an inbound call is routed to you (direct forwarding or via Call Group), you’ll get an **incoming call** UI.
- Click **Answer** to take it in the browser.
- Use **Mute** and **Hang up** as needed.

If you don’t answer (or you’re not “Ready”), the system should **fall back to PSTN** and ring your forwarding number (if configured).

### 3) Make outbound calls from the app

- From a customer/conversation, click **Call** (or “Call customer”).
- If Web Phone is **Ready**, the call uses the browser.
- If Web Phone is **Off / not ready**, the app should fall back to placing the call via your configured PSTN method (implementation-dependent).

### 4) Configure your fallback phone number

Even with a web phone, you typically want a fallback number.

- Go to the Team Members page and set your **Forwarding number**.
- This is the number used when:
  - you are dialed via PSTN fallback, or
  - workflows route to a user/call group that uses member forwarding numbers.

### 5) Troubleshooting quick checks

- If you can’t be rung in-browser: confirm **Web Phone = On** and status **Ready**.
- If calls ring but you can’t hear: check speaker output device selection.
- If callers can’t hear you: check mic selection + browser permissions.
- If everything fails: confirm your PSTN forwarding number is set so fallback works.

---

## Twilio building blocks

### 1) Twilio Voice JavaScript SDK (WebRTC)

Agents run a Twilio Voice SDK `Device` in the browser.

- The SDK connects using a short-lived **Access Token (JWT)**.
- Twilio delivers inbound call invites to the device.

### 2) TwiML `<Dial>` with `<Client>`

To ring a browser device, return TwiML like:

```xml
<Response>
  <Dial callerId="+1..." timeout="20" action="https://.../dial-action" method="POST" answerOnBridge="true">
    <Client>agent_123</Client>
  </Dial>
</Response>
```

Twilio supports **simultaneous dialing** of up to 10 `<Client>`/`<Number>` nouns in one `<Dial>`; the first to answer wins.

### 3) Optional: sequential fallback using your existing `/dial-action`

For cleaner UX (avoid ringing a phone when the browser answers), prefer a 2-step dial:

1. First `<Dial>` only `<Client>` identities (short timeout like 8–12s)
2. If `DialCallStatus` is not `completed`, your existing `/dial-action` dials PSTN numbers next

---

## Identity scheme (important)

Twilio `<Client>` identities have constraints (no spaces/unwise characters; mobile SDKs require alphanumeric/underscore only).

Recommended identity format:

- `tenant_${tenantId}_user_${userId}`

Keep it deterministic and reversible.

---

## Backend: Access Token endpoint

Add an authenticated API endpoint (example):

- `POST /api/twilio/access-token`

Behavior:

- Reads logged-in user (tenantId/userId/role)
- Mints a short-lived JWT (e.g. 1 hour)
- Includes a **Voice Grant** for outgoing + incoming
- Returns `{ token, identity }`

Environment variables typically needed:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- Optionally `TWILIO_TWIML_APP_SID` (for outgoing from the SDK)

Notes:

- Prefer **API Key** for JWT generation (don’t generate JWTs with the Auth Token).
- Scope tokens to the current tenant/user.

---

## Frontend: Device lifecycle

In the app (agent UI):

1. Create a “Web Phone” panel with states:

   - `Off` (not registered)
   - `Ready` (registered, mic granted)
   - `Mic blocked` / `No device` / `Network issue`

2. On enable:

   - Call `POST /api/twilio/access-token`
   - Initialize `Device(token)`
   - Request mic permission (or rely on SDK’s prompt)
   - Register device

3. Inbound call:

   - Show a small incoming call UI (Answer/Decline)

4. Outbound call:
   - Click-to-call uses the device; if not ready, fall back to PSTN flow.

---

## Inbound routing changes (how it plugs into current Call Group / Forwarding)

Today your routing nodes ultimately produce PSTN numbers to dial.

### A) Add “web phone eligible” targets

Extend your dial-target resolution to also return a set of `<Client>` identities to ring, based on:

- Agent is checked in (your existing `onlyCheckedIn` gating)
- Agent is within working hours (your existing `respectWorkingHours` gating)
- Agent is online + web-phone ready (new signal)

**New signal:** Track browser readiness via Socket.IO.

Suggested Socket.IO events:

- client emits `webphone:ready` / `webphone:not-ready`
- server maintains an in-memory map: `userId -> { ready: boolean, lastSeenAt }`

### B) Prefer browser-first, then PSTN

For Call Forwarding (target user) or Call Group:

- Step 1: If there are ready `<Client>` identities, return TwiML `<Dial>` with `<Client>` and a short timeout
- Step 2 (dial-action fallback): If unanswered, dial the user/group PSTN numbers as you already do

### C) External number forwarding

If a workflow explicitly forwards to an external number (or uses the workflow override), don’t involve the web phone unless you explicitly want to “consult” the agent.

---

## Outbound calling patterns

You have two common options.

### Option 1 (simple): SDK places call to PSTN

- Agent clicks “Call customer”
- Browser device connects, and your app bridges to PSTN using TwiML

You’ll need an endpoint that returns TwiML for the SDK outbound connection (often via a TwiML App Voice URL).

### Option 2 (fallback-friendly): server places outbound call

- If browser is ready, you can still use SDK.
- If not, server uses Twilio REST API to place a call:
  - call agent PSTN first, then connect to customer (or conference)

If you care about consistent call recording / transfer later, consider using a Conference-based approach.

---

## Billing & metrics (how it affects COSTS)

When using the web phone, you may incur:

- normal PSTN inbound minutes (caller -> your Twilio number)
- **Application Connect minutes** for the browser leg (Twilio Voice SDK)
- if you fall back to PSTN forwarding, outbound PSTN minutes for the forwarded leg

You already track inbound duration and dialed-leg duration; add an extra dimension for "dialed leg type":

- `client` vs `pstn`

---

## Operational safeguards

- Require HTTPS in production (WebRTC).
- Add a “Test web phone” action (plays a loopback or dials a test number).
- Auto-disable web phone if mic permissions fail repeatedly.
- Log call setup failures (token expired, registration failure, device not found).

---

## Recommended MVP checklist

- Backend: `POST /api/twilio/access-token`
- Frontend: web phone toggle + incoming call UI + basic outbound
- Routing: browser-first on Call Group / user-forwarding, PSTN fallback via `/dial-action`
- Usage: track client-leg minutes separately from PSTN forwarded leg

---

## Next step (if you want me to implement)

I can implement this in small, safe slices:

1. Token endpoint + minimal web phone panel (no routing changes yet)
2. Add inbound `<Client>` dialing for a single user-forwarding case
3. Expand to call groups + presence + usage metrics
