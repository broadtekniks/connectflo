# Google Integration Setup Guide

## Overview

ConnectFlo now supports Google Calendar, Gmail, Google Drive, and Google Sheets integrations. Tenants can connect their Google accounts via OAuth 2.0 and use Google services in workflows.

## Features Implemented

### Phase 1: Calendar + Gmail

- **Google Calendar**: Schedule meetings, check availability, send invites
- **Gmail**: Send professional emails with better deliverability than SMTP

### Phase 2: Drive + Sheets

- **Google Drive**: Upload files, share documents automatically
- **Google Sheets**: Log conversations, append data rows for analytics

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable these APIs:

   - Google Calendar API
   - Gmail API
   - Google Drive API
   - Google Sheets API

4. Configure OAuth Consent Screen:

   - User Type: External
   - App name: "ConnectFlo"
   - Scopes: Add the following scopes:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/spreadsheets`

5. Create OAuth 2.0 Credentials:

   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3002/api/integrations/google/callback`
   - For production: `https://yourdomain.com/api/integrations/google/callback`

6. Copy Client ID and Client Secret

### 2. Backend Environment Variables

Add to `backend/.env`:

```env
# Google OAuth Integration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3002/api/integrations/google/callback

# Frontend URL for OAuth redirects
FRONTEND_URL=http://localhost:5173
```

### 3. Database Migration

The schema has been updated with a new `Integration` model. Run:

```bash
cd backend
npx prisma db push
npx prisma generate
```

### 4. Install Dependencies

```bash
cd backend
npm install googleapis
```

### 5. Start Backend Server

```bash
cd backend
npm run dev
```

## Usage

### Connecting Google Account

1. Navigate to **Integrations** page
2. Find Google Calendar, Gmail, Drive, or Sheets
3. Click **Connect**
4. Sign in with Google account
5. Grant permissions
6. You'll be redirected back with success message

### Using in Workflows

#### Google Calendar - Create Event

```
Trigger: Incoming Message
↓
Condition: contains "schedule" or "meeting"
↓
Create Calendar Event
  - Title: "Meeting with {{customer.name}}"
  - Start: (datetime)
  - End: (datetime)
  - Attendees: "{{customer.email}}"
↓
Send Reply: "Meeting scheduled! Check your calendar."
```

#### Gmail - Send Email

```
Trigger: Incoming Call
↓
AI Generate (create summary)
↓
Send Gmail
  - To: "{{customer.email}}"
  - Subject: "Call Summary - {{trigger.timestamp}}"
  - Body: "{{variables.workflow.aiResponse}}"
```

#### Google Drive - Upload Transcript

```
Trigger: After call ends
↓
Upload to Drive
  - File Name: "transcript-{{conversation.id}}.txt"
  - Content: "{{conversation.transcript}}"
  - MIME Type: "text/plain"
```

#### Google Sheets - Log Conversation

```
Trigger: Incoming Message
↓
Add Row to Sheet
  - Spreadsheet ID: "1abc..."
  - Sheet Name: "Conversations"
  - Values: "{{customer.name}}, {{customer.email}}, {{conversation.status}}, {{trigger.timestamp}}"
```

## Workflow Variables

After Google actions execute, these variables are available:

- `{{variables.workflow.calendarEventId}}` - Calendar event ID
- `{{variables.workflow.calendarEventLink}}` - Google Calendar link
- `{{variables.workflow.meetLink}}` - Google Meet link
- `{{variables.workflow.emailMessageId}}` - Gmail message ID
- `{{variables.workflow.driveFileId}}` - Drive file ID
- `{{variables.workflow.driveFileLink}}` - Drive file view link
- `{{variables.workflow.sheetUpdatedRange}}` - Updated spreadsheet range

## Security Notes

⚠️ **Production Considerations:**

1. **Token Encryption**: Currently tokens are stored in JSON. For production:

   - Encrypt credentials in database
   - Use environment-specific encryption keys
   - Implement token rotation

2. **OAuth Scopes**: Only request scopes you need

   - Current setup requests all 4 scopes
   - Consider per-integration scope requests

3. **Error Handling**: Add retry logic and better error messages

4. **Rate Limiting**: Google APIs have rate limits
   - Implement exponential backoff
   - Cache responses where appropriate

## Troubleshooting

### "Integration not connected"

- Check if tenant has connected the integration
- Verify OAuth tokens haven't expired
- Check backend logs for refresh token errors

### "Insufficient permissions"

- Ensure all required scopes are in OAuth consent screen
- User must re-authenticate if scopes changed

### Redirect URI mismatch

- Verify GOOGLE_REDIRECT_URI matches exactly in:
  - Google Cloud Console
  - Backend .env file
  - No trailing slashes

## API Endpoints

- `GET /api/integrations` - List connected integrations
- `POST /api/integrations/google/connect` - Initiate OAuth flow
- `GET /api/integrations/google/callback` - OAuth callback handler
- `POST /api/integrations/google/disconnect` - Revoke access

## File Structure

```
backend/
  src/
    services/integrations/google/
      auth.ts          # OAuth flow management
      calendar.ts      # Calendar API wrapper
      gmail.ts         # Gmail API wrapper
      drive.ts         # Drive API wrapper
      sheets.ts        # Sheets API wrapper
    routes/
      integrations.ts  # Integration endpoints

frontend/
  pages/
    Integrations.tsx   # Integration management UI
    Workflows.tsx      # Workflow builder (Google nodes)
  constants.ts         # Google integrations list
```

## Next Steps

- Add Google Meet integration for video escalation
- Implement webhook listeners for Calendar events
- Add bulk operations (batch email sends)
- Build templates for common workflows
- Add analytics dashboard for Google Sheets data
