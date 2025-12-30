import { Conversation, Message, PhoneNumber, User, Plan } from "../types";

interface UsageSummary {
  voice: {
    inbound: { minutes: number; calls: number; cost: number };
    outbound: { minutes: number; calls: number; cost: number };
    total: { minutes: number; calls: number; cost: number };
  };
  sms: {
    inbound: { messages: number; cost: number };
    outbound: { messages: number; cost: number };
    total: { messages: number; cost: number };
  };
  ai: {
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requests: number;
  };
  totalCost: number;
  totalWholesaleCost: number;
  totalMargin: number;
}

const API_URL = "http://localhost:3002/api";

const authHeader = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  conversations: {
    list: async (): Promise<Conversation[]> => {
      const response = await fetch(`${API_URL}/conversations`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },

    get: async (id: string): Promise<Conversation> => {
      const response = await fetch(`${API_URL}/conversations/${id}`, {
        headers: authHeader(),
      });
      console.log("Response: ", response);
      if (!response.ok) throw new Error("Failed to fetch conversation");
      return response.json();
    },

    create: async (data: Partial<Conversation>): Promise<Conversation> => {
      const response = await fetch(`${API_URL}/conversations`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },

    update: async (
      id: string,
      data: Partial<Conversation>
    ): Promise<Conversation> => {
      const response = await fetch(`${API_URL}/conversations/${id}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update conversation");
      return response.json();
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_URL}/conversations/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to delete conversation");
    },
  },

  tenants: {
    list: async (): Promise<any[]> => {
      const response = await fetch(`${API_URL}/tenants`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch tenants");
      return response.json();
    },
    get: async (id: string): Promise<any> => {
      const response = await fetch(`${API_URL}/tenants/${id}`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch tenant");
      return response.json();
    },
    create: async (data: {
      name: string;
      plan?: string;
      status?: string;
    }): Promise<any> => {
      const response = await fetch(`${API_URL}/tenants`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create tenant");
      return response.json();
    },
    createTestCustomer: async (
      tenantId: string
    ): Promise<{ user: any; token: string }> => {
      const response = await fetch(`${API_URL}/tenants/test-customer`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ tenantId }),
      });
      if (!response.ok) throw new Error("Failed to create test customer");
      return response.json();
    },
  },

  aiConfig: {
    get: async (): Promise<any> => {
      const response = await fetch(`${API_URL}/ai-config`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch AI config");
      return response.json();
    },
    update: async (data: any): Promise<any> => {
      const response = await fetch(`${API_URL}/ai-config`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update AI config");
      return response.json();
    },
  },

  auth: {
    register: async (data: any) => {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }
      return response.json();
    },
    login: async (data: any) => {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }
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
        headers: authHeader(),
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
        headers: {
          ...authHeader(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
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
        headers: authHeader(),
        body: JSON.stringify({ text }),
      });
      if (!response.ok) return "NEUTRAL";
      const data = await response.json();
      return data.sentiment;
    },
  },

  phoneNumbers: {
    list: async (): Promise<PhoneNumber[]> => {
      const response = await fetch(`${API_URL}/phone-numbers`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch phone numbers");
      return response.json();
    },
    search: async (
      country: string,
      region?: string,
      provider?: string
    ): Promise<any[]> => {
      const params = new URLSearchParams({ country });
      if (region) params.append("region", region);
      if (provider) params.append("provider", provider);

      const response = await fetch(
        `${API_URL}/phone-numbers/search?${params}`,
        {
          headers: authHeader(),
        }
      );
      if (!response.ok) throw new Error("Failed to search phone numbers");
      return response.json();
    },
    purchase: async (
      phoneNumber: string,
      friendlyName?: string,
      provider?: string
    ): Promise<PhoneNumber> => {
      const response = await fetch(`${API_URL}/phone-numbers/purchase`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ phoneNumber, friendlyName, provider }),
      });
      if (!response.ok) throw new Error("Failed to purchase phone number");
      return response.json();
    },
    sync: async (): Promise<{
      message: string;
      synced: number;
      skipped: number;
      numbers: PhoneNumber[];
    }> => {
      const response = await fetch(`${API_URL}/phone-numbers/sync`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to sync numbers");
      return response.json();
    },
    updateRegions: async (): Promise<{
      message: string;
      updated: number;
      failed: number;
    }> => {
      const response = await fetch(`${API_URL}/phone-numbers/update-regions`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to update regions");
      return response.json();
    },
    assign: async (numberId: string, userId: string): Promise<PhoneNumber> => {
      const response = await fetch(
        `${API_URL}/phone-numbers/${numberId}/assign`,
        {
          method: "POST",
          headers: authHeader(),
          body: JSON.stringify({ userId }),
        }
      );
      if (!response.ok) throw new Error("Failed to assign phone number");
      return response.json();
    },
    unassign: async (numberId: string): Promise<PhoneNumber> => {
      const response = await fetch(
        `${API_URL}/phone-numbers/${numberId}/unassign`,
        {
          method: "POST",
          headers: authHeader(),
        }
      );
      if (!response.ok) throw new Error("Failed to unassign phone number");
      return response.json();
    },
    assignToTenant: async (
      numberId: string,
      tenantId: string
    ): Promise<PhoneNumber> => {
      const response = await fetch(
        `${API_URL}/phone-numbers/${numberId}/assign-tenant`,
        {
          method: "POST",
          headers: authHeader(),
          body: JSON.stringify({ tenantId }),
        }
      );
      if (!response.ok)
        throw new Error("Failed to assign phone number to tenant");
      return response.json();
    },
    testCall: async (
      numberId: string,
      toNumber: string
    ): Promise<{ success: boolean; message: string; callId?: string }> => {
      const response = await fetch(
        `${API_URL}/phone-numbers/${numberId}/test-call`,
        {
          method: "POST",
          headers: authHeader(),
          body: JSON.stringify({ toNumber }),
        }
      );
      if (!response.ok) throw new Error("Failed to initiate test call");
      return response.json();
    },
    testSMS: async (
      numberId: string,
      toNumber: string,
      message: string
    ): Promise<{ success: boolean; message: string; messageId?: string }> => {
      const response = await fetch(
        `${API_URL}/phone-numbers/${numberId}/test-sms`,
        {
          method: "POST",
          headers: authHeader(),
          body: JSON.stringify({ toNumber, message }),
        }
      );
      if (!response.ok) throw new Error("Failed to send test SMS");
      return response.json();
    },
  },

  workflows: {
    list: async (): Promise<any[]> => {
      const response = await fetch(`${API_URL}/workflows`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch workflows");
      return response.json();
    },
    create: async (data: any): Promise<any> => {
      const response = await fetch(`${API_URL}/workflows`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create workflow");
      return response.json();
    },
    update: async (id: string, data: any): Promise<any> => {
      const response = await fetch(`${API_URL}/workflows/${id}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update workflow");
      return response.json();
    },
    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_URL}/workflows/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to delete workflow");
    },
    simulate: async (triggerType: string, context: any): Promise<any> => {
      const response = await fetch(`${API_URL}/workflows/simulate`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ triggerType, context }),
      });
      if (!response.ok) throw new Error("Failed to simulate workflow");
      return response.json();
    },
  },

  knowledgeBase: {
    list: async () => {
      const response = await fetch(`${API_URL}/knowledge-base`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
    upload: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("token");
      const headers: any = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_URL}/knowledge-base/upload`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload document");
      return response.json();
    },
    delete: async (id: string) => {
      const response = await fetch(`${API_URL}/knowledge-base/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to delete document");
      return response.json();
    },
    getPreviewUrl: async (id: string): Promise<string> => {
      const response = await fetch(`${API_URL}/knowledge-base/${id}/preview`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to get preview URL");
      const data = await response.json();
      return data.url;
    },
    reprocess: async (id: string) => {
      const response = await fetch(
        `${API_URL}/knowledge-base/${id}/reprocess`,
        {
          method: "POST",
          headers: authHeader(),
        }
      );
      if (!response.ok) throw new Error("Failed to reprocess document");
      return response.json();
    },
  },

  metrics: {
    get: async () => {
      const response = await fetch(`${API_URL}/metrics`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch metrics");
      return response.json();
    },
  },

  users: {
    list: async (): Promise<User[]> => {
      const response = await fetch(`${API_URL}/users`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  },

  plans: {
    list: async (): Promise<Plan[]> => {
      const response = await fetch(`${API_URL}/plans`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    },
    get: async (id: string): Promise<Plan> => {
      const response = await fetch(`${API_URL}/plans/${id}`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch plan");
      return response.json();
    },
    create: async (data: Partial<Plan>): Promise<Plan> => {
      const response = await fetch(`${API_URL}/plans`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create plan");
      return response.json();
    },
    update: async (id: string, data: Partial<Plan>): Promise<Plan> => {
      const response = await fetch(`${API_URL}/plans/${id}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update plan");
      return response.json();
    },
    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_URL}/plans/${id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to delete plan");
    },
  },

  usage: {
    getSummary: async (
      startDate?: Date,
      endDate?: Date
    ): Promise<UsageSummary> => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());

      const response = await fetch(
        `${API_URL}/usage/summary?${params.toString()}`,
        {
          headers: authHeader(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch usage summary");
      return response.json();
    },
    getRecords: async (
      options: {
        startDate?: Date;
        endDate?: Date;
        type?: string;
        limit?: number;
        offset?: number;
      } = {}
    ) => {
      const params = new URLSearchParams();
      if (options.startDate)
        params.append("startDate", options.startDate.toISOString());
      if (options.endDate)
        params.append("endDate", options.endDate.toISOString());
      if (options.type) params.append("type", options.type);
      if (options.limit) params.append("limit", options.limit.toString());
      if (options.offset) params.append("offset", options.offset.toString());

      const response = await fetch(
        `${API_URL}/usage/records?${params.toString()}`,
        {
          headers: authHeader(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch usage records");
      return response.json();
    },
    getBreakdown: async (startDate?: Date, endDate?: Date) => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());

      const response = await fetch(
        `${API_URL}/usage/breakdown?${params.toString()}`,
        {
          headers: authHeader(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch usage breakdown");
      return response.json();
    },
  },

  voiceConfig: {
    getVoices: async () => {
      const response = await fetch(`${API_URL}/voice-config/voices`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch voices");
      return response.json();
    },
    getPreference: async (tenantId: string) => {
      const response = await fetch(
        `${API_URL}/voice-config/preference/${tenantId}`,
        {
          headers: authHeader(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch voice preference");
      return response.json();
    },
    setPreference: async (data: {
      tenantId: string;
      voice: string;
      language: string;
    }) => {
      const response = await fetch(`${API_URL}/voice-config/preference`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to set voice preference");
      return response.json();
    },
    testVoice: async (data: {
      phoneNumber: string;
      voice: string;
      language: string;
      testMessage: string;
    }) => {
      const response = await fetch(`${API_URL}/voice-config/test`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to test voice");
      return response.json();
    },
  },

  // Helper methods for direct HTTP calls
  get: async (endpoint: string) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: authHeader(),
    });
    if (!response.ok) throw new Error(`GET ${endpoint} failed`);
    return response.json();
  },

  post: async (endpoint: string, data?: any) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: authHeader(),
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) throw new Error(`POST ${endpoint} failed`);
    return response.json();
  },
};
