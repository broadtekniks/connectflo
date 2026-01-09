import express from "express";
import { ExtensionDirectory } from "../services/extensionDirectory";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { Server } from "socket.io";

const router = express.Router();

/**
 * GET /api/extensions
 * List all extensions for the authenticated user's tenant
 */
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const extensions = await ExtensionDirectory.listExtensions(tenantId);

    res.json({
      success: true,
      extensions: extensions.map((ext) => ({
        userId: ext.id,
        name: ext.name,
        email: ext.email,
        extension: ext.extension,
        label: ext.extensionLabel,
        forwardingNumber: (ext as any).extensionForwardingNumber,
        status: ext.webPhoneStatus,
        lastSeen: ext.webPhoneLastSeen,
      })),
    });
  } catch (error: any) {
    console.error("Error listing extensions:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to list extensions",
    });
  }
});

/**
 * POST /api/extensions/assign
 * Assign extension to a user
 */
router.post("/assign", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId, extension, label, forwardingNumber } = req.body;
    const tenantId = req.user!.tenantId;

    // Validate required fields
    if (!userId || !extension) {
      return res.status(400).json({
        success: false,
        error: "userId and extension are required",
      });
    }

    // Verify user belongs to same tenant
    const prisma = (await import("../lib/prisma")).default;
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });

    if (!targetUser || targetUser.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: "User not found or access denied",
      });
    }

    await ExtensionDirectory.assignExtension(
      userId,
      tenantId,
      extension,
      label,
      forwardingNumber
    );

    res.json({
      success: true,
      message: `Extension ${extension} assigned successfully`,
    });
  } catch (error: any) {
    console.error("Error assigning extension:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to assign extension",
    });
  }
});

/**
 * DELETE /api/extensions/:userId
 * Remove extension from a user
 */
router.delete("/:userId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify user belongs to same tenant
    const prisma = (await import("../lib/prisma")).default;
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });

    if (!targetUser || targetUser.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: "User not found or access denied",
      });
    }

    await ExtensionDirectory.removeExtension(userId);

    res.json({
      success: true,
      message: "Extension removed successfully",
    });
  } catch (error: any) {
    console.error("Error removing extension:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to remove extension",
    });
  }
});

/**
 * GET /api/extensions/lookup/:extension
 * Lookup extension availability
 */
router.get(
  "/lookup/:extension",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { extension } = req.params;
      const tenantId = req.user!.tenantId;

      // Validate extension format
      if (!/^\d{3,4}$/.test(extension)) {
        return res.status(400).json({
          success: false,
          error: "Extension must be 3-4 digits",
        });
      }

      const user = await ExtensionDirectory.findByExtension(
        tenantId,
        extension
      );

      if (user) {
        res.json({
          success: true,
          available: false,
          assignedTo: {
            userId: user.id,
            name: user.name,
            label: user.extensionLabel,
          },
        });
      } else {
        res.json({
          success: true,
          available: true,
        });
      }
    } catch (error: any) {
      console.error("Error looking up extension:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to lookup extension",
      });
    }
  }
);

/**
 * GET /api/extensions/next-available
 * Get next available extension number
 */
router.get(
  "/next-available",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const startFrom = parseInt(req.query.startFrom as string) || 101;

      const nextExtension = await ExtensionDirectory.getNextAvailableExtension(
        tenantId,
        startFrom
      );

      res.json({
        success: true,
        extension: nextExtension,
      });
    } catch (error: any) {
      console.error("Error getting next extension:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get next available extension",
      });
    }
  }
);

/**
 * POST /api/extensions/presence
 * Update web phone presence status
 */
router.post("/presence", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;

    // Validate user is authenticated (JWT payload may use `id` or `userId`)
    const resolvedUserId = (req.user as any)?.id ?? (req.user as any)?.userId;
    if (!req.user || !resolvedUserId) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }

    const userId = String(resolvedUserId);
    const tenantId = req.user.tenantId;

    const validStatuses = ["ONLINE", "BUSY", "AWAY", "OFFLINE"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status. Must be one of: " + validStatuses.join(", "),
      });
    }

    await ExtensionDirectory.updatePresence(userId, status);

    const prisma = (await import("../lib/prisma")).default;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { webPhoneLastSeen: true },
    });

    // Emit WebSocket event to notify all clients in tenant
    const io = (req.app.get("io") as Server | undefined) ?? undefined;
    io?.to(`tenant:${tenantId}`).emit("extension_presence_updated", {
      userId,
      tenantId,
      status,
      lastSeen: user?.webPhoneLastSeen
        ? user.webPhoneLastSeen.toISOString()
        : null,
    });

    res.json({
      success: true,
      message: "Presence updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating presence:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update presence",
    });
  }
});

export default router;
