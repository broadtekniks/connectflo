import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { WorkflowEngine } from "../services/workflowEngine";
import { TelnyxService } from "../services/telnyx";
import { detectIntentFromConfiguredIntents } from "../services/intents/detectIntent";

const router = Router();
const workflowEngine = new WorkflowEngine();
const telnyxService = new TelnyxService();

function escapeXml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Twilio SMS Webhook
router.post("/twilio/sms", async (req: Request, res: Response) => {
  try {
    const { MessageSid, From, To, Body, NumMedia, MediaUrl0 } = req.body;

    console.log("[SMS] Received from", From, "to", To, ":", Body);

    // Find the phone number in database
    const phoneNumber: any = await prisma.phoneNumber.findUnique({
      where: { number: To },
      include: { tenant: true },
    });

    if (!phoneNumber) {
      console.error("[SMS] Phone number not found:", To);
      return res
        .status(404)
        .type("text/xml")
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // Check if number has opted out
    const optOut = await (prisma as any).smsOptOut.findUnique({
      where: {
        tenantId_phoneNumber: {
          tenantId: phoneNumber.tenantId,
          phoneNumber: From,
        },
      },
    });

    if (optOut) {
      console.log("[SMS] Number has opted out:", From);
      return res
        .status(200)
        .type("text/xml")
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // Check for STOP keywords (opt-out)
    const stopKeywords = [
      "STOP",
      "STOPALL",
      "UNSUBSCRIBE",
      "CANCEL",
      "END",
      "QUIT",
    ];
    const normalizedBody = Body.trim().toUpperCase();

    if (stopKeywords.includes(normalizedBody)) {
      await (prisma as any).smsOptOut.create({
        data: {
          tenantId: phoneNumber.tenantId,
          phoneNumber: From,
          reason: normalizedBody,
        },
      });

      console.log("[SMS] User opted out:", From);

      return res
        .status(200)
        .type("text/xml")
        .send(
          `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been unsubscribed. Reply START to resubscribe.</Message>
        </Response>`
        );
    }

    // Check for START keywords (opt-in)
    const startKeywords = ["START", "YES", "UNSTOP"];
    if (startKeywords.includes(normalizedBody)) {
      await (prisma as any).smsOptOut.deleteMany({
        where: {
          tenantId: phoneNumber.tenantId,
          phoneNumber: From,
        },
      });

      console.log("[SMS] User opted back in:", From);

      return res
        .status(200)
        .type("text/xml")
        .send(
          `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been resubscribed to messages from this number.</Message>
        </Response>`
        );
    }

    // Find or create customer user
    let customer: any = await prisma.user.findFirst({
      where: {
        phoneNumber: From as any,
        tenantId: phoneNumber.tenantId,
      },
    });

    if (!customer) {
      const phoneDigits = From.replace(/\D/g, "");
      customer = await prisma.user.create({
        data: {
          email: `sms_${phoneDigits}@temp.connectflo.com`,
          name: From,
          phoneNumber: From as any,
          tenantId: phoneNumber.tenantId,
          role: "CUSTOMER",
        },
      });

      console.log("[SMS] Created new customer:", customer.id);
    }

    // Find or create conversation
    let conversation: any = await prisma.conversation.findFirst({
      where: {
        tenantId: phoneNumber.tenantId,
        channel: "SMS",
        customerId: customer.id,
        status: { not: "CLOSED" as any },
      },
      orderBy: { lastActivity: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId: phoneNumber.tenantId,
          channel: "SMS",
          status: "OPEN",
          customerId: customer.id,
          subject: `SMS from ${From}`,
          lastActivity: new Date(),
        },
      });

      console.log("[SMS] Created new conversation:", conversation.id);
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastActivity: new Date() },
      });
    }

    // Create message record
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: phoneNumber.tenantId,
        content: Body,
        sender: "CUSTOMER",
        attachments: NumMedia > 0 ? [MediaUrl0] : [],
      },
    });

    console.log("[SMS] Created message:", message.id);

    // Get Socket.IO from app
    const io = (req as any).app?.get("io");
    if (io) {
      io.to(`tenant_${phoneNumber.tenantId}`).emit("new_message", {
        conversationId: conversation.id,
        message: {
          id: message.id,
          content: message.content,
          sender: message.sender,
          createdAt: message.createdAt,
          attachments: message.attachments,
        },
      });
    }

    // Auto-assign to checked-in agent if available
    if (!conversation.assigneeId) {
      const checkedInAgent: any = await prisma.user.findFirst({
        where: {
          tenantId: phoneNumber.tenantId,
          role: { in: ["AGENT", "TENANT_ADMIN"] },
          isCheckedIn: true,
        },
        orderBy: { checkedInAt: "asc" },
      });

      if (checkedInAgent) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { assigneeId: checkedInAgent.id },
        });

        console.log("[SMS] Auto-assigned to agent:", checkedInAgent.id);
      }
    }

    // Detect intent using tenant-configured intents (keyword matching fallback)
    const aiConfig = await prisma.aiConfig.findUnique({
      where: { tenantId: phoneNumber.tenantId },
      select: { intents: true },
    });
    const detectedIntent = detectIntentFromConfiguredIntents(
      String(Body || ""),
      aiConfig?.intents
    );

    const workflowContext = {
      trigger: {
        type: "Incoming Message",
        source: "twilio",
        phoneNumberId: phoneNumber.id,
        phoneNumber: To,
      },
      customer: customer
        ? {
            id: customer.id,
            name: customer.name || undefined,
            email: customer.email || undefined,
            phone: From,
            metadata: {},
          }
        : { phone: From, metadata: {} },
      conversation: conversation
        ? {
            id: conversation.id,
            channel: conversation.channel,
            status: conversation.status,
            assignedToId: conversation.assigneeId || undefined,
            subject: conversation.subject || undefined,
            intent: detectedIntent,
            metadata: {},
          }
        : { intent: detectedIntent, metadata: {} },
      message: {
        from: From,
        to: To,
        text: Body,
        direction: "inbound",
        timestamp: new Date().toISOString(),
        sid: MessageSid,
      },
      tenant: {
        id: phoneNumber.tenantId,
        name: phoneNumber?.tenant?.name,
      },
      // legacy fields
      tenantId: phoneNumber.tenantId,
      type: "sms",
      fromNumber: From,
      toNumber: To,
      text: Body,
      Body,
      MessageSid,
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
      const msg = escapeXml(result.afterHours.text);
      return res
        .status(200)
        .type("text/xml")
        .send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message>${msg}</Message></Response>`
        );
    }

    return res
      .status(200)
      .type("text/xml")
      .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error("[SMS] Webhook error:", error);
    res.status(500).send("Internal error");
  }
});

// Telnyx SMS Webhook
router.post("/telnyx/sms", async (req: Request, res: Response) => {
  try {
    const { data } = req.body;

    if (!data || data.event_type !== "message.received") {
      return res.status(200).json({ status: "ignored" });
    }

    const payload = data.payload;
    const From = payload.from.phone_number;
    const To = payload.to[0].phone_number;
    const Body = payload.text;
    const Media = payload.media || [];

    console.log("[SMS/Telnyx] Received from", From, "to", To, ":", Body);

    // Reuse same logic as Twilio
    const phoneNumber: any = await prisma.phoneNumber.findUnique({
      where: { number: To },
      include: { tenant: true },
    });

    if (!phoneNumber) {
      console.error("[SMS/Telnyx] Phone number not found:", To);
      return res.status(404).json({ error: "Number not found" });
    }

    // Check opt-out
    const optOut = await (prisma as any).smsOptOut.findUnique({
      where: {
        tenantId_phoneNumber: {
          tenantId: phoneNumber.tenantId,
          phoneNumber: From,
        },
      },
    });

    if (optOut) {
      console.log("[SMS/Telnyx] Number has opted out:", From);
      return res.status(200).json({ status: "opted_out" });
    }

    // Handle STOP/START keywords
    const normalizedBody = Body.trim().toUpperCase();
    const stopKeywords = [
      "STOP",
      "STOPALL",
      "UNSUBSCRIBE",
      "CANCEL",
      "END",
      "QUIT",
    ];
    const startKeywords = ["START", "YES", "UNSTOP"];

    if (stopKeywords.includes(normalizedBody)) {
      await (prisma as any).smsOptOut.create({
        data: {
          tenantId: phoneNumber.tenantId,
          phoneNumber: From,
          reason: normalizedBody,
        },
      });
      console.log("[SMS/Telnyx] User opted out:", From);
      return res.status(200).json({ status: "opted_out" });
    }

    if (startKeywords.includes(normalizedBody)) {
      await (prisma as any).smsOptOut.deleteMany({
        where: {
          tenantId: phoneNumber.tenantId,
          phoneNumber: From,
        },
      });
      console.log("[SMS/Telnyx] User opted back in:", From);
      return res.status(200).json({ status: "opted_in" });
    }

    // Find or create customer
    let customer: any = await prisma.user.findFirst({
      where: {
        phoneNumber: From as any,
        tenantId: phoneNumber.tenantId,
      },
    });

    if (!customer) {
      const phoneDigits = From.replace(/\D/g, "");
      customer = await prisma.user.create({
        data: {
          email: `sms_${phoneDigits}@temp.connectflo.com`,
          name: From,
          phoneNumber: From as any,
          tenantId: phoneNumber.tenantId,
          role: "CUSTOMER",
        },
      });
    }

    // Find or create conversation
    let conversation: any = await prisma.conversation.findFirst({
      where: {
        tenantId: phoneNumber.tenantId,
        channel: "SMS",
        customerId: customer.id,
        status: { not: "CLOSED" as any },
      },
      orderBy: { lastActivity: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId: phoneNumber.tenantId,
          channel: "SMS",
          status: "OPEN",
          customerId: customer.id,
          subject: `SMS from ${From}`,
          lastActivity: new Date(),
        },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastActivity: new Date() },
      });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId: phoneNumber.tenantId,
        content: Body,
        sender: "CUSTOMER",
        attachments: Media.length > 0 ? Media.map((m: any) => m.url) : [],
      },
    });

    // Emit Socket.IO event
    const io = (req as any).app?.get("io");
    if (io) {
      io.to(`tenant_${phoneNumber.tenantId}`).emit("new_message", {
        conversationId: conversation.id,
        message: {
          id: message.id,
          content: message.content,
          sender: message.sender,
          createdAt: message.createdAt,
          attachments: message.attachments,
        },
      });
    }

    // Auto-assign to checked-in agent
    if (!conversation.assigneeId) {
      const checkedInAgent: any = await prisma.user.findFirst({
        where: {
          tenantId: phoneNumber.tenantId,
          role: { in: ["AGENT", "TENANT_ADMIN"] },
          isCheckedIn: true,
        },
        orderBy: { checkedInAt: "asc" },
      });

      if (checkedInAgent) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { assigneeId: checkedInAgent.id },
        });
      }
    }

    // Detect intent using tenant-configured intents (keyword matching fallback)
    const aiConfig = await prisma.aiConfig.findUnique({
      where: { tenantId: phoneNumber.tenantId },
      select: { intents: true },
    });
    const detectedIntent = detectIntentFromConfiguredIntents(
      String(Body || ""),
      aiConfig?.intents
    );

    const workflowContext = {
      trigger: {
        type: "Incoming Message",
        source: "telnyx",
        phoneNumberId: phoneNumber.id,
        phoneNumber: To,
      },
      customer: customer
        ? {
            id: customer.id,
            name: customer.name || undefined,
            email: customer.email || undefined,
            phone: From,
            metadata: {},
          }
        : { phone: From, metadata: {} },
      conversation: conversation
        ? {
            id: conversation.id,
            channel: conversation.channel,
            status: conversation.status,
            assignedToId: conversation.assigneeId || undefined,
            subject: conversation.subject || undefined,
            intent: detectedIntent,
            metadata: {},
          }
        : { intent: detectedIntent, metadata: {} },
      message: {
        from: From,
        to: To,
        text: Body,
        direction: "inbound",
        timestamp: new Date().toISOString(),
      },
      tenant: {
        id: phoneNumber.tenantId,
        name: phoneNumber?.tenant?.name,
      },
      // legacy fields
      tenantId: phoneNumber.tenantId,
      type: "sms",
      fromNumber: From,
      toNumber: To,
      text: Body,
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
        await telnyxService.sendTestSMS(To, From, result.afterHours.text);
      } catch (err) {
        console.warn("[SMS/Telnyx] Failed to send after-hours reply:", err);
      }
    }

    res.status(200).json({ status: "received" });
  } catch (error) {
    console.error("[SMS/Telnyx] Webhook error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
