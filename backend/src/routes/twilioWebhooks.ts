import { Router, Request, Response } from "express";
import { Server as WebSocketServer } from "ws";
import { URL } from "url";
import prisma from "../lib/prisma";
import { twilioRealtimeVoiceService } from "../services/twilioRealtimeVoice";
import { hybridVoiceService } from "../services/hybridVoice";
import { applyToneOfVoiceToSystemPrompt } from "../services/ai/toneOfVoice";

const router = Router();

function normalizeTwilioSayText(raw: string): string {
  // TwiML <Say> is plain text; preserve the full configured message.
  // Only normalize whitespace and apply a generous safety cap.
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Twilio can speak longer messages, but keep a hard cap to avoid extreme payloads.
  const maxChars = 2000;
  return text.length > maxChars ? text.slice(0, maxChars).trim() : text;
}

function escapeXml(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function deriveOpenAIVoiceFromPhoneVoiceId(
  phoneVoiceId: string
): "alloy" | "echo" | "shimmer" {
  const id = (phoneVoiceId || "").toLowerCase();
  // Best-effort mapping from our system voice IDs (female/male/Polly.*)
  // to OpenAI Realtime voice names.
  if (
    id.includes("male") ||
    id.includes("matthew") ||
    id.includes("brian") ||
    id.includes("russell")
  ) {
    return "echo";
  }
  if (
    id.includes("female") ||
    id.includes("joanna") ||
    id.includes("amy") ||
    id.includes("emma") ||
    id.includes("nicole")
  ) {
    return "shimmer";
  }
  return "alloy";
}

function deriveAccentInstruction(options: {
  phoneVoiceId?: string;
  language?: string;
}): string {
  const id = (options.phoneVoiceId || "").toLowerCase();
  const language = (options.language || "").trim().toLowerCase();

  const isBritish =
    language === "en-gb" ||
    id.includes("polly.amy") ||
    id.includes("polly.emma") ||
    id.includes("polly.brian");
  const isAustralian =
    language === "en-au" ||
    id.includes("polly.nicole") ||
    id.includes("polly.russell");

  if (isBritish) {
    return "Speak with a natural British English accent.";
  }
  if (isAustralian) {
    return "Speak with a natural Australian English accent.";
  }
  return "";
}

/**
 * Twilio Voice Webhook - Handles incoming calls
 */
router.post("/voice", async (req: Request, res: Response) => {
  try {
    const {
      CallSid,
      From,
      To,
      CallStatus,
      CallerCity,
      CallerState,
      CallerCountry,
      Direction,
    } = req.body;

    // Some Twilio configurations mistakenly point status callbacks to /voice.
    // If this request is a call-progress event callback, acknowledge it and do cleanup.
    if (req.body?.CallbackSource === "call-progress-events") {
      console.log(
        `[Twilio] /voice received call-progress-events callback for ${CallSid} (${CallStatus})`
      );

      if (
        ["completed", "canceled", "failed", "busy", "no-answer"].includes(
          String(CallStatus || "").toLowerCase()
        )
      ) {
        await twilioRealtimeVoiceService.endSessionByCallSid(CallSid);
        if ((global as any).twilioCallMetadata?.[CallSid]) {
          delete (global as any).twilioCallMetadata[CallSid];
        }
      }

      res.sendStatus(200);
      return;
    }

    console.log(`[Twilio] Voice webhook received:`, req.body);
    console.log(`[Twilio] Voice webhook: ${CallStatus} from ${From} to ${To}`);

    // Look up tenant from the inbound phone number
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { number: To },
      select: {
        id: true,
        number: true,
        tenantId: true,
      },
    });

    if (!phoneNumber) {
      console.log(`[Twilio] Phone number ${To} not found in database`);
      // Return TwiML to reject call
      res.type("text/xml");
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This number is not configured. Please contact support.</Say>
  <Hangup/>
</Response>`;
      console.log(`[Twilio] Sending TwiML:`, twiml);
      res.send(twiml);
      return;
    }

    // Get tenant name separately
    const tenant = await prisma.tenant.findUnique({
      where: { id: phoneNumber.tenantId },
      select: { name: true },
    });

    // Select workflow based on the workflow canvas trigger configuration.
    // In the UI, Incoming Call trigger stores config.phoneNumberId (or empty for Any/All).
    const candidateWorkflows = await prisma.workflow.findMany({
      where: {
        tenantId: phoneNumber.tenantId,
        isActive: true,
        triggerType: "Incoming Call",
      },
      include: {
        aiConfig: true,
        documents: {
          include: {
            document: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const extractIncomingCallTrigger = (nodesJson: unknown) => {
      const nodes = Array.isArray(nodesJson) ? (nodesJson as any[]) : [];
      const triggerNode =
        nodes.find(
          (n) => n?.type === "trigger" && n?.label === "Incoming Call"
        ) || nodes.find((n) => n?.type === "trigger");
      const config = triggerNode?.config || {};
      return {
        phoneNumberId:
          typeof config.phoneNumberId === "string" ? config.phoneNumberId : "",
        greeting: typeof config.greeting === "string" ? config.greeting : "",
        phoneVoiceId:
          typeof config.phoneVoiceId === "string" ? config.phoneVoiceId : "",
        phoneVoiceLanguage:
          typeof config.phoneVoiceLanguage === "string"
            ? config.phoneVoiceLanguage
            : "",
        requestInfo: config.requestInfo || {},
      };
    };

    const selectedWorkflow = candidateWorkflows.find((wf) => {
      const { phoneNumberId } = extractIncomingCallTrigger(wf.nodes);
      if (!phoneNumberId) return true; // Any / All Numbers
      return phoneNumberId === phoneNumber.id;
    });

    let workflowId = "default";
    let systemPrompt =
      "You are a helpful AI assistant for customer support. Keep responses brief and natural.";
    let documentIds: string[] = [];
    let agentName = "AI Assistant";
    let greeting = "";
    let phoneVoiceId = "";
    let phoneVoiceLanguage = "";
    let requestInfo: any = {};

    if (selectedWorkflow) {
      workflowId = selectedWorkflow.id;
      documentIds = selectedWorkflow.documents.map((wd) => wd.document.id);

      const workflowPhoneVoiceId = String(
        (selectedWorkflow as any)?.phoneVoiceId ?? ""
      );
      const workflowPhoneVoiceLanguage = String(
        (selectedWorkflow as any)?.phoneVoiceLanguage ?? ""
      );

      const trigger = extractIncomingCallTrigger(selectedWorkflow.nodes);
      greeting = trigger.greeting;
      phoneVoiceId = (trigger.phoneVoiceId || "").trim()
        ? trigger.phoneVoiceId
        : workflowPhoneVoiceId;
      phoneVoiceLanguage = (trigger.phoneVoiceLanguage || "").trim()
        ? trigger.phoneVoiceLanguage
        : workflowPhoneVoiceLanguage;
      requestInfo = trigger.requestInfo;

      const aiConfig = selectedWorkflow.aiConfig;
      if (aiConfig) {
        agentName = aiConfig.name || agentName;
        const businessInfo = aiConfig.businessDescription || "";
        systemPrompt = aiConfig.systemPrompt || systemPrompt;
        if (businessInfo) {
          systemPrompt = `${systemPrompt}\n\nBusiness Context: ${businessInfo}`;
        }
      }

      const workflowToneOfVoice = String(
        (selectedWorkflow as any)?.toneOfVoice ?? ""
      ).trim();
      const configToneOfVoice = String(
        (selectedWorkflow.aiConfig as any)?.toneOfVoice ?? ""
      ).trim();
      const effectiveToneOfVoice = workflowToneOfVoice || configToneOfVoice;
      if (effectiveToneOfVoice) {
        systemPrompt = applyToneOfVoiceToSystemPrompt(
          systemPrompt,
          effectiveToneOfVoice
        );
      }

      console.log(
        `[Twilio] Selected workflow ${selectedWorkflow.id} (${selectedWorkflow.name}) for To=${To}`
      );
      console.log(`[Twilio] Agent name: ${agentName}`);
      console.log(`[Twilio] Documents assigned: ${documentIds.length}`);
      console.log(`[Twilio] Trigger greeting set: ${Boolean(greeting)}`);
    } else {
      console.log(
        `[Twilio] No matching active Incoming Call workflow found for tenant ${phoneNumber.tenantId} (To=${To}). Using defaults.`
      );
    }

    // Return TwiML to start Media Stream.
    // NOTE: We avoid Twilio <Say> for the greeting to reduce robotic-sounding TTS.
    // The greeting is spoken by OpenAI Realtime once the media stream is connected.
    const publicUrl =
      process.env.PUBLIC_URL || "wss://chamois-holy-unduly.ngrok-free.app";
    const streamUrl = `${publicUrl}/ws/twilio`;

    console.log(
      `[Twilio] Starting OpenAI Realtime call ${CallSid}, Stream URL: ${streamUrl}`
    );
    console.log(
      `[Twilio] Using workflow ${workflowId} for tenant ${phoneNumber.tenantId}`
    );

    // Resolve a phone-voice preference for best-effort OpenAI voice mapping + accent.
    const tenantPreference = await hybridVoiceService.getVoicePreference(
      phoneNumber.tenantId
    );
    const effectivePhoneVoiceId =
      (phoneVoiceId || "").trim() || tenantPreference.voice;
    const effectivePhoneVoiceLanguage =
      (phoneVoiceLanguage || "").trim() || tenantPreference.language;
    const openaiVoice = deriveOpenAIVoiceFromPhoneVoiceId(
      effectivePhoneVoiceId
    );

    const accentInstruction = deriveAccentInstruction({
      phoneVoiceId: effectivePhoneVoiceId,
      language: effectivePhoneVoiceLanguage,
    });
    if (accentInstruction) {
      systemPrompt = `${systemPrompt}\n\nVoice style: ${accentInstruction}`;
    }

    // Look up customer by phone number if exists
    let customer = await prisma.user.findFirst({
      where: {
        tenantId: phoneNumber.tenantId,
        role: "CUSTOMER",
        // For voice calls, we might store phone in a metadata field or use a different approach
        // For now, we'll just check if there's any existing conversation for this number
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    // Try to find existing conversation for this customer phone number
    let existingConversation = await prisma.conversation.findFirst({
      where: {
        tenantId: phoneNumber.tenantId,
        status: { not: "RESOLVED" },
        channel: "VOICE",
        messages: {
          some: {
            content: { contains: From }, // Check if any message references this number
          },
        },
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        channel: true,
      },
      orderBy: {
        lastActivity: "desc",
      },
    });

    // Build comprehensive context for workflow engine
    const workflowContext = {
      trigger: {
        type: "Incoming Call",
        source: "twilio",
        phoneNumberId: phoneNumber.id,
        phoneNumber: To,
        requestInfo, // Include what information to request from caller
      },
      customer: customer
        ? {
            id: customer.id,
            name: customer.name || undefined,
            email: customer.email || undefined,
            phone: From,
            metadata: {},
          }
        : {
            phone: From,
            metadata: {},
          },
      conversation: existingConversation
        ? {
            id: existingConversation.id,
            channel: existingConversation.channel,
            status: existingConversation.status,
            metadata: {},
          }
        : undefined,
      call: {
        sid: CallSid,
        from: From,
        to: To,
        status: CallStatus,
        direction: Direction || "inbound",
        callerCity: CallerCity || undefined,
        callerState: CallerState || undefined,
        callerCountry: CallerCountry || undefined,
      },
      tenant: {
        id: phoneNumber.tenantId,
        name: tenant?.name,
      },
      workflow: {
        id: workflowId,
        name: selectedWorkflow?.name,
      },
    };

    res.type("text/xml");
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
    console.log(`[Twilio] Sending TwiML:`, twiml);
    res.send(twiml);

    // Store call metadata for WebSocket connection
    (global as any).twilioCallMetadata =
      (global as any).twilioCallMetadata || {};
    (global as any).twilioCallMetadata[CallSid] = {
      tenantId: phoneNumber.tenantId,
      workflowId,
      systemPrompt,
      documentIds,
      agentName,
      greeting,
      greetingSpokenByTwilio: false,
      openaiVoice,
      workflowContext, // Pass context to WebSocket handler
    };
  } catch (error) {
    console.error("[Twilio] Voice webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Twilio Status Callback - Tracks call completion
 */
router.post("/status", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    console.log(
      `[Twilio] Status callback: ${CallSid} - ${CallStatus}, Duration: ${CallDuration}s`
    );

    // Proactively clean up resources on terminal call states.
    if (
      ["completed", "canceled", "failed", "busy", "no-answer"].includes(
        String(CallStatus || "").toLowerCase()
      )
    ) {
      await twilioRealtimeVoiceService.endSessionByCallSid(CallSid);
      if ((global as any).twilioCallMetadata?.[CallSid]) {
        delete (global as any).twilioCallMetadata[CallSid];
      }
    }

    // Track usage if call completed
    if (CallStatus === "completed" && CallDuration) {
      // TODO: Implement usage tracking similar to Telnyx
      console.log(`[Twilio] TODO: Track usage for call ${CallSid}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("[Twilio] Status callback error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Initialize Twilio WebSocket server for Media Streams
 */
export function initializeTwilioWebSocket(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  console.log("[Twilio] WebSocket Server created (noServer mode)");

  wss.on("error", (error) => {
    console.error("[Twilio] WebSocket Server error:", error);
  });

  wss.on("connection", (ws, req) => {
    console.log("[Twilio] ✓✓✓ WebSocket connection ESTABLISHED ✓✓✓");
    console.log(`[Twilio] Connection from: ${req.socket.remoteAddress}`);

    let sessionId: string | null = null;
    let streamSid: string | null = null;
    let callSid: string | null = null;

    ws.on("message", async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.event) {
          case "start":
            streamSid = data.start.streamSid;
            callSid = data.start.callSid;
            console.log(
              `[Twilio] Media stream started: ${streamSid} for call ${callSid}`
            );

            // Get call metadata
            if (callSid && streamSid) {
              const metadata = (global as any).twilioCallMetadata?.[callSid];
              if (metadata) {
                // Start Twilio Realtime session
                sessionId = await twilioRealtimeVoiceService.startSession(
                  callSid,
                  streamSid,
                  metadata.tenantId,
                  metadata.workflowId,
                  metadata.systemPrompt,
                  metadata.documentIds,
                  metadata.agentName,
                  metadata.greeting,
                  metadata.workflowContext // Pass workflow context
                );

                // Connect to OpenAI Realtime API
                await twilioRealtimeVoiceService.connectToOpenAI(
                  sessionId,
                  metadata.openaiVoice || "alloy"
                );

                // If Twilio already spoke the greeting in TwiML, don't repeat it via OpenAI.
                if (metadata.greetingSpokenByTwilio) {
                  const s = twilioRealtimeVoiceService.getSession(sessionId);
                  if (s) s.greetingSent = true;
                }

                // Set Twilio WebSocket for bidirectional audio
                twilioRealtimeVoiceService.setTwilioWebSocket(sessionId, ws);

                // No need to send any placeholder audio; OpenAI will speak the greeting.
              }
            }
            break;

          case "media":
            // Forward audio to OpenAI Realtime API
            if (sessionId && data.media?.payload) {
              twilioRealtimeVoiceService.handleTwilioAudio(
                sessionId,
                data.media.payload
              );
            }
            break;

          case "stop":
            console.log(`[Twilio] Media stream stopped: ${streamSid}`);
            if (sessionId) {
              await twilioRealtimeVoiceService.endSession(sessionId);
            }
            // Cleanup metadata
            if (callSid && (global as any).twilioCallMetadata) {
              delete (global as any).twilioCallMetadata[callSid];
            }
            break;
        }
      } catch (error) {
        console.error("[Twilio] WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      console.log("[Twilio] WebSocket connection closed");
      if (sessionId) {
        twilioRealtimeVoiceService.endSession(sessionId);
      }
    });

    ws.on("error", (error) => {
      console.error("[Twilio] WebSocket error:", error);
    });
  });

  console.log("[Twilio] WebSocket server initialized on /ws/twilio");

  return wss; // Return the WebSocket server instance
}

export default router;
