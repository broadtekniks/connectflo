import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { ConversationStatus, ChannelType, Sentiment } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";

const router = Router();

// Get all conversations
router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { status, assigneeId } = req.query;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    const where: any = { tenantId };
    if (status) where.status = status as ConversationStatus;
    if (assigneeId) where.assigneeId = assigneeId as string;

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        customer: true,
        assignee: true,
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        lastActivity: "desc",
      },
    });

    const formattedConversations = conversations.map((conv: any) => ({
      ...conv,
      messages: conv.messages.map((msg: any) => ({
        ...msg,
        timestamp: msg.createdAt.toISOString(),
      })),
    }));

    res.json(formattedConversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get single conversation
router.get("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        assignee: true,
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const formattedConversation = {
      ...conversation,
      messages: conversation.messages.map((msg: any) => ({
        ...msg,
        timestamp: msg.createdAt.toISOString(),
      })),
    };

    res.json(formattedConversation);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Create conversation
router.post("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { customerId, channel, subject, initialMessage } = req.body;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Fetch customer to get tenantId and verify it matches
    const customer = await prisma.user.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Start a transaction to create conversation and initial message
    const result = await prisma.$transaction(async (tx: any) => {
      const conversation = await tx.conversation.create({
        data: {
          customerId,
          tenantId,
          channel: channel as ChannelType,
          subject,
          status: ConversationStatus.OPEN,
          sentiment: Sentiment.NEUTRAL,
        },
      });

      if (initialMessage) {
        await tx.message.create({
          data: {
            content: initialMessage,
            sender: "CUSTOMER",
            conversationId: conversation.id,
          },
        });
      }

      return conversation;
    });

    const fullConversation = await prisma.conversation.findUnique({
      where: { id: result.id },
      include: {
        customer: true,
        messages: true,
      },
    });

    if (!fullConversation) {
      throw new Error("Failed to fetch created conversation");
    }

    const formattedConversation = {
      ...fullConversation,
      messages: fullConversation.messages.map((msg: any) => ({
        ...msg,
        timestamp: msg.createdAt.toISOString(),
      })),
    };

    res.status(201).json(formattedConversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Update conversation
router.patch("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const { status, assigneeId, priority, sentiment, tags } = req.body;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify ownership
    const existing = await prisma.conversation.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        status: status as ConversationStatus,
        assigneeId,
        priority,
        sentiment: sentiment as Sentiment,
        tags,
      },
      include: {
        customer: true,
        assignee: true,
      },
    });

    res.json(conversation);
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

// Delete conversation
router.delete("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify ownership
    const existing = await prisma.conversation.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await prisma.conversation.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;
