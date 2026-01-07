# Google OAuth Setup Guide

This guide explains how to set up Google OAuth authentication for ConnectFlo.

## ⚠️ Critical: Fix the 403 Error

If you're seeing this error:

```
GET https://accounts.google.com/gsi/status?client_id=... 403 (Forbidden)
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
```

**You MUST add `http://localhost:3000` to the authorized JavaScript origins** (see step 8 below).

## Backend Setup

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** (or People API)
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client ID**
6. Configure the consent screen if prompted:
   - User Type: **External** (for testing)
   - Add your email as a test user
7. Select **Web application** as the application type
8. **CRITICAL:** Add authorized JavaScript origins:
   - `http://localhost:3000` ⚠️ **This is your frontend port!**
   - `http://localhost:3001` (if needed)
   - Your production domain (e.g., `https://yourdomain.com`)
9. Add authorized redirect URIs (optional for this implementation):
   - `http://localhost:3000` (for development)
   - Your production domain
10. Click **Create** and copy your **Client ID** and **Client Secret**

**Important Notes:**

- The frontend runs on port **3000** by default
- The backend runs on port **3002** by default
- Google OAuth needs the **frontend** port (3000) in authorized origins

### 2. Configure Environment Variables

Add these to your `backend/.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### 3. Configure Frontend Environment

Create or update `.env` file in the root directory:

```env
# Google OAuth (Frontend)
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
```

**Note:** Use the same Client ID for both backend and frontend.

## How It Works

### Login Flow

1. User clicks "Google" button on login page
2. Google Sign-In popup appears
3. User authenticates with Google
4. Google returns a credential (JWT token)
5. Frontend sends credential to backend `/api/auth/google`
6. Backend verifies the Google token
7. If user exists, returns JWT token for the user
8. If user doesn't exist, redirects to signup to collect company name

### Signup Flow

1. User clicks "Google" button on signup page
2. Google Sign-In popup appears
3. User authenticates with Google
4. Google returns a credential
5. User is prompted to enter company name
6. Frontend sends credential + company name to backend
7. Backend creates new tenant and user account
8. Returns JWT token

## Features

- ✅ **Seamless Login**: Existing users can log in with one click
- ✅ **Quick Signup**: New users only need to provide company name
- ✅ **No Password**: OAuth users don't need to manage passwords
- ✅ **Profile Data**: Automatically imports name and avatar from Google
- ✅ **Secure**: Uses Google's OAuth 2.0 with token verification

## Security Notes

1. **Token Verification**: The backend verifies Google tokens using `google-auth-library`
2. **No Password Storage**: OAuth users have `null` password field
3. **Tenant Isolation**: Each user is associated with a tenant
4. **JWT Security**: Standard JWT tokens with 7-day expiration

## Testing

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `npm run dev`
3. Navigate to login or signup page
4. Click the "Google" button
5. Sign in with your Google account
6. For new users, enter a company name when prompted

## Troubleshooting

### "Google Sign-In not loaded"

- Check that `VITE_GOOGLE_CLIENT_ID` is set in your `.env` file
- Refresh the page to reload the Google script

### "Google authentication failed"

- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in backend `.env`
- Check that the Client ID matches between frontend and backend
- Ensure your domain is in the authorized JavaScript origins

### "Company name already taken"

- The company name generates a URL slug that must be unique
- Try a different company name or variation

## Production Deployment

1. Update authorized JavaScript origins in Google Cloud Console to include your production domain
2. Update environment variables in your production environment
3. Ensure HTTPS is enabled (required by Google OAuth)
