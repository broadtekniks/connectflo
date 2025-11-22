export interface AIService {
  generateResponse(
    messages: { role: "user" | "assistant" | "system"; content: string }[],
    context?: string
  ): Promise<string>;
  analyzeSentiment(text: string): Promise<"POSITIVE" | "NEUTRAL" | "NEGATIVE">;
}
