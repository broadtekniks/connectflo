import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

// Get AI Config for a tenant
router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify tenant exists. Only select id to avoid failing if the database
    // schema is temporarily behind the Prisma schema (missing unrelated columns).
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    let config = await prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      // Create default config if it doesn't exist
      config = await prisma.aiConfig.create({
        data: {
          tenantId,
          name: "Flo",
          toneOfVoice: "Friendly & Casual",
          systemPrompt:
            "You are Flo, a helpful and friendly customer support assistant for ConnectFlo. You answer questions concisely and escalate to a human if the customer seems angry.",
          voiceId: "alloy",
          speakingRate: 1.0,
          handoffThreshold: 0.7,
          autoEscalate: true,
        },
      });
    }

    res.json(config);
  } catch (error) {
    console.error("Error fetching AI config:", error);
    res.status(500).json({ error: "Failed to fetch AI config" });
  }
});

// Update AI Config
router.put("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify tenant exists (handles stale tokens after DB reset). Only select id
    // to avoid failing if the DB is missing newer Tenant columns.
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      return res
        .status(404)
        .json({ error: "Tenant not found. Please log in again." });
    }

    const {
      name,
      toneOfVoice,
      businessDescription,
      systemPrompt,
      voiceId,
      speakingRate,
      handoffThreshold,
      autoEscalate,
      intents,
    } = req.body;

    const config = await prisma.aiConfig.upsert({
      where: { tenantId },
      update: {
        name,
        toneOfVoice,
        businessDescription,
        systemPrompt,
        voiceId,
        speakingRate,
        handoffThreshold,
        autoEscalate,
        intents,
      },
      create: {
        tenantId,
        name,
        toneOfVoice,
        businessDescription,
        systemPrompt,
        voiceId,
        speakingRate,
        handoffThreshold,
        autoEscalate,
        intents,
      },
    });

    res.json(config);
  } catch (error) {
    console.error("Error updating AI config:", error);
    // Prisma FK constraint error (typically stale tenantId)
    if ((error as any)?.code === "P2003") {
      return res
        .status(404)
        .json({ error: "Tenant not found. Please log in again." });
    }
    res.status(500).json({ error: "Failed to update AI config" });
  }
});

// Get intents for a tenant
router.get("/intents", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify tenant exists (handles stale tokens after DB reset). Only select id
    // to avoid failing if the DB is missing newer Tenant columns.
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      return res
        .status(404)
        .json({ error: "Tenant not found. Please log in again." });
    }

    const config = await prisma.aiConfig.findUnique({
      where: { tenantId },
      select: { intents: true },
    });

    // Default intents if none configured
    const defaultIntents = [
      {
        id: "greeting",
        name: "Greeting",
        description: "Customer is greeting or saying hello",
        keywords: ["hello", "hi", "hey", "good morning", "good afternoon"],
        enabled: true,
      },
      {
        id: "question",
        name: "Question",
        description: "Customer is asking a question",
        keywords: ["what", "how", "when", "where", "why", "can you"],
        enabled: true,
      },
      {
        id: "complaint",
        name: "Complaint",
        description: "Customer is expressing dissatisfaction",
        keywords: ["issue", "problem", "broken", "not working", "complaint"],
        enabled: true,
      },
      {
        id: "request_human",
        name: "Request Human",
        description: "Customer wants to speak with a human agent",
        keywords: [
          "human",
          "agent",
          "representative",
          "person",
          "speak to someone",
        ],
        enabled: true,
      },
      {
        id: "cancel_order",
        name: "Cancel Order",
        description: "Customer wants to cancel an order",
        keywords: ["cancel", "cancellation", "refund", "return"],
        enabled: false,
      },
      {
        id: "track_order",
        name: "Track Order",
        description: "Customer wants to track their order",
        keywords: ["track", "tracking", "where is", "status", "delivery"],
        enabled: false,
      },
    ];

    res.json({
      intents: config?.intents || defaultIntents,
    });
  } catch (error) {
    console.error("Error fetching intents:", error);
    res.status(500).json({ error: "Failed to fetch intents" });
  }
});

// Update intents for a tenant
router.put("/intents", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify tenant exists (handles stale tokens after DB reset)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res
        .status(404)
        .json({ error: "Tenant not found. Please log in again." });
    }

    const { intents } = req.body;

    if (!Array.isArray(intents)) {
      return res.status(400).json({ error: "Intents must be an array" });
    }

    const config = await prisma.aiConfig.upsert({
      where: { tenantId },
      update: {
        intents,
      },
      create: {
        tenantId,
        intents,
      },
    });

    res.json({ intents: config.intents });
  } catch (error) {
    console.error("Error updating intents:", error);
    // Prisma FK constraint error (typically stale tenantId)
    if ((error as any)?.code === "P2003") {
      return res
        .status(404)
        .json({ error: "Tenant not found. Please log in again." });
    }
    res.status(500).json({ error: "Failed to update intents" });
  }
});

export default router;
