import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { CRMService } from "../services/crm";

const router = Router();

// Middleware: Only TENANT_ADMIN can manage CRM connections
router.use((req: Request, res: Response, next) => {
  const authReq = req as AuthRequest;
  if (authReq.user?.role !== "TENANT_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// Get all CRM connections for tenant
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const connections = await prisma.crmConnection.findMany({
      where: { tenantId: authReq.user?.tenantId },
      select: {
        id: true,
        crmType: true,
        name: true,
        status: true,
        lastSyncAt: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        // Don't return credentials
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(connections);
  } catch (error) {
    console.error("Failed to fetch CRM connections:", error);
    res.status(500).json({ error: "Failed to fetch CRM connections" });
  }
});

// Get a specific CRM connection
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const connection = await prisma.crmConnection.findFirst({
      where: {
        id: req.params.id,
        tenantId: authReq.user?.tenantId,
      },
      select: {
        id: true,
        crmType: true,
        name: true,
        config: true,
        status: true,
        lastSyncAt: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    res.json(connection);
  } catch (error) {
    console.error("Failed to fetch CRM connection:", error);
    res.status(500).json({ error: "Failed to fetch CRM connection" });
  }
});

// Create a new CRM connection
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { crmType, name, credentials, config } = req.body;

    if (!crmType || !credentials) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if connection already exists for this CRM type
    const existing = await prisma.crmConnection.findUnique({
      where: {
        tenantId_crmType: {
          tenantId: authReq.user!.tenantId!,
          crmType,
        },
      },
    });

    // Encrypt credentials
    const encryptedCredentials = CRMService.encryptCredentials(credentials);

    // Create connection (or reuse a disabled/error connection)
    const connection = existing
      ? await prisma.crmConnection.update({
          where: { id: existing.id },
          data: {
            name:
              name ||
              `${
                crmType.charAt(0).toUpperCase() + crmType.slice(1)
              } Connection`,
            credentials: encryptedCredentials,
            config: config || {},
            status: "active",
            errorMessage: null,
          },
        })
      : await prisma.crmConnection.create({
          data: {
            tenantId: authReq.user!.tenantId!,
            crmType,
            name:
              name ||
              `${
                crmType.charAt(0).toUpperCase() + crmType.slice(1)
              } Connection`,
            credentials: encryptedCredentials,
            config: config || {},
            status: "active",
          },
        });

    // Test connection
    const isValid = await CRMService.testConnection(connection.id);

    if (!isValid) {
      const updatedConnection = await prisma.crmConnection.findUnique({
        where: { id: connection.id },
      });
      return res.status(400).json({
        error: "Failed to connect to CRM",
        message: updatedConnection?.errorMessage,
      });
    }

    // Discover fields for all object types
    try {
      await Promise.all([
        CRMService.discoverAndStoreFields(connection.id, "contact"),
        CRMService.discoverAndStoreFields(connection.id, "company"),
        CRMService.discoverAndStoreFields(connection.id, "deal"),
      ]);
    } catch (error) {
      console.error("Failed to discover fields:", error);
      // Don't fail the connection, just log the error
    }

    res.json({
      id: connection.id,
      crmType: connection.crmType,
      name: connection.name,
      status: connection.status,
      createdAt: connection.createdAt,
    });
  } catch (error: any) {
    console.error("Failed to create CRM connection:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to create CRM connection" });
  }
});

