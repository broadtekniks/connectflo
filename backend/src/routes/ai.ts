import { Router, Request, Response } from "express";
import { OpenAIService } from "../services/ai/openai";

const router = Router();
// In a real app, you might inject this or use a factory
const aiService = new OpenAIService();

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { messages, context } = req.body;
    const suggestion = await aiService.generateResponse(messages, context);
    res.json({ suggestion });
  } catch (error) {
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
