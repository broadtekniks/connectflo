import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { MessageSender, Sentiment } from "@prisma/client";
import { OpenAIService } from "../services/ai/openai";
import { KnowledgeBaseService } from "../services/knowledgeBase";
import { AuthRequest } from "../middleware/auth";
import { isTenantOpenNow } from "../services/businessHours";
import { sendSms } from "../services/sms";

const router = Router();
const aiService = new OpenAIService();
const kbService = new KnowledgeBaseService();

// Create a new message
router.post("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { conversationId, content, sender, isPrivateNote, attachments } =
      req.body;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!conversationId || !content || !sender) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify conversation belongs to tenant
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Create message and update conversation lastActivity
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          tenantId,
          content,
          sender: sender as MessageSender,
          isPrivateNote: isPrivateNote || false,
          attachments: attachments || [],
        },
      }),
      prisma.conversation.updateMany({
        where: { id: conversationId, tenantId },
        data: { lastActivity: new Date() },
      }),
    ]);

    // Emit new message event
    const io = req.app.get("io");
    io.to(conversationId).emit("new_message", {
      ...message,
      timestamp: message.createdAt.toISOString(),
    });

    // If this is an SMS conversation and sender is AGENT/AI, send SMS
    if (
      conversation.channel === "SMS" &&
      (sender === "AGENT" || sender === "AI") &&
      !isPrivateNote
    ) {
      const customer = await prisma.user.findUnique({
        where: { id: conversation.customerId },
      });

      if (customer && (customer as any).phoneNumber) {
        try {
          await sendSms({
            tenantId,
            to: (customer as any).phoneNumber,
            body: content,
          });
          console.log(
            `[SMS] Sent message to ${(customer as any).phoneNumber}`
          );
        } catch (error) {
          console.error("[SMS] Failed to send message:", error);
        }
      }
    }

    // Background AI Processing

    // 1. Analyze Sentiment
    aiService
      .analyzeSentiment(content)
      .then(async (sentiment) => {
        await prisma.conversation.updateMany({
          where: { id: conversationId, tenantId },
          data: { sentiment: sentiment as Sentiment },
        });
      })
      .catch(console.error);

    // 2. Generate AI Reply
    (async () => {
      try {
        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, tenantId },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
            customer: true,
          },
        });

        if (conversation) {
          const aiMessages = conversation.messages.map((m: any) => ({
            role: (m.sender === "AGENT" || m.sender === "AI"
              ? "assistant"
              : "user") as "assistant" | "user",
            content: m.content,
          }));

          // Get the last user message for KB search
          const lastUserMessage = conversation.messages
            .slice()
            .reverse()
            .find((m: any) => m.sender === "CUSTOMER")?.content;

          const tenant = await prisma.tenant.findUnique({
            where: { id: conversation.tenantId },
            select: {
              businessTimeZone: true,
              businessHours: true,
              chatAfterHoursMode: true,
              chatAfterHoursMessage: true,
            },
          });

          const isOpenNow = tenant
            ? isTenantOpenNow({
                tenant: {
                  timeZone: tenant.businessTimeZone,
                  businessHours: tenant.businessHours,
                },
              })
            : true;

          // Fetch AI Config for the tenant
          const aiConfig = await prisma.aiConfig.findUnique({
            where: { tenantId: conversation.tenantId },
          });

          // Best-effort: if there's an active Incoming Message workflow, apply its
          // workflow-level overrides (tone + optional AI config override).
          const workflow = await prisma.workflow.findFirst({
            where: {
              tenantId: conversation.tenantId,
              isActive: true,
              triggerType: "Incoming Message",
            },
            include: { aiConfig: true },
            orderBy: { updatedAt: "desc" },
          });

          const effectiveAiConfig = (workflow as any)?.aiConfig || aiConfig;
          const workflowToneOfVoice = String(
            (workflow as any)?.toneOfVoice ?? ""
          ).trim();
          const effectiveToneOfVoice =
            workflowToneOfVoice ||
            String((effectiveAiConfig as any)?.toneOfVoice ?? "").trim();

          // Build context with business description
          let context = `Customer Name: ${conversation.customer.name}
Business Description: ${
            (effectiveAiConfig as any)?.businessDescription || "Not provided."
          }`;

          // After-hours chat message logic: apply only when tenant prefers it.
          if (!isOpenNow && tenant) {
            const mode = String(
              tenant.chatAfterHoursMode || "ONLY_ON_ESCALATION"
            )
              .trim()
              .toUpperCase();

            const defaultAfterHours =
              "We're currently closed, but we've received your message. We'll follow up during business hours.";
            const afterHoursText =
              (tenant.chatAfterHoursMessage || "").trim() || defaultAfterHours;

            const keywordEscalation = (lastUserMessage || "")
              .toLowerCase()
              .match(
                /\b(agent|human|representative|call me|phone call|call back)\b/
              );

            let escalationNeeded = Boolean(keywordEscalation);
            if (
              !escalationNeeded &&
              (effectiveAiConfig as any)?.autoEscalate &&
              lastUserMessage
            ) {
              const sentiment = await aiService.analyzeSentiment(
                lastUserMessage
              );
              escalationNeeded = sentiment === "NEGATIVE";
            }

            const shouldSendAfterHours =
              mode === "ALWAYS" ||
              (mode === "ONLY_ON_ESCALATION" && escalationNeeded);

            if (shouldSendAfterHours) {
              const aiMessage = await prisma.message.create({
                data: {
                  conversationId,
                  tenantId: conversation.tenantId,
                  content: afterHoursText,
                  sender: "AI",
                  isPrivateNote: false,
                },
              });

              io.to(conversationId).emit("new_message", {
                ...aiMessage,
                timestamp: aiMessage.createdAt.toISOString(),
              });
              return;
            }
          }

          // Search knowledge base if we have a user query
          if (lastUserMessage && conversation.tenantId) {
            const kbResults = await kbService.search(
              lastUserMessage,
              conversation.tenantId,
              15
            );
            if (kbResults.length > 0) {
              context += `\n\nRELEVANT KNOWLEDGE BASE ARTICLES:\n${kbResults.join(
                "\n\n"
              )}`;
              console.log(
                `[Messages AI] Found ${kbResults.length} KB results for conversation ${conversationId}`
              );
            }
          }

          const reply = await aiService.generateResponse(
            aiMessages,
            context,
            (effectiveAiConfig as any)?.systemPrompt,
            undefined,
            { toneOfVoice: effectiveToneOfVoice }
          );

          const aiMessage = await prisma.message.create({
            data: {
              conversationId,
              tenantId: conversation.tenantId,
              content: reply,
              sender: "AI",
              isPrivateNote: false,
            },
          });

          // Emit AI message event
          io.to(conversationId).emit("new_message", {
            ...aiMessage,
            timestamp: aiMessage.createdAt.toISOString(),
          });
        }
      } catch (error) {
        console.error("Error generating AI auto-reply:", error);
      }
    })();

    res.status(201).json({
      ...message,
      timestamp: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Failed to create message" });
  }
});

export default router;
