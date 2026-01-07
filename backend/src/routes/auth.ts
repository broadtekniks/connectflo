import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { EmailService } from "../services/email";
import {
  verificationEmailTemplate,
  welcomeEmailTemplate,
  verificationReminderTemplate,
} from "../services/emailTemplates";
import crypto from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { TwilioService } from "../services/twilio";
import { authenticateToken } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const emailService = new EmailService();
const twilioService = new TwilioService();

// Register a new Tenant Admin
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { fullName, companyName, email, password } = req.body;

    if (!fullName || !companyName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Generate slug from company name
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    if (!slug) {
      return res.status(400).json({ error: "Invalid company name" });
    }

    // Check if tenant slug exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      return res.status(400).json({ error: "Company name already taken" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hour expiry

    // Transaction: Create Tenant and User
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug,
          plan: "STARTER",
          status: "ACTIVE",
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          name: fullName,
          password: hashedPassword,
          role: Role.TENANT_ADMIN,
          tenantId: tenant.id,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            fullName
          )}`,
          emailVerified: false,
          emailVerificationToken: verificationToken,
          verificationTokenExpiry: tokenExpiry,
        },
      });

      return { tenant, user };
    });

    // Send verification email
    try {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
      const emailTemplate = verificationEmailTemplate(
        fullName,
        verificationUrl
      );

      await emailService.sendHtmlEmail(
        email,
        emailTemplate.subject,
        emailTemplate.html
      );

      console.log(`Verification email sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail registration if email fails
    }

    // Generate JWT (user can still use the app, but some features may be limited)
    const token = jwt.sign(
      {
        userId: result.user.id,
        role: result.user.role,
        tenantId: result.tenant.id,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message:
        "Registration successful. Please check your email to verify your account.",
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        tenantId: result.tenant.id,
        emailVerified: false,
      },
      requiresVerification: true,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if email is verified for password-based accounts
    if (!user.emailVerified && user.password) {
      return res.status(403).json({
        error: "Please verify your email address before logging in",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Google OAuth Login/Signup
router.post("/google", async (req: Request, res: Response) => {
  try {
    const { credential, companyName } = req.body;

    if (!credential) {
      return res.status(400).json({ error: "Google credential is required" });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Invalid Google token" });
    }

    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists by email or googleId
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { googleId }],
      },
      include: { tenant: true },
    });

    if (user) {
      // Existing user - update googleId and verify email if not set
      if (!user.googleId || !user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            emailVerified: true, // Auto-verify email for Google users
          },
          include: { tenant: true },
        });
      }

      // Existing user - login
      const token = jwt.sign(
        { userId: user.id, role: user.role, tenantId: user.tenantId },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
      });
    }

    // New user - signup
    if (!companyName) {
      return res.status(400).json({
        error: "Company name is required for new users",
        requiresCompanyName: true,
      });
    }

    // Generate slug from company name
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    if (!slug) {
      return res.status(400).json({ error: "Invalid company name" });
    }

    // Check if tenant slug exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      return res.status(400).json({ error: "Company name already taken" });
    }

    // Transaction: Create Tenant and User
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug,
          plan: "STARTER",
          status: "ACTIVE",
        },
      });

      const newUser = await tx.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          password: null, // No password for OAuth users
          role: Role.TENANT_ADMIN,
          tenantId: tenant.id,
          googleId, // Store Google OAuth ID
          emailVerified: true, // OAuth users are auto-verified
          avatar:
            picture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              name || email
            )}`,
        },
      });

      return { tenant, user: newUser };
    });

    // Generate JWT
    const token = jwt.sign(
      {
        userId: result.user.id,
        role: result.user.role,
        tenantId: result.tenant.id,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        tenantId: result.tenant.id,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

// Link Google Account (for username/password users)
router.post(
  "/link-google",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { credential } = req.body;

      if (!credential) {
        // If no credential provided, return the Google OAuth URL
        const redirectUri = `${process.env.FRONTEND_URL}/auth/google-link-callback`;
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
          process.env.GOOGLE_CLIENT_ID
        }&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=email%20profile&access_type=offline&prompt=consent`;
        return res.json({ authUrl });
      }

      // Verify Google token
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).json({ error: "Invalid Google token" });
      }

      const { sub: googleId, email: googleEmail } = payload;

      // Get current user
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if this Google account is already linked to another user
      const existingGoogleUser = await prisma.user.findFirst({
        where: {
          googleId,
          NOT: { id: userId },
        },
      });

      if (existingGoogleUser) {
        return res.status(400).json({
          error: "This Google account is already linked to another user",
        });
      }

      // Check if email matches
      if (currentUser.email !== googleEmail) {
        return res.status(400).json({
          error: "Google account email must match your current email address",
        });
      }

      // Link Google account and verify email
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleId,
          emailVerified: true, // Auto-verify email when linking Google account
        },
      });

      res.json({
        message: "Google account linked successfully",
        googleId,
      });
    } catch (error) {
      console.error("Link Google account error:", error);
      res.status(500).json({ error: "Failed to link Google account" });
    }
  }
);

