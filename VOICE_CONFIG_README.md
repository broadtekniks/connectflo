# Voice Configuration API

This document describes how to configure and test different TTS voices for the ConnectFlo phone system.

## Overview

ConnectFlo now supports multiple TTS (Text-to-Speech) voices for phone calls using Telnyx. Users can select from various voices and test them before deployment.

## Available Voices

The following voices are currently supported:

1. **female** - Standard female voice (US English)
2. **male** - Standard male voice (US English)
3. **Polly.Joanna** - Neural female voice (US English) - Natural and conversational
4. **Polly.Matthew** - Neural male voice (US English) - Confident and clear
5. **Polly.Amy** - Female voice (British English) - Sophisticated
6. **Polly.Brian** - Male voice (British English) - Professional

## API Endpoints

### 1. Get Available Voices

```http
GET /api/voice-config/voices
```

Returns a list of all available voices with their properties.

**Response:**

```json
{
  "voices": [
    {
      "id": "female",
      "name": "Female (US English)",
      "gender": "female",
      "language": "en-US",
      "description": "Standard female voice, clear and professional"
    },
    ...
  ]
}
```

### 2. Set Voice Preference for Tenant

```http
POST /api/voice-config/preference
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**

```json
{
  "tenantId": "tenant_123",
  "voice": "Polly.Joanna",
  "language": "en-US"
}
```

**Response:**

```json
{
  "success": true,
  "preference": {
    "tenantId": "tenant_123",
    "voice": "Polly.Joanna",
    "language": "en-US"
  }
}
```

### 3. Get Current Voice Preference

```http
GET /api/voice-config/preference/:tenantId
Authorization: Bearer <token>
```

**Response:**

```json
{
  "tenantId": "tenant_123",
  "preference": {
    "voice": "Polly.Joanna",
    "language": "en-US"
  }
}
```

### 4. Test a Voice (Make Test Call)

```http
POST /api/voice-config/test
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**

```json
{
  "phoneNumber": "+1234567890",
  "voice": "Polly.Joanna",
  "language": "en-US",
  "testMessage": "Hello! This is a test of the Joanna voice. How do I sound?"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Test call initiated",
  "callControlId": "v3:xxx",
  "voice": "Polly.Joanna",
  "language": "en-US"
}
```

### 5. Preview Voice Information

```http
POST /api/voice-config/test-preview
Content-Type: application/json
Authorization: Bearer <token>
```

**Body:**

```json
{
  "voice": "Polly.Joanna",
  "language": "en-US"
}
```

**Response:**

```json
{
  "success": true,
  "voice": {
    "id": "Polly.Joanna",
    "name": "Joanna (Neural)",
    "gender": "female",
    "language": "en-US",
    "description": "Natural-sounding neural voice, friendly and conversational"
  },
  "previewText": "This is a Joanna (Neural) speaking. Natural-sounding neural voice, friendly and conversational",
  "note": "Use POST /api/voice-config/test with a phone number to hear the actual voice"
}
```

## Usage Flow

### Setting Voice for a Tenant

1. Get list of available voices:

   ```bash
   curl http://localhost:3002/api/voice-config/voices \
     -H "Authorization: Bearer <token>"
   ```

2. Set preference for your tenant:

   ```bash
   curl -X POST http://localhost:3002/api/voice-config/preference \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{
       "tenantId": "your_tenant_id",
       "voice": "Polly.Joanna",
       "language": "en-US"
     }'
   ```

3. Test the voice:
   ```bash
   curl -X POST http://localhost:3002/api/voice-config/test \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{
       "phoneNumber": "+1234567890",
       "voice": "Polly.Joanna",
       "language": "en-US",
       "testMessage": "Hello! This is Joanna. How does this voice sound?"
     }'
   ```

### How It Works

1. **Voice Preferences**: Each tenant can set a preferred voice that will be used for all their incoming calls
2. **In-Memory Storage**: Voice preferences are stored in memory (for production, you'd want to persist to database)
3. **Default Voice**: If no preference is set, the system uses "female" voice with "en-US" language
4. **Hybrid Voice Service**: When a call comes in, the hybrid voice service automatically uses the tenant's voice preference

## Integration with Hybrid Voice

The voice configuration integrates seamlessly with the hybrid voice service:

```typescript
// When a call comes in:
1. HybridVoiceService.startSession() is called
2. It retrieves the tenant's voice preference
3. All TTS responses use that voice configuration
4. Voice is stored in the session for consistency
```

## Technical Details

### Voice Storage

Voice preferences are currently stored in-memory in the `HybridVoiceService`:

```typescript
private voicePreferences: Map<string, { voice: string; language: string }> = new Map();
```

For production, consider:

- Storing in database (add voice/language columns to tenant table)
- Caching with Redis for performance
- Allowing per-workflow voice overrides

### Session Management

Each call session includes voice configuration:

```typescript
interface HybridSession {
  sessionId: string;
  callControlId: string;
  tenantId: string;
  workflowId?: string;
  isListening: boolean;
  conversationHistory: Array<{ role: string; content: string }>;
  voice: string; // e.g., "Polly.Joanna"
  language: string; // e.g., "en-US"
}
```

### Telnyx Integration

The `TelnyxService.speakText()` method now accepts voice and language parameters:

```typescript
async speakText(
  callControlId: string,
  text: string,
  voice: string = "female",
  language: string = "en-US"
)
```

## Frontend Integration Example

```typescript
// Fetch available voices
const voices = await fetch("/api/voice-config/voices", {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

// Set voice preference
await fetch("/api/voice-config/preference", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    tenantId: currentTenant.id,
    voice: "Polly.Joanna",
    language: "en-US",
  }),
});

// Test voice with user's phone
await fetch("/api/voice-config/test", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    phoneNumber: userPhone,
    voice: "Polly.Joanna",
    testMessage: "Hello! This is how I will sound on your calls.",
  }),
});
```

## Recommendations

### Voice Selection

- **Customer Service**: Use neural voices (Polly.Joanna, Polly.Matthew) for more natural conversations
- **Formal/Professional**: Use standard male/female voices for clarity
- **International**: Use British voices (Amy, Brian) for UK customers

### Testing

- Always test a voice before setting it as the tenant default
- Consider user feedback when selecting voices
- Test with actual customer scenarios

### Performance

- Voice preferences are cached in memory for fast access
- No performance impact on call latency
- Voice selection happens at session initialization

## Future Enhancements

Potential improvements:

1. **Database Persistence**: Store preferences in PostgreSQL
2. **Workflow-Level Overrides**: Allow different voices per workflow
3. **Voice Sampling**: Integrate audio samples for preview
4. **Custom Voices**: Support for custom Telnyx voice uploads
5. **A/B Testing**: Compare voice performance metrics
6. **Multi-Language**: Expand to Spanish, French, etc.
7. **Voice Mixing**: Use different voices for different parts of conversation

## Troubleshooting

### Voice not changing on calls

- Check that USE_STREAMING_VOICE=true in .env
- Verify tenant ID matches in preference setting
- Check server logs for `[Hybrid] Voice preference set` message

### Test call fails

- Verify phone number format (+1234567890)
- Check Telnyx account has outbound calling enabled
- Ensure TELNYX_API_KEY is valid

### Voice not in list

- Only Telnyx-supported voices work
- Check Telnyx documentation for additional voices
- Add new voices to `AVAILABLE_VOICES` array in hybridVoice.ts
