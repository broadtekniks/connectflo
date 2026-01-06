# SMS Setup Guide

This guide explains how to configure transactional SMS for ConnectFlo.

## Overview

ConnectFlo supports transactional SMS (support conversations, appointment confirmations, order updates) through:
- **Twilio**: A2P 10DLC registration required
- **Telnyx**: Messaging profiles

## Features

✅ **Transactional SMS Only** (No marketing campaigns)
- Support conversations via SMS
- Appointment confirmations
- Order updates
- Automatic STOP/START opt-out management (TCPA/CAN-SPAM compliant)
- Conversation threading in Inbox

## Configuration

### 1. Environment Variables

Add to your `.env` file:

```env
# Twilio SMS
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WEBHOOK_URL=https://your-domain.com/webhooks/twilio/voice
SMS_WEBHOOK_URL=https://your-domain.com/webhooks/twilio/sms
TWILIO_MESSAGING_SERVICE_SID=your-messaging-service-sid

# Telnyx SMS
TELNYX_API_KEY=your-telnyx-api-key
TELNYX_SMS_WEBHOOK_URL=https://your-domain.com/webhooks/telnyx/sms
TELNYX_MESSAGING_PROFILE_ID=your-messaging-profile-id
```

### 2. Twilio A2P 10DLC Setup

**Required for US SMS compliance:**

1. **Register Your Brand** (Platform-level, once)
   - Go to Twilio Console → Messaging → Regulatory Compliance
   - Create a Brand (ConnectFlo)
   - Provide: Business name, EIN, address, website
   - Status: Review takes 1-2 business days

2. **Create Messaging Service**
   - Go to Messaging → Services → Create Messaging Service
   - Name: "ConnectFlo SMS"
   - Use case: "Two-Way Conversations"
   - Copy the Messaging Service SID to `.env`

3. **Create Campaign**
   - Go to your Messaging Service → Compliance
   - Create Campaign
   - Type: "Customer Care"
   - Description: "Transactional support messages, appointment confirmations, and order updates"
   - Sample messages:
     - "Your appointment is confirmed! Service: Consultation, Date: 1/15/2025, Time: 2:00 PM"
     - "Order Update - #12345: Your order has shipped"
   - Opt-out keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT
   - Opt-in keywords: START, YES, UNSTOP

4. **Configure Webhooks**
   - Go to Messaging Service → Integration
   - Inbound Settings:
     - Process Inbound Messages: `SEND_A_WEBHOOK`
     - Request URL: `https://your-domain.com/webhooks/twilio/sms`
   - Save

### 3. Telnyx Messaging Profile Setup

1. **Create Messaging Profile**
   - Go to Telnyx Mission Control → Messaging
   - Create Messaging Profile
   - Name: "ConnectFlo SMS"
   - Webhook URL: `https://your-domain.com/webhooks/telnyx/sms`

2. **Copy Profile ID**
   - Copy the Messaging Profile ID to `.env` as `TELNYX_MESSAGING_PROFILE_ID`

### 4. Purchase Phone Numbers

When you purchase a phone number through ConnectFlo:

- **Twilio**: Number is automatically added to Messaging Service
- **Telnyx**: Number is automatically added to Messaging Profile
- SMS webhooks are auto-configured

## Usage

### Sending SMS from Inbox

1. Customer sends SMS to your phone number
2. SMS appears in Inbox as new conversation
3. Agent replies in Inbox
4. Reply is automatically sent as SMS

### Programmatic SMS

```typescript
import { sendSms } from "./services/sms";

// Send appointment confirmation
await sendSms({
  tenantId: "tenant-uuid",
  to: "+15551234567",
  body: "Your appointment is confirmed! Date: 1/15/2025 at 2:00 PM. Reply STOP to unsubscribe."
});
```

### Helper Functions