// Verify Email
router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Verification token is required" });
    }

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
      include: { tenant: true },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification token" });
    }

    // Check if token has expired
    if (
      user.verificationTokenExpiry &&
      new Date() > user.verificationTokenExpiry
    ) {
      return res.status(400).json({
        error: "Verification token has expired",
        code: "TOKEN_EXPIRED",
        email: user.email,
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.json({
        message: "Email already verified",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: true,
        },
      });
    }

    // Update user to verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    // Send welcome email
    try {
      const emailTemplate = welcomeEmailTemplate(
        user.name,
        user.tenant?.name || "your team"
      );
      await emailService.sendHtmlEmail(
        user.email,
        emailTemplate.subject,
        emailTemplate.html
      );
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    res.json({
      message: "Email verified successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Email verification failed" });
  }
});

// Resend Verification Email
router.post("/resend-verification", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        message:
          "If an account exists with this email, a verification email has been sent",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        verificationTokenExpiry: tokenExpiry,
      },
    });

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    const emailTemplate = verificationReminderTemplate(
      user.name,
      verificationUrl
    );

    await emailService.sendHtmlEmail(
      email,
      emailTemplate.subject,
      emailTemplate.html
    );

    res.json({
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

// ========================================
// PHONE VERIFICATION ROUTES (Level 2 Security)
// ========================================

// Send phone verification SMS
router.post("/send-phone-verification", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: "Email must be verified first",
        level: "email_required",
      });
    }

    if (!user.phoneNumber) {
      return res.status(400).json({ error: "Phone number not set" });
    }

    // Generate 6-digit OTP
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const codeExpiry = new Date();
    codeExpiry.setMinutes(codeExpiry.getMinutes() + 10); // 10 minute expiry

    await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCode: verificationCode,
        phoneVerificationExpiry: codeExpiry,
      },
    });

    // Send SMS
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || "";
    await twilioService.sendSMS(
      fromNumber,
      user.phoneNumber,
      `Your ConnectFlo verification code is: ${verificationCode}. Valid for 10 minutes.`
    );

    res.json({ message: "Verification code sent to your phone" });
  } catch (error) {
    console.error("Send phone verification error:", error);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// Verify phone number with SMS OTP
router.post("/verify-phone", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Verification code is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.phoneVerificationCode || !user.phoneVerificationExpiry) {
      return res.status(400).json({
        error: "No verification code found. Please request a new one.",
      });
    }

    if (new Date() > user.phoneVerificationExpiry) {
      return res.status(400).json({
        error: "Verification code expired. Please request a new one.",
      });
    }

    if (user.phoneVerificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Mark phone as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerified: true,
        phoneVerificationCode: null,
        phoneVerificationExpiry: null,
      },
    });

    res.json({
      message: "Phone number verified successfully",
      phoneVerified: true,
    });
  } catch (error) {
    console.error("Verify phone error:", error);
    res.status(500).json({ error: "Failed to verify phone number" });
  }
});

// ========================================
// MFA/TOTP ROUTES (Level 3 Security)
// ========================================

// Setup TOTP - Generate secret and QR code
router.post("/mfa/setup", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: "Email must be verified first",
        level: "email_required",
      });
    }

    if (!user.phoneVerified) {
      return res.status(403).json({
        error: "Phone must be verified first",
        level: "phone_required",
      });
    }

    if (user.mfaEnabled) {
      return res.status(400).json({ error: "MFA is already enabled" });
    }

    // Generate secret
    const secret = authenticator.generateSecret();
    const companyName = user.tenant?.name || "ConnectFlo";
    const otpauthUrl = authenticator.keyuri(user.email, companyName, secret);

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (not enabled until verified)
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: secret },
    });

    res.json({
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl,
    });
  } catch (error) {
    console.error("MFA setup error:", error);
    res.status(500).json({ error: "Failed to setup MFA" });
  }
});

// Verify TOTP setup and enable MFA
router.post("/mfa/verify-setup", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Verification code is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.mfaSecret) {
      return res.status(400).json({ error: "MFA setup not initiated" });
    }

    // Verify the TOTP code
    const isValid = authenticator.verify({
      token: code,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Generate backup codes (10 codes)
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase()
    );

    // Enable MFA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: backupCodes,
      },
    });

    res.json({
      message: "MFA enabled successfully",
      backupCodes, // Show these once - user must save them
      mfaEnabled: true,
    });
  } catch (error) {
    console.error("MFA verify setup error:", error);
    res.status(500).json({ error: "Failed to verify MFA setup" });
  }
});

// Verify TOTP code (for sensitive operations)
router.post("/mfa/verify", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Verification code is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({ error: "MFA not enabled" });
    }

    // Check if it's a backup code
    if (user.mfaBackupCodes.includes(code.toUpperCase())) {
      // Remove used backup code
      const updatedCodes = user.mfaBackupCodes.filter(
        (c) => c !== code.toUpperCase()
      );
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaBackupCodes: updatedCodes },
      });

      return res.json({
        verified: true,
        message: "Backup code accepted. Consider regenerating backup codes.",
      });
    }

    // Verify TOTP code
    const isValid = authenticator.verify({
      token: code,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    res.json({ verified: true });
  } catch (error) {
    console.error("MFA verify error:", error);
    res.status(500).json({ error: "Failed to verify MFA code" });
  }
});

// Disable MFA (requires current TOTP code)
router.post("/mfa/disable", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Verification code is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({ error: "MFA not enabled" });
    }

    // Verify TOTP code before disabling
    const isValid = authenticator.verify({
      token: code,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });

    res.json({
      message: "MFA disabled successfully",
      mfaEnabled: false,
    });
  } catch (error) {
    console.error("MFA disable error:", error);
    res.status(500).json({ error: "Failed to disable MFA" });
  }
});

export default router;