// Update CRM connection credentials
router.put(
  "/:id/credentials",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const { credentials } = req.body;

      if (!credentials) {
        return res.status(400).json({ error: "Missing credentials" });
      }

      // Verify ownership
      const connection = await prisma.crmConnection.findFirst({
        where: {
          id: req.params.id,
          tenantId: authReq.user?.tenantId,
        },
      });

      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Encrypt new credentials
      const encryptedCredentials = CRMService.encryptCredentials(credentials);

      // Update connection
      await prisma.crmConnection.update({
        where: { id: req.params.id },
        data: {
          credentials: encryptedCredentials,
          status: "active",
          errorMessage: null,
        },
      });

      // Test new connection
      const isValid = await CRMService.testConnection(req.params.id);

      if (!isValid) {
        const updatedConnection = await prisma.crmConnection.findUnique({
          where: { id: req.params.id },
        });
        return res.status(400).json({
          error: "Failed to connect with new credentials",
          message: updatedConnection?.errorMessage,
        });
      }

      // Re-discover fields
      try {
        await Promise.all([
          CRMService.discoverAndStoreFields(req.params.id, "contact"),
          CRMService.discoverAndStoreFields(req.params.id, "company"),
          CRMService.discoverAndStoreFields(req.params.id, "deal"),
        ]);
      } catch (error) {
        console.error("Failed to re-discover fields:", error);
      }

      res.json({ success: true, message: "Credentials updated successfully" });
    } catch (error: any) {
      console.error("Failed to update credentials:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to update credentials" });
    }
  }
);

// Test CRM connection
router.post(
  "/:id/test",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const connection = await prisma.crmConnection.findFirst({
        where: {
          id: req.params.id,
          tenantId: authReq.user?.tenantId,
        },
      });

      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      const isValid = await CRMService.testConnection(req.params.id);

      const updatedConnection = await prisma.crmConnection.findUnique({
        where: { id: req.params.id },
      });

      res.json({
        success: isValid,
        status: updatedConnection?.status,
        errorMessage: updatedConnection?.errorMessage,
      });
    } catch (error: any) {
      console.error("Failed to test connection:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to test connection" });
    }
  }
);

// Disconnect (delete) CRM connection
router.delete(
  "/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const connection = await prisma.crmConnection.findFirst({
        where: {
          id: req.params.id,
          tenantId: authReq.user?.tenantId,
        },
      });

      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      // Prefer a soft-disconnect so this always works even if the DB doesn't
      // have cascade rules applied as expected.
      // Also keeps sync history tables consistent with the UI confirmation.
      await prisma.$transaction([
        prisma.crmDiscoveredField.deleteMany({
          where: { connectionId: req.params.id },
        }),
        prisma.crmFieldMapping.deleteMany({
          where: { connectionId: req.params.id },
        }),
        prisma.crmSyncRecord.deleteMany({
          where: { connectionId: req.params.id },
        }),
        prisma.crmSyncJob.deleteMany({
          where: { connectionId: req.params.id },
        }),
        prisma.crmWebhookSubscription.deleteMany({
          where: { connectionId: req.params.id },
        }),
        prisma.crmConnection.update({
          where: { id: req.params.id },
          data: {
            status: "disabled",
            errorMessage: null,
            lastSyncAt: null,
          },
        }),
      ]);

      res.json({
        success: true,
        message: "CRM disconnected successfully",
      });
    } catch (error) {
      console.error("Failed to delete CRM connection:", error);
      res.status(500).json({ error: "Failed to delete CRM connection" });
    }
  }
);

// Get discovered fields for a connection
router.get(
  "/:id/fields",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const connection = await prisma.crmConnection.findFirst({
        where: {
          id: req.params.id,
          tenantId: authReq.user?.tenantId,
        },
      });

      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      const objectType = req.query.objectType as
        | "contact"
        | "company"
        | "deal"
        | "activity"
        | undefined;

      const fields = await CRMService.getDiscoveredFields(
        req.params.id,
        objectType
      );

      res.json(fields);
    } catch (error) {
      console.error("Failed to fetch discovered fields:", error);
      res.status(500).json({ error: "Failed to fetch discovered fields" });
    }
  }
);

// Manually trigger field discovery
router.post(
  "/:id/discover-fields",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      const connection = await prisma.crmConnection.findFirst({
        where: {
          id: req.params.id,
          tenantId: authReq.user?.tenantId,
        },
      });

      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      await Promise.all([
        CRMService.discoverAndStoreFields(req.params.id, "contact"),
        CRMService.discoverAndStoreFields(req.params.id, "company"),
        CRMService.discoverAndStoreFields(req.params.id, "deal"),
      ]);

      res.json({ success: true, message: "Fields discovered successfully" });
    } catch (error: any) {
      console.error("Failed to discover fields:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to discover fields" });
    }
  }
);

export default router;
