import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// Get all resources assigned to a workflow
router.get(
  "/:id/resources",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const workflowId = req.params.id;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          aiConfig: true,
          phoneNumbers: {
            include: { phoneNumber: true },
          },
          documents: {
            include: { document: true },
          },
          integrations: {
            include: { integration: true },
          },
        },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      res.json({
        aiConfig: workflow.aiConfig,
        phoneNumbers: workflow.phoneNumbers.map((wp) => wp.phoneNumber),
        documents: workflow.documents.map((wd) => wd.document),
        integrations: workflow.integrations.map((wi) => wi.integration),
        phoneVoiceId: workflow.phoneVoiceId,
        phoneVoiceLanguage: workflow.phoneVoiceLanguage,
        toneOfVoice: (workflow as any).toneOfVoice ?? null,
      });
    } catch (error) {
      console.error("Error fetching workflow resources:", error);
      res.status(500).json({ error: "Failed to fetch resources" });
    }
  }
);

// Update workflow-level tone of voice override
router.put(
  "/:id/tone-of-voice",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const workflowId = req.params.id;
    const toneOfVoice =
      typeof req.body?.toneOfVoice === "string" ? req.body.toneOfVoice : "";

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updated = await prisma.workflow.update({
        where: { id: workflowId },
        data: {
          toneOfVoice: toneOfVoice.trim() ? toneOfVoice.trim() : null,
        },
        select: { id: true, toneOfVoice: true },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating workflow tone of voice override:", error);
      res.status(500).json({ error: "Failed to update tone of voice" });
    }
  }
);

// Remove workflow-level tone of voice override
router.delete(
  "/:id/tone-of-voice",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const workflowId = req.params.id;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updated = await prisma.workflow.update({
        where: { id: workflowId },
        data: { toneOfVoice: null },
        select: { id: true, toneOfVoice: true },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error removing workflow tone of voice override:", error);
      res.status(500).json({ error: "Failed to remove tone of voice" });
    }
  }
);

// Update workflow-level phone voice override
router.put(
  "/:id/phone-voice",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const workflowId = req.params.id;
    const phoneVoiceId =
      typeof req.body?.phoneVoiceId === "string" ? req.body.phoneVoiceId : "";
    const phoneVoiceLanguage =
      typeof req.body?.phoneVoiceLanguage === "string"
        ? req.body.phoneVoiceLanguage
        : "";

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updated = await prisma.workflow.update({
        where: { id: workflowId },
        data: {
          phoneVoiceId: phoneVoiceId.trim() ? phoneVoiceId.trim() : null,
          phoneVoiceLanguage: phoneVoiceLanguage.trim()
            ? phoneVoiceLanguage.trim()
            : null,
        },
        select: { id: true, phoneVoiceId: true, phoneVoiceLanguage: true },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating workflow phone voice override:", error);
      res.status(500).json({ error: "Failed to update phone voice" });
    }
  }
);

// Remove workflow-level phone voice override
router.delete(
  "/:id/phone-voice",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const workflowId = req.params.id;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updated = await prisma.workflow.update({
        where: { id: workflowId },
        data: { phoneVoiceId: null, phoneVoiceLanguage: null },
        select: { id: true, phoneVoiceId: true, phoneVoiceLanguage: true },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error removing workflow phone voice override:", error);
      res.status(500).json({ error: "Failed to remove phone voice" });
    }
  }
);

// Assign a phone number to a workflow
router.post(
  "/:id/phone-numbers/:phoneNumberId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id: workflowId, phoneNumberId } = req.params;

    try {
      // 1. Verify workflow ownership
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          phoneNumbers: true,
        },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // 2. Get tenant's plan limits
      const tenant = await prisma.tenant.findUnique({
        where: { id: authReq.user?.tenantId },
      });

      let maxPhoneNumbers = 2;
      if (tenant?.plan) {
        const planDetails = await prisma.plan.findUnique({
          where: { name: tenant.plan },
        });
        if (planDetails) {
          maxPhoneNumbers = planDetails.maxPhoneNumbersPerWorkflow;
        }
      }

      // 3. Check limit
      const currentCount = workflow.phoneNumbers.length;
      if (currentCount >= maxPhoneNumbers) {
        return res.status(400).json({
          error: `Plan limit reached. Your plan allows ${maxPhoneNumbers} phone numbers per workflow.`,
        });
      }

      // 4. Verify phone number ownership
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: {
          id: phoneNumberId,
          tenantId: authReq.user?.tenantId,
        },
      });

      if (!phoneNumber) {
        return res.status(404).json({ error: "Phone number not found" });
      }

      // 5. Check if already assigned
      const existing = await prisma.workflowPhoneNumber.findUnique({
        where: {
          workflowId_phoneNumberId: {
            workflowId,
            phoneNumberId,
          },
        },
      });

      if (existing) {
        return res
          .status(400)
          .json({ error: "Phone number already assigned to this workflow" });
      }

      // 6. Create assignment
      const assignment = await prisma.workflowPhoneNumber.create({
        data: {
          workflowId,
          phoneNumberId,
        },
        include: {
          phoneNumber: true,
        },
      });

      res.json(assignment);
    } catch (error) {
      console.error("Error assigning phone number:", error);
      res.status(500).json({ error: "Failed to assign phone number" });
    }
  }
);

