# Email Verification System

This document describes the email verification system for ConnectFlo user accounts.

## Overview

ConnectFlo requires email verification for users who sign up with username and password. OAuth users (Google) are automatically verified.

## Features

✅ **Email Verification Required** - Users must verify their email before logging in
✅ **Branded Email Templates** - Professional, responsive email templates
✅ **Reusable Components** - Modular email template system
✅ **Token Expiry** - Verification links expire after 24 hours
✅ **Resend Verification** - Users can request a new verification email
✅ **Welcome Email** - Sent automatically after verification
✅ **OAuth Auto-Verify** - Google sign-in users skip email verification

## Database Schema

Added to `User` model:

```prisma
emailVerified         Boolean   @default(false)
emailVerificationToken String?  @unique
verificationTokenExpiry DateTime?
```

## Email Templates

Located in `/backend/src/services/emailTemplates.ts`:

1. **Verification Email** - Sent during registration
2. **Welcome Email** - Sent after verification
3. **Verification Reminder** - For resend requests
4. **Password Reset** - For password recovery
5. **Team Invitation** - For team member invites
6. **Generic Notification** - For custom notifications

All templates feature:

- Responsive design (mobile-friendly)
- ConnectFlo branding
- Accessible HTML
- Plain text fallback

## API Endpoints

### Register User

```
POST /api/auth/register
```

- Creates user account
- Generates verification token
- Sends verification email
- Returns JWT token (with limited access)

### Login

```
POST /api/auth/login
```

- Checks email verification status
- Returns 403 if not verified
- Includes resend option in error response

### Verify Email

```
GET /api/auth/verify-email?token=xxx
```

- Validates verification token
- Marks email as verified
- Sends welcome email
- Returns user data

### Resend Verification

```
POST /api/auth/resend-verification
Body: { email: "user@example.com" }
```

- Generates new token
- Sends new verification email
- Works for unverified accounts only

## Frontend Components

### VerifyEmail Page

Route: `/verify-email?token=xxx`

Features:

- Loading state while verifying
- Success message with auto-redirect
- Error handling with resend option
- Expired token detection

### Login Enhancement

- Detects unverified account error
- Shows "Resend verification" button
- Inline resend functionality

## Setup Instructions

### 1. Run Database Migration

```bash
cd backend
npx prisma migrate dev --name add_email_verification
```

Or manually run:

```sql
ALTER TABLE "User"
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emailVerificationToken" TEXT UNIQUE,
ADD COLUMN "verificationTokenExpiry" TIMESTAMP;
```

### 2. Configure Email Service

Add to `backend/.env`:

```env
# Email Configuration
EMAIL_MODE=smtp  # or 'test' for Ethereal testing

# SMTP Settings (for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@connectflo.com

# Frontend URL (for verification links)
FRONTEND_URL=http://localhost:3000
```

### 3. Test Email Setup

For testing without real SMTP:

```env
EMAIL_MODE=test
```

This uses Ethereal (fake SMTP). Check console for preview URLs.

### 4. Update App.tsx Routes

Add the verify email route:

```typescript
import VerifyEmail from "./pages/VerifyEmail";

// In your routing logic
{
  view === "verify-email" && <VerifyEmail />;
}
```

## Email Service Configuration

### Development (Ethereal)

```env
EMAIL_MODE=test
```

- Fake SMTP for testing
- Preview URLs in console
- No actual emails sent

### Production (Gmail)

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-specific-password
```

### Production (SendGrid/Mailgun/AWS SES)

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-api-key
```

## User Flow

### Registration Flow

1. User fills signup form
2. Server creates account (emailVerified=false)
3. Verification email sent
4. User receives email with link
5. User clicks link → `/verify-email?token=xxx`
6. Server verifies token
7. Account marked as verified
8. Welcome email sent
9. User redirected to login

### Login Flow

1. User enters credentials
2. Server checks verification status
3. If not verified → 403 error with resend option
4. If verified → login successful

### OAuth Flow

1. User clicks "Sign in with Google"
2. Google authentication
3. Account created with emailVerified=true
4. User logged in immediately

## Customization

### Brand Colors

Edit in `emailTemplates.ts`:

```typescript
const BRAND_COLORS = {
  primary: "#4F46E5",
  secondary: "#818CF8",
  // ...
};
```

### Token Expiry

Change in `auth.ts`:

```typescript
tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hours
```

### Email Content

Each template function accepts parameters:

```typescript
verificationEmailTemplate(name, verificationUrl, expiryHours);
welcomeEmailTemplate(name, companyName);
passwordResetTemplate(name, resetUrl, expiryHours);
```

## Security Notes

1. **Tokens are cryptographically secure** - Generated with `crypto.randomBytes(32)`
2. **Tokens expire** - 24 hour default expiry
3. **One-time use** - Tokens cleared after verification
4. **Unique tokens** - Database constraint ensures uniqueness
5. **OAuth users auto-verified** - Trusted identity providers

## Troubleshooting

### Emails not sending

- Check EMAIL_MODE environment variable
- Verify SMTP credentials
- Check firewall/port 587 access
- Review console logs for errors

### Verification link not working

- Check FRONTEND_URL is correct
- Ensure token hasn't expired
- Verify token in database

### "Email already verified" error

- User already completed verification
- Can proceed to login

## Future Enhancements

- [ ] Email verification reminder after 24 hours
- [ ] Magic link login (passwordless)
- [ ] Email change verification
- [ ] Multi-language email templates
- [ ] Email template builder UI
- [ ] Email delivery tracking
- [ ] Bounce/complaint handling
