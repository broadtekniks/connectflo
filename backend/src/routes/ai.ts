import { Router, Request, Response } from "express";
import { OpenAIService } from "../services/ai/openai";
import { KnowledgeBaseService } from "../services/knowledgeBase";
import { AuthRequest } from "../middleware/auth";
import prisma from "../lib/prisma";

const router = Router();
// In a real app, you might inject this or use a factory
const aiService = new OpenAIService();
const kbService = new KnowledgeBaseService();

router.post("/generate", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { messages, context } = req.body;
    const tenantId = authReq.user?.tenantId;

    const aiConfig = tenantId
      ? await prisma.aiConfig.findUnique({
          where: { tenantId },
        })
      : null;

    // Extract the last user message to use as a search query
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m: any) => m.role === "user")?.content;

    let enhancedContext = context || "";

    // If we have a query and a tenant, search the Knowledge Base
    if (lastUserMessage && tenantId) {
      const kbResults = await kbService.search(lastUserMessage, tenantId, 15);
      if (kbResults.length > 0) {
        enhancedContext += `\n\nRELEVANT KNOWLEDGE BASE ARTICLES:\n${kbResults.join(
          "\n\n"
        )}`;
      }
    }

    const suggestion = await aiService.generateResponse(
      messages,
      enhancedContext,
      aiConfig?.systemPrompt,
      {
        tenantId: tenantId || undefined,
        userId: authReq.user?.userId,
        conversationId: req.body.conversationId,
      },
      { toneOfVoice: aiConfig?.toneOfVoice }
    );
    res.json({ suggestion });
  } catch (error) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

router.post("/sentiment", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const sentiment = await aiService.analyzeSentiment(text);
    res.json({ sentiment });
  } catch (error) {
    res.status(500).json({ error: "Failed to analyze sentiment" });
  }
});

router.post("/generate-greeting", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { agentName, businessDescription } = req.body;

    const prompt = `You are a professional greeting writer for AI voice assistants. 
Create a warm, professional, and concise phone greeting (2-3 sentences maximum) for an AI assistant named "${agentName}" who works for ${businessDescription}.

The greeting should:
- Be natural and conversational
- Welcome the caller warmly
- Introduce the AI assistant by name
- Briefly mention what they can help with
- End with an open question to encourage the caller to speak

Do not include quotation marks in your response. Just provide the greeting text itself.`;

    const response = await aiService.generateResponse(
      [{ role: "user", content: prompt }],
      "",
      undefined,
      {
        tenantId: authReq.user?.tenantId,
        userId: authReq.user?.userId,
      }
    );

    res.json({ greeting: response });
  } catch (error) {
    console.error("Failed to generate greeting:", error);
    res.status(500).json({ error: "Failed to generate greeting" });
  }
});

export default router;
