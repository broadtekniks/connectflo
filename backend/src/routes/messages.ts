import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { MessageSender, Sentiment } from "@prisma/client";
import { OpenAIService } from "../services/ai/openai";
import { KnowledgeBaseService } from "../services/knowledgeBase";
import { AuthRequest } from "../middleware/auth";

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
          content,
          sender: sender as MessageSender,
          isPrivateNote: isPrivateNote || false,
          attachments: attachments || [],
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastActivity: new Date(),
        },
      }),
    ]);

    // Emit new message event
    const io = req.app.get("io");
    io.to(conversationId).emit("new_message", {
      ...message,
      timestamp: message.createdAt.toISOString(),
    });

    // Background AI Processing

    // 1. Analyze Sentiment
    aiService
      .analyzeSentiment(content)
      .then(async (sentiment) => {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { sentiment: sentiment as Sentiment },
        });
      })
      .catch(console.error);

    // 2. Generate AI Reply
    (async () => {
      try {
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
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

          // Fetch AI Config for the tenant
          const aiConfig = await prisma.aiConfig.findUnique({
            where: { tenantId: conversation.tenantId },
          });

          // Build context with business description
          let context = `Customer Name: ${conversation.customer.name}
Business Description: ${aiConfig?.businessDescription || "Not provided."}`;

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
            aiConfig?.systemPrompt
          );

          const aiMessage = await prisma.message.create({
            data: {
              conversationId,
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
