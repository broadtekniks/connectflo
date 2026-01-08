import { Router, Request, Response } from "express";
import { WorkflowEngine } from "../services/workflowEngine";
import { TelnyxService } from "../services/telnyx";
import { hybridVoiceService } from "../services/hybridVoice";
import { isTenantOpenNow } from "../services/businessHours";
import { detectIntentFromConfiguredIntents } from "../services/intents/detectIntent";
import prisma from "../lib/prisma";

const router = Router();
const workflowEngine = new WorkflowEngine();
const telnyxService = new TelnyxService();

// Feature flag: use hybrid voice (GPT-4 + Telnyx TTS/STT) or legacy workflow
const USE_STREAMING_VOICE = process.env.USE_STREAMING_VOICE === "true";

router.post("/telnyx", async (req: Request, res: Response) => {
  try {
    const event = req.body;

    // Telnyx events are wrapped in data object
    const eventType = event.data?.event_type;
    const payload = event.data?.payload;

    if (eventType === "message.received") {
      // Trigger "Incoming Message" workflow with comprehensive context
      // Payload structure: https://developers.telnyx.com/docs/api/v2/messaging/Message-Object

      const fromNumber = payload.from.phone_number;
      const toNumber = payload.to[0].phone_number;

      // Look up tenant from the phone number
      const phoneNumber = await prisma.phoneNumber.findUnique({
        where: { number: toNumber },
        select: {
          id: true,
          number: true,
          tenantId: true,
        },
      });

      if (!phoneNumber) {
        console.log(
          `[Webhook] Phone number ${toNumber} not found for incoming message`
        );
        res.status(200).json({ received: true });
        return;
      }

      // Get tenant name separately
      const tenant = await prisma.tenant.findUnique({
        where: { id: phoneNumber.tenantId },
        select: { name: true },
      });

      // Look up customer (User with CUSTOMER role) by finding their conversations
      let customer = await prisma.user.findFirst({
        where: {
          tenantId: phoneNumber.tenantId,
          role: "CUSTOMER",
          conversations: {
            some: {
              messages: {
                some: {
                  content: { contains: fromNumber },
                },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      });

      // Look up or find recent conversation for this phone number
      let conversation = await prisma.conversation.findFirst({
        where: {
          tenantId: phoneNumber.tenantId,
          channel: "SMS",
          status: { not: "RESOLVED" },
          messages: {
            some: {
              content: { contains: fromNumber }, // Messages referencing this number
            },
          },
        },
        select: {
          id: true,
          customerId: true,
          status: true,
          assigneeId: true,
          channel: true,
          subject: true,
        },
        orderBy: {
          lastActivity: "desc",
        },
      });

      // Classify intent using tenant-configured intents (keyword matching fallback)
      const messageText = String(payload.text || "");

      const aiConfig = await prisma.aiConfig.findUnique({
        where: { tenantId: phoneNumber.tenantId },
        select: { intents: true },
      });

      const detectedIntent = detectIntentFromConfiguredIntents(
        messageText,
        aiConfig?.intents
      );

      // Classify sentiment using simple keyword matching (can be enhanced with AI)
      const lowerText = messageText.toLowerCase();
      let detectedSentiment = "neutral";

      // Check for negative sentiment indicators
      if (
        lowerText.includes("angry") ||
        lowerText.includes("frustrated") ||
        lowerText.includes("terrible") ||
        lowerText.includes("awful") ||
        lowerText.includes("horrible") ||
        lowerText.includes("worst") ||
        lowerText.includes("hate") ||
        lowerText.includes("disappointed") ||
        lowerText.includes("furious") ||
        lowerText.includes("unacceptable") ||
        lowerText.includes("ridiculous") ||
        lowerText.includes("disgusted")
      ) {
        detectedSentiment = "negative";
      }
      // Check for positive sentiment indicators
      else if (
        lowerText.includes("thank") ||
        lowerText.includes("thanks") ||
        lowerText.includes("great") ||
        lowerText.includes("excellent") ||
        lowerText.includes("amazing") ||
        lowerText.includes("wonderful") ||
        lowerText.includes("love") ||
        lowerText.includes("appreciate") ||
        lowerText.includes("perfect") ||
        lowerText.includes("awesome")
      ) {
        detectedSentiment = "positive";
      }

      // Build comprehensive context
      const workflowContext = {
        trigger: {
          type: "Incoming Message",
          source: "telnyx",
          phoneNumberId: phoneNumber.id,
          phoneNumber: toNumber,
        },
        customer: customer
          ? {
              id: customer.id,
              name: customer.name || undefined,
              email: customer.email || undefined,
              phone: fromNumber,
              metadata: {},
            }
          : {
              phone: fromNumber,
              metadata: {},
            },
        conversation: conversation
          ? {
              id: conversation.id,
              channel: conversation.channel,
              status: conversation.status,
              assignedToId: conversation.assigneeId || undefined,
              subject: conversation.subject || undefined,
              intent: detectedIntent,
              sentiment: detectedSentiment,
              metadata: {},
            }
          : {
              intent: detectedIntent,
              sentiment: detectedSentiment,
              metadata: {},
            },
        message: {
          from: fromNumber,
          to: toNumber,
          text: payload.text,
          direction: payload.direction,
          timestamp: payload.received_at || new Date().toISOString(),
        },
        tenant: {
          id: phoneNumber.tenantId,
          name: tenant?.name,
        },
        // Keep legacy fields for backward compatibility
        type: "sms",
        fromNumber,
        toNumber,
        text: payload.text,
        direction: payload.direction,
        raw: payload,
      };

      const result = await workflowEngine.trigger(
        "Incoming Message",
        workflowContext
      );

      if (
        result?.status === "skipped" &&
        result.reason === "after_hours" &&
        result.afterHours?.shouldReply &&
        result.afterHours.text
      ) {
        try {
          // Telnyx inbound: toNumber is our number, fromNumber is the customer.
          await telnyxService.sendTestSMS(
            toNumber,
            fromNumber,
            result.afterHours.text
          );
        } catch (err) {
          console.warn(
            "[Webhook/Telnyx] Failed to send after-hours SMS reply:",
            err
          );
        }
      }
    } else if (eventType === "call.initiated") {
      // Handle incoming call based on feature flag
      if (USE_STREAMING_VOICE) {
        // NEW: Use hybrid approach (GPT-4 + Telnyx TTS/STT)
        await handleHybridCall(payload);
      } else {
        // LEGACY: Use traditional TTS/STT workflow
        const toNumber = String(payload.to || "").trim();
        const phoneNumber = toNumber
          ? await prisma.phoneNumber.findUnique({
              where: { number: toNumber },
              select: {
                id: true,
                tenantId: true,
                afterHoursMessage: true,
              },
            })
          : null;

        const tenant = phoneNumber?.tenantId
          ? await prisma.tenant.findUnique({
              where: { id: phoneNumber.tenantId },
              select: { businessTimeZone: true, businessHours: true },
            })
          : null;

        const result = await workflowEngine.trigger("Incoming Call", {
          type: "voice",
          callControlId: payload.call_control_id,
          fromNumber: payload.from,
          toNumber: payload.to,
          direction: payload.direction,
          raw: payload,
          tenantId: phoneNumber?.tenantId,
          trigger: {
            type: "Incoming Call",
            source: "telnyx",
            phoneNumberId: phoneNumber?.id,
            phoneNumber: toNumber,
          },
        });

        // Fallback behavior when no Incoming Call workflow is configured.
        if (result?.status === "no_workflow") {
          try {
            await telnyxService.answerCall(payload.call_control_id);
            const closedText =
              String(phoneNumber?.afterHoursMessage || "").trim() ||
              "Thanks for calling. We're currently closed. Please call back during business hours.";
            const openText =
              "Thanks for calling. This line is not configured yet.";

            const isOpenNow = tenant
              ? isTenantOpenNow({
                  tenant: {
                    timeZone: (tenant as any)?.businessTimeZone,
                    businessHours: (tenant as any)?.businessHours,
                  },
                })
              : true;

            await telnyxService.speakText(
              payload.call_control_id,
              isOpenNow ? openText : closedText
            );
          } catch (err) {
            console.warn(
              "[Webhook/Telnyx] Fallback voice response failed:",
              err
            );
          }

          try {
            await telnyxService.hangupCall(payload.call_control_id);
          } catch {
            // ignore
          }
        }
      }
    } else if (eventType === "call.speak.ended") {
      // When TTS finishes speaking
      if (USE_STREAMING_VOICE) {
        // Hybrid: start listening after AI speaks
        await hybridVoiceService.onSpeakEnded(payload.call_control_id);
      } else {
        // Legacy: start transcription
        await workflowEngine.handleSpeakEnded(payload.call_control_id);
      }
    } else if (eventType === "call.transcription") {
      // Process transcription
      if (USE_STREAMING_VOICE && payload.transcription_data?.transcript) {
        // Hybrid: process with AI
        await hybridVoiceService.onUserInput(
          payload.call_control_id,
          payload.transcription_data.transcript
        );
      } else if (
        !USE_STREAMING_VOICE &&
        payload.transcription_data?.transcript
      ) {
        // Legacy: use workflow engine
        await workflowEngine.handleVoiceInput(
          payload.call_control_id,
          payload.transcription_data.transcript
        );
      }
    } else if (eventType === "call.hangup") {
      // Handle call hangup
      if (USE_STREAMING_VOICE) {
        await hybridVoiceService.endSession(payload.call_control_id);
      }
      console.log(`Call ${payload.call_control_id} ended`);
    }

    // Always return 200 OK to Telnyx so they don't retry
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Handle incoming call with hybrid voice (GPT-4 + Telnyx TTS/STT)
 */
async function handleHybridCall(payload: any) {
  const callControlId = payload.call_control_id;
  const fromNumber = payload.from;
  const toNumber = payload.to;

  console.log(`[Hybrid Voice] Incoming call from ${fromNumber} to ${toNumber}`);

  try {
    // Look up tenant from the inbound phone number
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { number: toNumber },
      select: { id: true, tenantId: true },
    });

    if (!phoneNumber) {
      console.error(
        `[Hybrid Voice] Phone number ${toNumber} not found in database`
      );
      await telnyxService.hangupCall(callControlId);
      return;
    }

    const tenantId = phoneNumber.tenantId;

    // Select workflow based on the workflow canvas trigger configuration
    const candidateWorkflows = await prisma.workflow.findMany({
      where: {
        tenantId,
        isActive: true,
        triggerType: "Incoming Call",
      },
      select: { id: true, name: true, nodes: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    const extractIncomingCallTriggerPhoneNumberId = (nodesJson: unknown) => {
      const nodes = Array.isArray(nodesJson) ? (nodesJson as any[]) : [];
      const triggerNode =
        nodes.find(
          (n) => n?.type === "trigger" && n?.label === "Incoming Call"
        ) || nodes.find((n) => n?.type === "trigger");
      const config = triggerNode?.config || {};
      return typeof config.phoneNumberId === "string"
        ? config.phoneNumberId
        : "";
    };

    const selectedWorkflow = candidateWorkflows.find((wf) => {
      const phoneNumberId = extractIncomingCallTriggerPhoneNumberId(wf.nodes);
      if (!phoneNumberId) return true; // Any / All Numbers
      return phoneNumberId === phoneNumber.id;
    });

    const workflowId = selectedWorkflow?.id;

    console.log(
      `[Hybrid Voice] Starting session for tenant ${tenantId}, workflow ${
        workflowId || "default"
      }`
    );

    await hybridVoiceService.startSession(callControlId, tenantId, workflowId);
  } catch (error) {
    console.error("[Hybrid Voice] Error handling call:", error);
    await telnyxService.hangupCall(callControlId);
  }
}

export default router;
