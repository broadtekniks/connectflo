import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

type TeamMemberResponseRow = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  tenantId: string | null;
  createdAt: Date;
  isCheckedIn: boolean;
  checkedInAt: Date | null;
};

router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;

  try {
    const tenantId = authReq.user?.tenantId as string | undefined;
    const role = authReq.user?.role as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // UI restricts this page to TENANT_ADMIN; enforce here too.
    if (role !== "TENANT_ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const members = (await prisma.user.findMany({
      where: {
        tenantId,
        role: {
          in: ["TENANT_ADMIN", "AGENT"],
        },
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
        isCheckedIn: true,
        checkedInAt: true,
      } as any,
    })) as unknown as TeamMemberResponseRow[];

    res.json(
      members.map((m) => ({
        ...m,
        checkedInAt: m.checkedInAt ? m.checkedInAt.toISOString() : null,
      }))
    );
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

export default router;
