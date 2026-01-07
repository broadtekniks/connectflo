/**
 * Email Template System for ConnectFlo
 * Provides reusable branded email templates
 */

interface EmailTemplate {
  subject: string;
  html: string;
}

// Brand colors and styling
const BRAND_COLORS = {
  primary: "#4F46E5", // Indigo-600
  secondary: "#818CF8", // Indigo-400
  success: "#10B981", // Green-500
  danger: "#EF4444", // Red-500
  dark: "#1E293B", // Slate-800
  light: "#F8FAFC", // Slate-50
  border: "#E2E8F0", // Slate-200
  text: "#334155", // Slate-700
  textLight: "#64748B", // Slate-500
};

/**
 * Base email template wrapper
 */
function baseTemplate(content: string, preheader: string = ""): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>ConnectFlo</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background-color: ${BRAND_COLORS.light};
    }
    .preheader {
      display: none;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }
    .email-wrapper {
      width: 100%;
      background-color: ${BRAND_COLORS.light};
      padding: 40px 0;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${
    BRAND_COLORS.secondary
  } 100%);
      padding: 32px;
      text-align: center;
    }
    .logo {
      width: 48px;
      height: 48px;
      background-color: #ffffff;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: ${BRAND_COLORS.primary};
      margin-bottom: 12px;
    }
    .header-title {
      color: #ffffff;
      font-size: 24px;
      font-weight: bold;
      margin: 0;
    }
    .content {
      padding: 40px 32px;
      color: ${BRAND_COLORS.text};
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: ${BRAND_COLORS.primary};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #4338CA;
    }
    .footer {
      background-color: ${BRAND_COLORS.light};
      padding: 32px;
      text-align: center;
      color: ${BRAND_COLORS.textLight};
      font-size: 14px;
    }
    .footer a {
      color: ${BRAND_COLORS.primary};
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background-color: ${BRAND_COLORS.border};
      margin: 24px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        border-radius: 0;
      }
      .content {
        padding: 24px 20px !important;
      }
      .header {
        padding: 24px 20px !important;
      }
      .footer {
        padding: 24px 20px !important;
      }
    }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table class="email-container" cellpadding="0" cellspacing="0" role="presentation">
          <!-- Header -->
          <tr>
            <td class="header">
              <div class="logo">C</div>
              <h1 class="header-title">ConnectFlo</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="footer">
              <p style="margin: 0 0 8px 0;">© ${new Date().getFullYear()} ConnectFlo Inc. All rights reserved.</p>
              <p style="margin: 0;">
                <a href="https://connectflo.com">Website</a> | 
                <a href="https://connectflo.com/privacy">Privacy Policy</a> | 
                <a href="https://connectflo.com/support">Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Email Verification Template
 */
export function verificationEmailTemplate(
  name: string,
  verificationUrl: string,
  expiryHours: number = 24
): EmailTemplate {
  const content = `
    <h2 style="color: ${BRAND_COLORS.dark}; margin-top: 0;">Welcome to ConnectFlo, ${name}!</h2>
    <p>Thank you for signing up. To get started, please verify your email address by clicking the button below:</p>
    
    <div style="text-align: center;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </div>
    
    <p style="color: ${BRAND_COLORS.textLight}; font-size: 14px;">
      This link will expire in ${expiryHours} hours. If you didn't create an account with ConnectFlo, you can safely ignore this email.
    </p>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: ${BRAND_COLORS.textLight};">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${verificationUrl}" style="color: ${BRAND_COLORS.primary}; word-break: break-all;">${verificationUrl}</a>
    </p>
  `;

  return {
    subject: "Verify your ConnectFlo account",
    html: baseTemplate(
      content,
      "Please verify your email address to activate your ConnectFlo account"
    ),
  };
}

/**
 * Welcome Email Template (after verification)
 */
