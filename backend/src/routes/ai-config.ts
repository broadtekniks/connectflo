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

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
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

    const {
      name,
      toneOfVoice,
      businessDescription,
      systemPrompt,
      voiceId,
      speakingRate,
      handoffThreshold,
      autoEscalate,
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
      },
    });

    res.json(config);
  } catch (error) {
    console.error("Error updating AI config:", error);
    res.status(500).json({ error: "Failed to update AI config" });
  }
});

export default router;
