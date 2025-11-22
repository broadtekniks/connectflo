import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { MessageSender, Sentiment } from "@prisma/client";
import { OpenAIService } from "../services/ai/openai";

const router = Router();
const aiService = new OpenAIService();

// Create a new message
router.post("/", async (req: Request, res: Response) => {
  try {
    const { conversationId, content, sender, isPrivateNote, attachments } =
      req.body;

    if (!conversationId || !content || !sender) {
      return res.status(400).json({ error: "Missing required fields" });
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
          const aiMessages = conversation.messages.map((m) => ({
            role: (m.sender === "AGENT" || m.sender === "AI"
              ? "assistant"
              : "user") as "assistant" | "user",
            content: m.content,
          }));

          const context = `Customer Name: ${conversation.customer.name}`;
          const reply = await aiService.generateResponse(aiMessages, context);

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