export function welcomeEmailTemplate(
  name: string,
  companyName: string
): EmailTemplate {
  const content = `
    <h2 style="color: ${
      BRAND_COLORS.dark
    }; margin-top: 0;">🎉 Your account is verified!</h2>
    <p>Hi ${name},</p>
    <p>Welcome to ConnectFlo! Your email has been verified and your account is now active.</p>
    
    <div style="background-color: ${
      BRAND_COLORS.light
    }; padding: 20px; border-radius: 6px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: ${BRAND_COLORS.dark};">What's next?</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Set up your first phone number</li>
        <li style="margin-bottom: 8px;">Configure your AI workflows</li>
        <li style="margin-bottom: 8px;">Invite team members to ${companyName}</li>
        <li style="margin-bottom: 0;">Explore our knowledge base and integrations</li>
      </ul>
    </div>
    
    <div style="text-align: center;">
      <a href="${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/dashboard" class="button">Go to Dashboard</a>
    </div>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px;">
      Need help getting started? Check out our <a href="${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/docs" style="color: ${
    BRAND_COLORS.primary
  };">documentation</a> or reach out to our support team.
    </p>
  `;

  return {
    subject: "🎉 Welcome to ConnectFlo!",
    html: baseTemplate(content, "Your ConnectFlo account is ready to go!"),
  };
}

/**
 * Email Verification Reminder Template
 */
export function verificationReminderTemplate(
  name: string,
  verificationUrl: string
): EmailTemplate {
  const content = `
    <h2 style="color: ${BRAND_COLORS.dark}; margin-top: 0;">Verify your email address</h2>
    <p>Hi ${name},</p>
    <p>We noticed you haven't verified your email address yet. Please click the button below to complete your registration:</p>
    
    <div style="text-align: center;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </div>
    
    <p style="color: ${BRAND_COLORS.textLight}; font-size: 14px;">
      This link will expire in 24 hours. If you didn't create this account, please ignore this email.
    </p>
  `;

  return {
    subject: "Please verify your ConnectFlo account",
    html: baseTemplate(content, "Complete your ConnectFlo registration"),
  };
}

/**
 * Password Reset Template
 */
export function passwordResetTemplate(
  name: string,
  resetUrl: string,
  expiryHours: number = 1
): EmailTemplate {
  const content = `
    <h2 style="color: ${BRAND_COLORS.dark}; margin-top: 0;">Reset your password</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    
    <div style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    
    <p style="color: ${BRAND_COLORS.textLight}; font-size: 14px;">
      This link will expire in ${expiryHours} hour(s). If you didn't request a password reset, please ignore this email or contact support if you have concerns.
    </p>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: ${BRAND_COLORS.textLight};">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: ${BRAND_COLORS.primary}; word-break: break-all;">${resetUrl}</a>
    </p>
  `;

  return {
    subject: "Reset your ConnectFlo password",
    html: baseTemplate(content, "Reset your password to access your account"),
  };
}

/**
 * Team Invitation Template
 */
export function teamInvitationTemplate(
  inviterName: string,
  companyName: string,
  invitationUrl: string,
  role: string
): EmailTemplate {
  const content = `
    <h2 style="color: ${BRAND_COLORS.dark}; margin-top: 0;">You've been invited to join ${companyName}</h2>
    <p>${inviterName} has invited you to join their team on ConnectFlo as a <strong>${role}</strong>.</p>
    
    <div style="background-color: ${BRAND_COLORS.light}; padding: 20px; border-radius: 6px; margin: 24px 0;">
      <p style="margin: 0;"><strong>Company:</strong> ${companyName}</p>
      <p style="margin: 8px 0 0 0;"><strong>Role:</strong> ${role}</p>
    </div>
    
    <div style="text-align: center;">
      <a href="${invitationUrl}" class="button">Accept Invitation</a>
    </div>
    
    <p style="color: ${BRAND_COLORS.textLight}; font-size: 14px;">
      This invitation will expire in 7 days. If you don't want to join this team, you can safely ignore this email.
    </p>
  `;

  return {
    subject: `${inviterName} invited you to join ${companyName} on ConnectFlo`,
    html: baseTemplate(content, `Join ${companyName} on ConnectFlo`),
  };
}

/**
 * Generic notification template
 */
export function notificationTemplate(
  title: string,
  message: string,
  actionUrl?: string,
  actionText?: string
): EmailTemplate {
  let actionButton = "";
  if (actionUrl && actionText) {
    actionButton = `
      <div style="text-align: center;">
        <a href="${actionUrl}" class="button">${actionText}</a>
      </div>
    `;
  }

  const content = `
    <h2 style="color: ${BRAND_COLORS.dark}; margin-top: 0;">${title}</h2>
    <p>${message}</p>
    ${actionButton}
  `;

  return {
    subject: title,
    html: baseTemplate(content, title),
  };
}
