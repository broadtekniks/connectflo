# Twilio Integration Setup Guide

This guide explains how to configure Twilio with OpenAI Realtime API for natural-sounding voice calls in ConnectFlo.

## Overview

ConnectFlo now supports two telephony providers:

- **Telnyx** - Uses GPT-4 text + Telnyx TTS (robotic voice, lower cost)
- **Twilio** - Uses OpenAI Realtime API (natural voice, higher cost)

## Cost Comparison

### Telnyx (Current Default)

- Phone number: ~$1.00/month
- Voice calls: $0.0085/minute
- AI processing: ~$0.02/call (GPT-4 text)
- **Total per 100 calls (2 min avg): ~$6.70/month**

### Twilio + OpenAI Realtime

- Phone number: $1.15/month
- Voice calls: $0.0085/minute (inbound)
- AI processing: ~$0.30/call (OpenAI Realtime audio)
- **Total per 100 calls (2 min avg): ~$32.85/month**

**Cost difference:** ~5x more expensive for natural voice

## Setup Instructions

### 1. Create Twilio Account

1. Sign up at https://www.twilio.com/try-twilio
2. Complete phone verification
3. Get your credentials from the Twilio Console

### 2. Configure Environment Variables

Add these to your `.env` file in the `backend` directory:

```env
# Twilio Credentials
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WEBHOOK_URL=https://your-domain.ngrok.io/webhooks/twilio

# OpenAI API Key (required for Twilio Realtime Voice)
OPENAI_API_KEY=your_openai_api_key
```

## How to Get Twilio Credentials

1. **Create a Twilio Account**: https://www.twilio.com/try-twilio
2. **Get Account SID and Auth Token**:
   - Navigate to Console → Account → API keys & tokens
   - Copy your Account SID
   - Copy your Auth Token (click "Show" to reveal)
3. **Set Webhook URL**:
   - Use ngrok for local development: `ngrok http 3002`
   - Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
   - Set `TWILIO_WEBHOOK_URL=https://abc123.ngrok.io/webhooks/twilio`

## Twilio vs Telnyx Comparison

### Provider Selection

- **Telnyx**: Basic voice (robotic TTS), lower cost (~$0.02/call AI cost)
- **Twilio**: OpenAI Realtime API (human-like voice), higher cost (~$0.30/call AI cost)

### When to Use Each

**Use Telnyx when:**

- Cost optimization is critical
- Basic voice quality is acceptable
- High call volume with budget constraints

**Use Twilio when:**

- Natural voice quality is required
- Customer experience is priority
- Premium service tier

## Phone Number Provisioning

When purchasing a number, select the provider:

1. **Frontend**: Use the "Provider" dropdown in Phone Numbers → Buy Numbers
2. **Backend**: Provider is stored in `PhoneNumber.provider` field
3. **Routing**: Incoming calls automatically route to correct provider service

## Voice Quality

### Telnyx (Chained Architecture)

- Audio → Telnyx STT → GPT-4 text → Telnyx TTS → Robotic voice
- Cost: ~$0.02/call (AI processing)

### Twilio (Realtime Architecture)

- Audio → OpenAI Realtime API → Natural voice
- Cost: ~$0.30/call (AI processing)
- Uses GPT-4o Realtime model with native speech capabilities

## Webhook Configuration

### Telnyx Webhook

- URL: `{TELNYX_WEBHOOK_URL}/webhooks/telnyx`
- Handles: Call Control events, transcriptions

### Twilio Webhook

- Voice URL: `{TWILIO_WEBHOOK_URL}/webhooks/twilio/voice`
- Status Callback: `{TWILIO_WEBHOOK_URL}/webhooks/twilio/status`
- WebSocket: `wss://{domain}/ws/twilio` (Media Streams)

## Installation Steps

1. Install dependencies:

```bash
cd backend
npm install
```

2. Add environment variables to `.env`

3. Start the server:

```bash
npm run dev
```

4. Verify both providers are initialized:

```
[Telnyx] Service initialized
[Twilio] WebSocket server initialized on /ws/twilio
```

## Pricing

### Twilio Pricing (US)

- Phone number: $1.15/month
- Inbound voice: $0.0085/minute
- Outbound voice: $0.013/minute
- SMS: $0.0079/segment
- **OpenAI Realtime API**:
  - Audio input: $100/1M tokens (~$0.10/min listening)
  - Audio output: $200/1M tokens (~$0.20/min talking)

### Telnyx Pricing (US)

- Phone number: ~$1.00/month
- Voice: $0.0085/minute
- SMS: $0.0079/segment
- **GPT-4 Text API**: ~$0.02/call

### Cost Example (100 calls/month, 2 min avg)

- **Telnyx Total**: ~$6.70/month
- **Twilio Total**: ~$32.85/month

## Testing

1. Purchase a number with "Twilio (OpenAI Voice)" provider
2. Call the number from your phone
3. Verify natural, human-like voice responses
4. Compare with Telnyx number for quality difference

## Troubleshooting

**Issue**: No voice response on Twilio calls

- Check `TWILIO_WEBHOOK_URL` is publicly accessible
- Verify `OPENAI_API_KEY` is set
- Check backend logs for WebSocket connection

**Issue**: "Twilio credentials not configured"

- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set
- Restart backend server after adding env vars

**Issue**: Robotic voice on Twilio number

- Ensure provider is set to "TWILIO" in database
- Check webhook routing in Twilio console
- Verify Media Stream WebSocket is connecting

## Additional Resources

- Twilio Voice API: https://www.twilio.com/docs/voice
- Twilio Media Streams: https://www.twilio.com/docs/voice/media-streams
- OpenAI Realtime API: https://platform.openai.com/docs/guides/realtime
- Twilio + OpenAI Example: https://github.com/openai/openai-realtime-twilio-demo
