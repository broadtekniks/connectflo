import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Get all tenants
router.get("/", async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// Create a new tenant
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, plan, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        plan: plan || "STARTER",
        status: status || "ACTIVE",
      },
    });

    res.status(201).json(tenant);
  } catch (error) {
    console.error("Error creating tenant:", error);
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

// Update tenant plan
router.patch("/:id/plan", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ error: "Plan name is required" });
    }

    // Verify plan exists
    const planExists = await prisma.plan.findUnique({
      where: { name: plan },
    });

    if (!planExists) {
      return res.status(400).json({ error: "Invalid plan name" });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { plan },
    });

    res.json(tenant);
  } catch (error) {
    console.error("Error updating tenant plan:", error);
    res.status(500).json({ error: "Failed to update tenant plan" });
  }
});

// Get single tenant
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});

// Update a tenant
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, plan, status } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name,
        plan,
        status,
      },
    });

    res.json(tenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// Delete a tenant
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.tenant.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting tenant:", error);
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

// Create a test customer for a tenant
router.post("/test-customer", async (req: Request, res: Response) => {
  try {
    // In a real app, we would get the tenantId from the authenticated user's session
    // For now, we'll expect it in the body or use a default if testing locally
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const email = `test-customer-${tenant.slug}@example.com`;

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash("password", 10);
      user = await prisma.user.create({
        data: {
          email,
          name: "Test Customer",
          password: hashedPassword,
          role: Role.CUSTOMER,
          tenantId: tenant.id,
          avatar: `https://ui-avatars.com/api/?name=Test+Customer`,
        },
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      user,
      token,
    });
  } catch (error) {
    console.error("Error creating test customer:", error);
    res.status(500).json({ error: "Failed to create test customer" });
  }
});

export default router;
