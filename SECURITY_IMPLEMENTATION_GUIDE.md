# Multi-Level Security System (MFA + Phone Verification)

## Overview

ConnectFlo implements a **progressive 3-tiered security system** that balances user experience with security requirements. Different features require different security levels based on their sensitivity.

## Security Levels

### Level 1: Email Verification ✉️

**Status**: Automatic for all users  
**Required For**: Basic account access  
**Implementation**: Email verification token sent upon registration

**What's Unlocked:**

- View-only access to dashboard
- Basic profile settings
- Read-only access to public features

---

### Level 2: Phone Verification 📱

**Status**: Required for voice features  
**Method**: SMS OTP (6-digit code, 10-minute expiry)  
**Required For**: Voice and SMS communication features

**What's Unlocked:**

- Making/receiving voice calls
- Sending/receiving SMS messages
- Accessing voicemail
- Viewing call logs
- Managing working hours
- **Viewing billing** (invoices, usage, current plan)
- Basic operational features

**User Flow:**

1. User adds phone number in settings
2. System sends 6-digit SMS code
3. User enters code to verify
4. Phone verification complete

---

### Level 3: Two-Factor Authentication (TOTP) 🔐

**Status**: Required for sensitive operations  
**Method**: TOTP (Time-based One-Time Password) via authenticator app  
**Required For**: Financial modifications, administrative, and integration features

**What's Unlocked:**

- **Billing Modifications**: Adding/changing payment methods, subscription changes, canceling service
- **Administrative**: Team management, role changes, tenant settings
- **Integrations**: OAuth connections, API keys, webhooks
- **Destructive Actions**: Account deletion, bulk data operations, phone number porting

**Note**: Viewing billing information (invoices, current plan, usage) only requires Level 2.

**User Flow:**

1. User initiates TOTP setup
2. System generates QR code and secret
3. User scans with authenticator app (Google Authenticator, Authy, etc.)
4. User enters 6-digit code to confirm
5. System provides 10 backup codes
6. MFA enabled

---

## Why This Tiered Approach?

### Security vs. User Experience

