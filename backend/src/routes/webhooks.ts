import { Router, Request, Response } from "express";
import { WorkflowEngine } from "../services/workflowEngine";

const router = Router();
const workflowEngine = new WorkflowEngine();

router.post("/telnyx", async (req: Request, res: Response) => {
  try {
    const event = req.body;

    // Telnyx events are wrapped in data object
    const eventType = event.data?.event_type;
    const payload = event.data?.payload;

    if (eventType === "message.received") {
      // Trigger "Incoming Message" workflow
      // Payload structure: https://developers.telnyx.com/docs/api/v2/messaging/Message-Object
      await workflowEngine.trigger("Incoming Message", {
        type: "sms",
        fromNumber: payload.from.phone_number,
        toNumber: payload.to[0].phone_number,
        text: payload.text,
        direction: payload.direction,
        raw: payload,
      });
    } else if (eventType === "call.initiated") {
      // Trigger "Incoming Call" workflow
      // Payload structure: https://developers.telnyx.com/docs/api/v2/call-control/Call-Control-Object
      await workflowEngine.trigger("Incoming Call", {
        type: "voice",
        callControlId: payload.call_control_id,
        fromNumber: payload.from,
        toNumber: payload.to,
        direction: payload.direction,
        raw: payload,
      });
    } else if (eventType === "call.speak.ended") {
      // When greeting finishes speaking, start transcription
      await workflowEngine.handleSpeakEnded(payload.call_control_id);
    } else if (eventType === "call.transcription") {
      // Only process final transcripts to avoid interrupting the user mid-sentence
      // and to prevent spamming the AI service with partial results
      if (payload.transcription_data?.transcript) {
        await workflowEngine.handleVoiceInput(
          payload.call_control_id,
          payload.transcription_data.transcript
        );
      }
    }

    // Always return 200 OK to Telnyx so they don't retry
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
