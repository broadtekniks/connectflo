import OpenAI from "openai";
import { AIService } from "./types";

export class OpenAIService implements AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateResponse(
    messages: { role: "user" | "assistant" | "system"; content: string }[],
    context?: string
  ): Promise<string> {
    try {
      const systemMessage = {
        role: "system" as const,
        content: `You are a helpful customer support AI assistant for ConnectFlo.
        ${context ? `Context about the customer: ${context}` : ""}
        Please provide a concise, helpful, and professional suggested response for the agent to send to the customer.
        Do not include "Subject:" or other metadata, just the message body.`,
      };


      const completion = await this.openai.chat.completions.create({
        messages: [systemMessage, ...messages],
        model: "gpt-3.5-turbo",
      });

      return (
        completion.choices[0].message.content ||
        "I couldn't generate a suggestion at this time."
      );
    } catch (error) {
      console.error(
        "OpenAI API Error Details:",
        JSON.stringify(error, null, 2)
      );
      if (error instanceof Error) {
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
      }
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
}
