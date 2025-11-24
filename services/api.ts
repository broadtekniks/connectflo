import { Conversation, Message, PhoneNumber } from "../types";

const API_URL = "http://localhost:3002/api";

export const api = {
  conversations: {
    list: async (): Promise<Conversation[]> => {
      const response = await fetch(`${API_URL}/conversations`);
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },

    get: async (id: string): Promise<Conversation> => {
      const response = await fetch(`${API_URL}/conversations/${id}`);
      console.log("Response: ", response);
      if (!response.ok) throw new Error("Failed to fetch conversation");
      return response.json();
    },

    create: async (data: Partial<Conversation>): Promise<Conversation> => {
      const response = await fetch(`${API_URL}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
  },

  messages: {
    send: async (
      conversationId: string,
      content: string,
      sender: string,
      isPrivateNote: boolean = false
    ): Promise<Message> => {
      const response = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content,
          sender,
          isPrivateNote,
        }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
  },

  ai: {
    generateResponse: async (
      messages: { role: string; content: string }[],
      context?: string
    ): Promise<string> => {
      const response = await fetch(`${API_URL}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, context }),
      });
      if (!response.ok) throw new Error("Failed to generate AI response");
      const data = await response.json();
      return data.suggestion;
    },
    analyzeSentiment: async (
      text: string
    ): Promise<"POSITIVE" | "NEUTRAL" | "NEGATIVE"> => {
      const response = await fetch(`${API_URL}/ai/sentiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) return "NEUTRAL";
      const data = await response.json();
      return data.sentiment;
    },
  },

  phoneNumbers: {
    list: async (): Promise<PhoneNumber[]> => {
      const response = await fetch(`${API_URL}/phone-numbers`);
      if (!response.ok) throw new Error("Failed to fetch phone numbers");
      return response.json();
    },
    search: async (country: string, region?: string): Promise<any[]> => {
      const params = new URLSearchParams({ country });
      if (region) params.append("region", region);

      const response = await fetch(`${API_URL}/phone-numbers/search?${params}`);
      if (!response.ok) throw new Error("Failed to search phone numbers");
      return response.json();
    },
    purchase: async (
      phoneNumber: string,
      friendlyName?: string
    ): Promise<PhoneNumber> => {
      const response = await fetch(`${API_URL}/phone-numbers/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, friendlyName }),
      });
      if (!response.ok) throw new Error("Failed to purchase phone number");
      return response.json();
    },
  },

  workflows: {
    list: async (): Promise<any[]> => {
      const response = await fetch(`${API_URL}/workflows`);
      if (!response.ok) throw new Error("Failed to fetch workflows");
      return response.json();
    },
    create: async (data: any): Promise<any> => {
      const response = await fetch(`${API_URL}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create workflow");
      return response.json();
    },
    update: async (id: string, data: any): Promise<any> => {
      const response = await fetch(`${API_URL}/workflows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update workflow");
      return response.json();
    },
    simulate: async (triggerType: string, context: any): Promise<any> => {
      const response = await fetch(`${API_URL}/workflows/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType, context }),
      });
      if (!response.ok) throw new Error("Failed to simulate workflow");
      return response.json();
    },
  },
};
