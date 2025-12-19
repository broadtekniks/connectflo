import OpenAI from "openai";
import { AIService } from "./types";
import { usageService } from "../usage";

export class OpenAIService implements AIService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[OpenAI] No API key found in environment!");
    }
    this.openai = new OpenAI({
      apiKey,
    });
  }

  async generateResponse(
    messages: { role: "user" | "assistant" | "system"; content: string }[],
    context?: string,
    systemPrompt?: string,
    metadata?: { tenantId?: string; userId?: string; conversationId?: string }
  ): Promise<string> {
    try {
      const defaultPrompt = `You are a helpful customer support AI assistant for ConnectFlo.`;
      const basePrompt = systemPrompt || defaultPrompt;

      const systemMessage = {
        role: "system" as const,
        content: `${basePrompt}
        
        ${context ? `CONTEXT:\n${context}` : ""}
        
        INSTRUCTIONS:
        1. You are a helpful customer support AI assistant.
        2. CRITICAL: If there is a CONTEXT section above, READ IT THOROUGHLY - it contains relevant information from the knowledge base.
        3. If the CONTEXT discusses the topic being asked about, YOU MUST USE THAT INFORMATION to answer.
        4. Review the conversation history - if you already answered this question, acknowledge it naturally (e.g., "As I mentioned..." or "To reiterate...") then provide the answer again, perhaps with additional detail or a different angle.
        5. Provide detailed, comprehensive answers using all relevant information from the CONTEXT.
        6. When asked about features, benefits, or "tell me about", give complete explanations from the CONTEXT.
        7. Rephrase CONTEXT information naturally and conversationally - explain it clearly to the user.
        8. ONLY say "I don't have enough information" if the CONTEXT is empty OR genuinely contains nothing about the specific topic.
        9. DO NOT refuse to answer when the CONTEXT has relevant information - your job is to help!
        10. Be thorough - users want complete answers, not deflections.`,
      };

      const completion = await this.openai.chat.completions.create({
        messages: [systemMessage, ...messages],
        model: "gpt-3.5-turbo",
      });

      const response =
        completion.choices[0].message.content ||
        "I couldn't generate a suggestion at this time.";

      // Track token usage
      if (metadata?.tenantId && completion.usage) {
        await usageService
          .trackAITokens({
            tenantId: metadata.tenantId,
            userId: metadata.userId,
            model: "gpt-3.5-turbo",
            inputTokens: completion.usage.prompt_tokens,
            outputTokens: completion.usage.completion_tokens,
            conversationId: metadata.conversationId,
          })
          .catch((err) =>
            console.error("Failed to track AI token usage:", err)
          );
      }

      return response;
    } catch (error) {
      console.error(
        "OpenAI API Error:",
        error instanceof Error ? error.message : error
      );
      return "Error generating suggestion. Please check API configuration.";
    }
  }

  async analyzeSentiment(
    text: string
  ): Promise<"POSITIVE" | "NEUTRAL" | "NEGATIVE"> {
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "Analyze the sentiment of the following text. Respond ONLY with one of these words: POSITIVE, NEUTRAL, NEGATIVE.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        model: "gpt-3.5-turbo",
      });

      const sentiment = completion.choices[0].message.content
        ?.trim()
        .toUpperCase();
      if (sentiment === "POSITIVE" || sentiment === "NEGATIVE") {
        return sentiment;
      }
      return "NEUTRAL";
    } catch (error) {
      console.error("OpenAI Sentiment Analysis Error:", error);
      return "NEUTRAL";
    }
  }

  async getEmbeddings(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("OpenAI Embeddings Error:", error);
      throw error;
    }
  }
}
