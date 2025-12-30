import { Router } from "express";
import { hybridVoiceService } from "../services/hybridVoice";
import { TelnyxService } from "../services/telnyx";
import prisma from "../lib/prisma";

const router = Router();
const telnyxService = new TelnyxService();

/**
 * GET /api/voice-config/voices
 * Get list of available TTS voices
 */
router.get("/voices", (req, res) => {
  const voices = hybridVoiceService.getAvailableVoices();
  res.json({ voices });
});

/**
 * POST /api/voice-config/preference
 * Set voice preference for a tenant
 * Body: { tenantId, voice, language }
 */
router.post("/preference", async (req, res) => {
  const { tenantId, voice, language = "en-US" } = req.body;

  console.log(
    `[VoiceConfig] Setting preference - tenantId: ${tenantId}, voice: ${voice}, language: ${language}`
  );

  if (!tenantId || !voice) {
    return res.status(400).json({ error: "tenantId and voice are required" });
  }

  // Validate voice exists
  const availableVoices = hybridVoiceService.getAvailableVoices();
  const voiceExists = availableVoices.some((v) => v.id === voice);

  if (!voiceExists) {
    return res.status(400).json({
      error: "Invalid voice ID",
      availableVoices: availableVoices.map((v) => v.id),
    });
  }

  // Persist to DB so it survives restarts
  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { phoneVoiceId: voice, phoneVoiceLanguage: language },
    });
  } catch (error) {
    return res.status(404).json({
      error: "Tenant not found",
      tenantId,
    });
  }

  // Also cache in-memory for fast access
  hybridVoiceService.setVoicePreference(tenantId, voice, language);

  res.json({
    success: true,
    preference: { tenantId, voice, language },
  });
});

/**
 * GET /api/voice-config/preference/:tenantId
 * Get current voice preference for a tenant
 */
router.get("/preference/:tenantId", async (req, res) => {
  const { tenantId } = req.params;
  const preference = await hybridVoiceService.getVoicePreference(tenantId);
  res.json({ tenantId, preference });
});

/**
 * POST /api/voice-config/test
 * Test a voice by making a test call (or speaking on an active call)
 * Body: { phoneNumber, voice, language, testMessage }
 */
router.post("/test", async (req, res) => {
  const {
    phoneNumber,
    voice = "female",
    language = "en-US",
    testMessage = "Hello! This is a voice test. Thank you for trying out different voices.",
  } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      error: "phoneNumber is required for voice testing",
    });
  }

  try {
    // Validate voice exists
    const availableVoices = hybridVoiceService.getAvailableVoices();
    const voiceInfo = availableVoices.find((v) => v.id === voice);

    if (!voiceInfo) {
      return res.status(400).json({
        error: "Invalid voice ID",
        availableVoices: availableVoices.map((v) => v.id),
      });
    }

    // NOTE: Making outbound test calls requires additional Telnyx setup
    // For now, we validate the configuration and provide instructions
    res.json({
      success: true,
      message:
        "Voice configuration validated. Call your ConnectFlo number to hear this voice.",
      voice: voiceInfo,
      phoneNumber,
      language,
      note: "When you call your ConnectFlo number, this voice will be used automatically.",
    });
  } catch (error: any) {
    console.error("[VoiceConfig] Test validation failed:", error);
    res.status(500).json({
      error: "Failed to validate voice configuration",
      details: error.message,
    });
  }
});

/**
 * POST /api/voice-config/test-preview
 * Generate a preview URL or text description of a voice
 * (This is a simplified version - you could integrate with actual voice samples)
 * Body: { voice, language }
 */
router.post("/test-preview", (req, res) => {
  const { voice, language = "en-US" } = req.body;

  if (!voice) {
    return res.status(400).json({ error: "voice is required" });
  }

  const availableVoices = hybridVoiceService.getAvailableVoices();
  const voiceInfo = availableVoices.find((v) => v.id === voice);

  if (!voiceInfo) {
    return res.status(400).json({
      error: "Invalid voice ID",
      availableVoices: availableVoices.map((v) => v.id),
    });
  }

  res.json({
    success: true,
    voice: voiceInfo,
    previewText: `This is a ${voiceInfo.name} speaking. ${voiceInfo.description}`,
    note: "Use POST /api/voice-config/test with a phone number to hear the actual voice",
  });
});

export default router;
