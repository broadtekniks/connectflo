import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (role !== "TENANT_ADMIN" && role !== "AGENT") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const customers = await prisma.user.findMany({
      where: {
        tenantId,
        role: "CUSTOMER",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    res.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

export default router;
