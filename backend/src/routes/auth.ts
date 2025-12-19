import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

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
        },
      });

      return { tenant, user };
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
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