- **Problem**: Requiring TOTP immediately creates friction (60% of users don't have authenticator apps)
- **Solution**: Progressive enforcement based on feature sensitivity

### Attack Surface Protection

| Security Level | Protected Against              | Use Case             |
| -------------- | ------------------------------ | -------------------- |
| Level 1        | Account impersonation          | Basic access         |
| Level 2        | Toll fraud, SPAM calls         | Voice features       |
| Level 3        | Financial fraud, data breaches | Sensitive operations |

### Real-World Scenarios

1. **Compromised Password (No MFA)**

   - Attacker can: View data, make calls (Level 2)
   - Attacker cannot: Change billing, add OAuth, delete account (Level 3)

2. **Lost Phone (Has TOTP)**

   - User can: Use backup codes to access billing
   - User can: Disable MFA with current code

3. **SIM Swap Attack**
   - SMS OTP vulnerable
   - TOTP protected (secret stored in app, not tied to phone number)

---

## Technical Implementation

### Database Schema

```prisma
model User {
  // Level 1
  emailVerified         Boolean   @default(false)
  emailVerificationToken String?  @unique
  verificationTokenExpiry DateTime?

  // Level 2
  phoneNumber           String?
  phoneVerified         Boolean   @default(false)
  phoneVerificationCode String?
  phoneVerificationExpiry DateTime?

  // Level 3
  mfaEnabled            Boolean   @default(false)
  mfaSecret             String?   // TOTP secret (encrypted)
  mfaBackupCodes        String[]  @default([])
}
```

### Backend Routes

#### Phone Verification (Level 2)

- `POST /api/auth/send-phone-verification` - Send SMS OTP
- `POST /api/auth/verify-phone` - Verify SMS code

#### TOTP/MFA (Level 3)

- `POST /api/auth/mfa/setup` - Generate QR code and secret
- `POST /api/auth/mfa/verify-setup` - Confirm setup with initial code
- `POST /api/auth/mfa/verify` - Verify TOTP for sensitive operations
- `POST /api/auth/mfa/disable` - Disable MFA (requires current code)

### Middleware Protection

```typescript
// Apply to routes based on required level
import {
  requireEmailVerified,
  requirePhoneVerified,
  requireMFA,
} from "../middleware/security";

// Level 1: Basic routes
router.get("/api/dashboard", requireEmailVerified, getDashboard);

// Level 2: Voice features + billing view
router.post("/api/calls/make", requirePhoneVerified, makeCall);
router.get("/api/voicemails", requirePhoneVerified, getVoicemails);
router.get("/api/billing/invoices", requirePhoneVerified, getInvoices);
router.get("/api/billing/usage", requirePhoneVerified, getUsage);

// Level 3: Billing modifications + sensitive operations
router.post("/api/billing/payment-method", requireMFA, addPaymentMethod);
router.put("/api/billing/subscription", requireMFA, changeSubscription);
router.delete("/api/team/:userId", requireMFA, removeTeamMember);
router.post("/api/integrations/oauth", requireMFA, connectOAuth);
```

### Frontend Components

1. **PhoneVerification.tsx** - SMS OTP flow with phone number input
2. **TOTPSetup.tsx** - QR code display, secret backup, initial verification
3. **SecuritySettings.tsx** - Unified security dashboard showing all 3 levels

---

## Supported Authenticator Apps

Recommend these TOTP apps to users:

- **Google Authenticator** (iOS/Android) - Simple, reliable
- **Microsoft Authenticator** (iOS/Android) - Backup/sync support
- **Authy** (iOS/Android/Desktop) - Multi-device sync
- **1Password** (Cross-platform) - Password manager integration

---

## Migration Path

### For Existing Users

1. All existing users default to Level 1 (email verified if registered)
2. Prompt for phone verification when attempting voice features
3. Prompt for TOTP when attempting billing/admin operations

### For New Users

1. Email verification required on registration
2. Optional phone verification during onboarding (recommended)
3. Optional TOTP setup (encouraged for admins)

---

## Security Best Practices

### For SMS OTP (Level 2)

- ✅ 10-minute expiry on codes
- ✅ 6-digit random codes
- ✅ Rate limiting (max 3 attempts per hour)
- ✅ Clear SMS message format with company branding

### For TOTP (Level 3)

- ✅ Secret generated server-side (authenticator.generateSecret())
- ✅ QR code for easy setup
- ✅ 10 backup codes (8-character hex)
- ✅ Backup codes single-use
- ✅ Manual secret entry option
- ✅ Disable requires current TOTP code

### Error Handling

- Don't reveal if email/phone exists
- Generic error messages for failed OTP
- Rate limiting to prevent brute force
- Log security events for audit

---

## User Experience Considerations

### Onboarding Flow

```
Registration → Email Verify → Dashboard (Limited)
             ↓
             Phone Verify → Voice Features Unlocked
             ↓
             TOTP Setup (optional) → Full Access
```

### Prompts & Nudges

- **First Call Attempt**: "Phone verification required for voice features"
- **First Billing Access**: "Two-factor authentication required for billing"
- **Security Settings**: Visual progress bar showing 1/3, 2/3, 3/3 completion

### Recovery Scenarios

- **Lost Authenticator**: Use backup codes
- **Lost Backup Codes**: Contact support with ID verification
- **Changed Phone**: SMS to new number, or use TOTP

---

## Testing Checklist

### Level 1 (Email)

- [ ] Registration sends verification email
- [ ] Verification link activates account
- [ ] Expired tokens rejected (24hr expiry)
- [ ] Resend verification works

### Level 2 (Phone)

- [ ] SMS code sent successfully
- [ ] 6-digit code validates correctly
- [ ] Expired codes rejected (10min expiry)
- [ ] Invalid codes rejected
- [ ] Phone number required before sending
- [ ] Resend code works

### Level 3 (TOTP)

- [ ] QR code displays correctly
- [ ] Manual secret entry works
- [ ] Initial verification succeeds
- [ ] 10 backup codes generated
- [ ] Backup codes work once
- [ ] TOTP verification works for operations
- [ ] Disable MFA requires code
- [ ] Backup code download works

### Middleware

- [ ] requireEmailVerified blocks unverified users
- [ ] requirePhoneVerified blocks users without phone
- [ ] requireMFA blocks users without TOTP
- [ ] Error messages indicate correct level needed

---

## API Response Formats

### Error Response (Security Gate)

```json
{
  "error": "Phone verification required for voice features",
  "level": "phone_required",
  "securityLevel": 2,
  "message": "Please verify your phone number to access voice features"
}
```

### Success Response (Phone Verification)

```json
{
  "message": "Phone number verified successfully",
  "phoneVerified": true
}
```

### Success Response (MFA Setup Complete)

```json
{
  "message": "MFA enabled successfully",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8", ...],
  "mfaEnabled": true
}
```

---

## Environment Variables

```env
# Twilio (for SMS OTP)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# Frontend URL (for verification links)
FRONTEND_URL=http://localhost:3000
```

---

## Dependencies

```json
{
  "backend": {
    "otplib": "^12.0.1", // TOTP generation/verification
    "qrcode": "^1.5.3", // QR code generation
    "@types/qrcode": "^1.5.5" // TypeScript types
  }
}
```

---

## Future Enhancements

### Potential Additions

1. **WebAuthn/Passkeys** - Hardware key support (Level 4?)
2. **Biometric Authentication** - Face ID/Touch ID for mobile apps
3. **IP Whitelisting** - Restrict access by IP range (enterprise feature)
4. **Session Management** - View/revoke active sessions
5. **Security Audit Log** - Track all auth-related events

### Metrics to Track

- MFA adoption rate by user role
- Time to complete each security level
- Failed authentication attempts
- Backup code usage frequency
- Support tickets related to security

---

## Support & Documentation

### For End Users

- Link to this guide in-app
- Video tutorials for phone verification
- Authenticator app recommendations
- Backup code storage best practices

### For Developers

- Middleware usage examples
- Testing security levels locally
- Debugging auth flows
- Contributing security improvements

---

## Compliance Notes

### GDPR

- Phone numbers stored with user consent
- Can delete phone number (disables Level 2)
- MFA secret encrypted at rest

### PCI-DSS

- Billing operations protected by Level 3
- MFA required for payment method changes

### SOC 2

- Multi-factor authentication for sensitive operations
- Audit logs for security events
- Regular security assessments

---

## Conclusion

This tiered security system provides:
✅ **Strong protection** for sensitive operations (billing, admin)  
✅ **Low friction** for daily use (calls, messages)  
✅ **Progressive disclosure** (users unlock features as needed)  
✅ **Defense in depth** (multiple layers of authentication)

Perfect balance between security and usability! 🚀