// Remove phone number from workflow
router.delete(
  "/:id/phone-numbers/:phoneNumberId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id: workflowId, phoneNumberId } = req.params;

    try {
      // Verify workflow ownership
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Delete assignment
      await prisma.workflowPhoneNumber.delete({
        where: {
          workflowId_phoneNumberId: {
            workflowId,
            phoneNumberId,
          },
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing phone number:", error);
      res.status(500).json({ error: "Failed to remove phone number" });
    }
  }
);

// Assign a document to a workflow
router.post(
  "/:id/documents/:documentId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id: workflowId, documentId } = req.params;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          documents: true,
        },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Get tenant's plan limits
      const tenant = await prisma.tenant.findUnique({
        where: { id: authReq.user?.tenantId },
      });

      let maxDocuments = 10;
      if (tenant?.plan) {
        const planDetails = await prisma.plan.findUnique({
          where: { name: tenant.plan },
        });
        if (planDetails) {
          maxDocuments = planDetails.maxDocumentsPerWorkflow;
        }
      }

      const currentCount = workflow.documents.length;
      if (currentCount >= maxDocuments) {
        return res.status(400).json({
          error: `Plan limit reached. Your plan allows ${maxDocuments} documents per workflow.`,
        });
      }

      // Verify document ownership
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          tenantId: authReq.user?.tenantId,
        },
      });

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Check if already assigned
      const existing = await prisma.workflowDocument.findUnique({
        where: {
          workflowId_documentId: {
            workflowId,
            documentId,
          },
        },
      });

      if (existing) {
        return res
          .status(400)
          .json({ error: "Document already assigned to this workflow" });
      }

      // Create assignment
      const assignment = await prisma.workflowDocument.create({
        data: {
          workflowId,
          documentId,
        },
        include: {
          document: true,
        },
      });

      res.json(assignment);
    } catch (error) {
      console.error("Error assigning document:", error);
      res.status(500).json({ error: "Failed to assign document" });
    }
  }
);

// Remove document from workflow
router.delete(
  "/:id/documents/:documentId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id: workflowId, documentId } = req.params;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await prisma.workflowDocument.delete({
        where: {
          workflowId_documentId: {
            workflowId,
            documentId,
          },
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing document:", error);
      res.status(500).json({ error: "Failed to remove document" });
    }
  }
);

// Assign an integration to a workflow
router.post(
  "/:id/integrations/:integrationId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id: workflowId, integrationId } = req.params;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          integrations: true,
        },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Get tenant's plan limits
      const tenant = await prisma.tenant.findUnique({
        where: { id: authReq.user?.tenantId },
      });

      let maxIntegrations = 3;
      if (tenant?.plan) {
        const planDetails = await prisma.plan.findUnique({
          where: { name: tenant.plan },
        });
        if (planDetails) {
          maxIntegrations = planDetails.maxIntegrationsPerWorkflow;
        }
      }

      const currentCount = workflow.integrations.length;
      if (currentCount >= maxIntegrations) {
        return res.status(400).json({
          error: `Plan limit reached. Your plan allows ${maxIntegrations} integrations per workflow.`,
        });
      }

      // Verify integration ownership
      const integration = await prisma.integration.findFirst({
        where: {
          id: integrationId,
          tenantId: authReq.user?.tenantId,
        },
      });

      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }

      // Check if already assigned
      const existing = await prisma.workflowIntegration.findUnique({
        where: {
          workflowId_integrationId: {
            workflowId,
            integrationId,
          },
        },
      });

      if (existing) {
        return res
          .status(400)
          .json({ error: "Integration already assigned to this workflow" });
      }

      // Create assignment
      const assignment = await prisma.workflowIntegration.create({
        data: {
          workflowId,
          integrationId,
        },
        include: {
          integration: true,
        },
      });

      res.json(assignment);
    } catch (error) {
      console.error("Error assigning integration:", error);
      res.status(500).json({ error: "Failed to assign integration" });
    }
  }
);

// Remove integration from workflow
router.delete(
  "/:id/integrations/:integrationId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id: workflowId, integrationId } = req.params;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await prisma.workflowIntegration.delete({
        where: {
          workflowId_integrationId: {
            workflowId,
            integrationId,
          },
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing integration:", error);
      res.status(500).json({ error: "Failed to remove integration" });
    }
  }
);

// Update workflow AI config
router.put(
  "/:id/ai-config/:aiConfigId",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const { id: workflowId, aiConfigId } = req.params;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Verify AI config ownership
      const aiConfig = await prisma.aiConfig.findFirst({
        where: {
          id: aiConfigId,
          tenantId: authReq.user?.tenantId,
        },
      });

      if (!aiConfig) {
        return res.status(404).json({ error: "AI config not found" });
      }

      // Update workflow
      const updated = await prisma.workflow.update({
        where: { id: workflowId },
        data: { aiConfigId },
        include: { aiConfig: true },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating AI config:", error);
      res.status(500).json({ error: "Failed to update AI config" });
    }
  }
);

// Remove AI config from workflow
router.delete(
  "/:id/ai-config",
  authenticateToken,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const workflowId = req.params.id;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || workflow.tenantId !== authReq.user?.tenantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updated = await (prisma.workflow as any).update({
        where: { id: workflowId },
        data: { aiConfigId: null },
      });
      res.json(updated);
    } catch (error) {
      console.error("Error removing AI config:", error);
      res.status(500).json({ error: "Failed to remove AI config" });
    }
  }
);

export default router;