```typescript
import { 
  sendAppointmentConfirmation, 
  sendOrderUpdate, 
  checkOptOut 
} from "./services/sms";

// Check if customer has opted out
const hasOptedOut = await checkOptOut("tenant-id", "+15551234567");

// Send appointment confirmation
await sendAppointmentConfirmation("tenant-id", "+15551234567", {
  date: "January 15, 2025",
  time: "2:00 PM",
  service: "Consultation",
  location: "123 Main St"
});

// Send order update
await sendOrderUpdate("tenant-id", "+15551234567", {
  orderNumber: "12345",
  status: "Shipped",
  trackingUrl: "https://tracking.example.com/12345"
});
```

## Opt-Out Management

ConnectFlo automatically handles SMS opt-outs (required for TCPA/CAN-SPAM compliance):

### Opt-Out Keywords (case-insensitive)
- STOP
- STOPALL
- UNSUBSCRIBE
- CANCEL
- END
- QUIT

**Response:** "You have been unsubscribed. Reply START to resubscribe."

### Opt-In Keywords (case-insensitive)
- START
- YES
- UNSTOP

**Response:** "You have been resubscribed to messages from this number."

### Database Tracking

Opt-outs are stored in the `SmsOptOut` table:

```typescript
{
  tenantId: string;
  phoneNumber: string;
  reason: string; // The keyword used (STOP, START, etc.)
  optedOutAt: Date;
}
```

When sending SMS, the system automatically checks opt-out status and throws an error if the number has opted out.

## Webhooks

### Twilio SMS Webhook: `/webhooks/twilio/sms`

Handles:
- Inbound SMS messages
- STOP/START keywords
- Conversation threading
- Customer auto-creation

### Telnyx SMS Webhook: `/webhooks/telnyx/sms`

Handles:
- `message.received` events
- STOP/START keywords
- Conversation threading
- Customer auto-creation

## Testing

1. **Send test SMS to your number**
   ```
   Text: "Hello, I need help"
   From: Your mobile phone
   To: Your ConnectFlo number
   ```

2. **Check Inbox**
   - New conversation should appear
   - Sender: Your phone number
   - Channel: SMS

3. **Reply from Inbox**
   - Type reply in chat area
   - Send
   - Should receive SMS on your phone

4. **Test opt-out**
   ```
   Text: "STOP"
   ```
   - Should receive unsubscribe confirmation
   - Future messages will be blocked

5. **Test opt-in**
   ```
   Text: "START"
   ```
   - Should receive resubscribe confirmation
   - Messages allowed again

## Pricing

### Twilio (US)
- Local number: ~$1.15/month
- Inbound SMS: $0.0075/message
- Outbound SMS: $0.0079/message

### Telnyx (US)
- Local number: ~$1.00/month
- Inbound SMS: $0.004/message
- Outbound SMS: $0.006/message

## Compliance

✅ **TCPA Compliance**
- Automatic opt-out management (STOP keywords)
- Automatic opt-in management (START keywords)
- Transactional message exemptions apply

✅ **CAN-SPAM Compliance**
- Opt-out mechanism required
- 10-day opt-out processing (instant in our system)

✅ **A2P 10DLC Registration**
- Platform-level brand registration
- Shared campaigns for all customers
- No per-customer registration needed

## Troubleshooting

### SMS not receiving in Inbox

1. Check webhook configuration in Twilio/Telnyx console
2. Verify phone number is in database (`PhoneNumber` table)
3. Check backend logs for webhook errors
4. Verify ngrok/domain is publicly accessible

### SMS not sending from Inbox

1. Check customer has `phoneNumber` field set
2. Verify phone number has SMS capability
3. Check for opt-out status
4. Review backend logs for errors

### Customer created with wrong phone number

1. SMS webhook auto-creates customers with format: `sms_{phoneDigits}@temp.connectflo.com`
2. Phone number stored in `User.phoneNumber`
3. Admin can update email later

### A2P 10DLC registration rejected

1. Ensure business information is accurate
2. Provide valid EIN/tax ID
3. Use business email (not personal)
4. Website must be live and match business name

## Future Enhancements

🔮 **Planned Features** (Not yet implemented):
- MMS support (images, attachments)
- SMS templates
- Scheduled SMS
- Bulk SMS (compliance permitting)
- SMS analytics dashboard
- International SMS
