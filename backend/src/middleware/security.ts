import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

/**
 * Security Level 1: Email Verification Required
 * Basic authentication - user must have verified email
 */
export const requireEmailVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
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
        error: "Email verification required",
        level: "email_required",
        securityLevel: 1,
      });
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    console.error("Email verification check error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Security Level 2: Phone Verification Required
 * Required for voice features - user must have verified phone
 */
export const requirePhoneVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
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
        error: "Email verification required first",
        level: "email_required",
        securityLevel: 1,
      });
    }

    if (!user.phoneVerified) {
      return res.status(403).json({
        error: "Phone verification required for voice features",
        level: "phone_required",
        securityLevel: 2,
        message: "Please verify your phone number to access voice features",
      });
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    console.error("Phone verification check error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Security Level 3: MFA/TOTP Encouraged
 * Logs when MFA is not enabled but doesn't block access
 * Used to track and encourage MFA adoption for sensitive operations
 */
export const encourageMFA = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
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
        error: "Email verification required first",
        level: "email_required",
        securityLevel: 1,
      });
    }

    if (!user.phoneVerified) {
      return res.status(403).json({
        error: "Phone verification required first",
        level: "phone_required",
        securityLevel: 2,
      });
    }

    // Log if MFA is not enabled but allow access
    if (!user.mfaEnabled) {
      console.log(
        `[Security] User ${user.id} (${user.email}) accessed sensitive operation without MFA`
      );
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    console.error("MFA check error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Deprecated: Use encourageMFA instead
// Kept for backward compatibility
export const requireMFA = encourageMFA;

/**
 * Get user security status
 * Helper to check which security levels a user has completed
 */
export const getSecurityStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      emailVerified: true,
      phoneVerified: true,
      phoneNumber: true,
      mfaEnabled: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    level1_emailVerified: user.emailVerified,
    level2_phoneVerified: user.phoneVerified,
    level3_mfaEnabled: user.mfaEnabled,
    hasPhoneNumber: !!user.phoneNumber,
    currentLevel: user.mfaEnabled
      ? 3
      : user.phoneVerified
      ? 2
      : user.emailVerified
      ? 1
      : 0,
    canAccessVoice: user.emailVerified && user.phoneVerified,
    canAccessBilling: user.emailVerified && user.phoneVerified,
    canAccessAdmin: user.emailVerified && user.phoneVerified,
    mfaRecommended: !user.mfaEnabled, // Flag to show MFA recommendation
  };
};
