import { Router, Request, Response } from "express";
import { OpenAIService } from "../services/ai/openai";
import { KnowledgeBaseService } from "../services/knowledgeBase";
import { AuthRequest } from "../middleware/auth";

const router = Router();
// In a real app, you might inject this or use a factory
const aiService = new OpenAIService();
const kbService = new KnowledgeBaseService();

router.post("/generate", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { messages, context } = req.body;
    const tenantId = authReq.user?.tenantId;

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
      undefined,
      {
        tenantId: tenantId || undefined,
        userId: authReq.user?.userId,
        conversationId: req.body.conversationId,
      }
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

export default router;
