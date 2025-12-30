export interface AIService {
  generateResponse(
    messages: { role: "user" | "assistant" | "system"; content: string }[],
    context?: string,
    systemPrompt?: string,
    metadata?: { tenantId?: string; userId?: string; conversationId?: string },
    options?: { toneOfVoice?: string }
  ): Promise<string>;
  analyzeSentiment(text: string): Promise<"POSITIVE" | "NEUTRAL" | "NEGATIVE">;
  getEmbeddings(text: string): Promise<number[]>;
}
