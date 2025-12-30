# Email Setup with Nodemailer

## Overview

ConnectFlo uses Nodemailer for sending all emails via SMTP. This includes workflow automation emails, notifications, and customer communications.

## Prerequisites

1. SMTP server access (Gmail, Outlook, SendGrid, etc.)
2. SMTP credentials (username/password or app password)

## Setup Instructions

### Option 1: Gmail SMTP

1. **Enable 2-Step Verification** on your Google Account
2. **Create App Password**:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" and "Other (Custom name)"
   - Generate password and copy it

3. **Configure Environment Variables**:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
ADMIN_EMAIL=admin@yourdomain.com
```

### Option 2: Outlook/Office365 SMTP

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@outlook.com
```

### Option 3: SendGrid SMTP

1. Create SendGrid account
2. Generate API key
3. Configure:

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=verified-sender@yourdomain.com
```

### Option 4: Custom SMTP Server

```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-username
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

## Usage in Workflows

### Basic Email Configuration

- **To**: Email address or variable (e.g., `{{customer.email}}`)
- **Subject**: Email subject line (supports variables)
- **Body**: Email content (supports variables and HTML)
- **HTML Mode**: Enable for HTML emails
- **From**: Override default sender
- **Reply-To**: Where replies should be sent

### Variable Support

All email fields support variable interpolation:

```
To: {{customer.email}}
Subject: Order #{{customer.metadata.orderId}} Confirmation
Body: Hi {{customer.name}}, your order has been received...
```

### Example Use Cases

1. **Order Confirmations**
   ```
   To: {{customer.email}}
   Subject: Order #{{order.id}} Confirmed
   Body: Thank you for your order...
   ```

2. **Support Notifications**
   ```
   To: {{ADMIN_EMAIL}}
   Subject: New Support Request from {{customer.name}}
   Body: Customer inquiry: {{conversation.lastMessage}}
   ```

3. **Appointment Reminders**
   ```
   To: {{customer.email}}
   Subject: Appointment Reminder - {{appointment.date}}
   Body: This is a reminder about your appointment...
   ```

## SMTP Provider Limits

### Gmail
- Free: 500 emails/day
- Google Workspace: 2,000 emails/day
- Best for: Development and small deployments

### SendGrid
- Free: 100 emails/day
- Paid: 40,000+ emails/month
- Best for: Production use

### Mailgun
- Free: 5,000 emails/month
- Best for: Transactional emails

## Troubleshooting

### "Invalid login" or "Authentication failed"
- **Gmail**: Use App Password, not regular password
- **Outlook**: Ensure account allows SMTP access
- Check username/password in `.env`

### Emails not sending
- Verify SMTP credentials are correct
- Check `SMTP_HOST` and `SMTP_PORT`
- Test connection: Server logs show "SMTP server is ready"
- Check firewall/network allows outbound SMTP

### Emails going to spam
- Use authenticated domain for sender
- Include proper headers (From, Reply-To)
- Avoid spam trigger words
- Consider SPF/DKIM records for custom domain

### "Connection timeout"
- Check `SMTP_PORT` (587 for TLS, 465 for SSL)
- Set `SMTP_SECURE=true` for port 465
- Verify firewall allows outbound connections

## Security Best Practices

1. **Never commit credentials** - Keep `.env` in `.gitignore`
2. **Use app passwords** instead of account passwords
3. **Enable 2FA** on email accounts
4. **Rotate passwords** regularly
5. **Use environment-specific** SMTP for dev/staging/prod
6. **Monitor sending** to avoid spam complaints

## Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [SendGrid SMTP Guide](https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api)
- [Mailgun SMTP](https://documentation.mailgun.com/en/latest/user_manual.html#sending-via-smtp)
