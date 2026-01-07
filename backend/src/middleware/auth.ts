import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as any;

    // Normalize JWT payload shape across the app.
    // Some tokens use `userId`, while some code expects `id`.
    const normalized = { ...verified } as any;
    if (!normalized.id && normalized.userId) normalized.id = normalized.userId;
    if (!normalized.userId && normalized.id) normalized.userId = normalized.id;

    req.user = normalized;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid token" });
  }
};
