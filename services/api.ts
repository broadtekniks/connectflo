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

const handleAuthFailureIfNeeded = (status: number, message: string) => {
  const normalized = (message || "").toLowerCase();
  const shouldRelog =
    status === 401 ||
    status === 403 ||
    normalized.includes("please log in again") ||
    normalized.includes("tenant not found");

  if (!shouldRelog) return;

  localStorage.removeItem("token");
  localStorage.removeItem("user");

  // This app uses URL-based deep links + internal view mapping.
  // A hard navigation ensures the app re-initializes into the Login view.
  if (!window.location.pathname.toLowerCase().startsWith("/login")) {
    window.location.assign("/login");
  }
};

export const api = {
  twilio: {
    getVoiceToken: async (): Promise<{ token: string; identity: string }> => {
      const response = await fetch(`${API_URL}/twilio/voice-token`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to fetch Twilio voice token";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },
  },

  me: {
    getProfile: async (): Promise<{
      timeZone: string | null;
    }> => {
      const response = await fetch(`${API_URL}/me/profile`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },

    setTimeZone: async (
      timeZone: string | null
    ): Promise<{
      timeZone: string | null;
    }> => {
      const response = await fetch(`${API_URL}/me/profile`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ timeZone }),
      });
      if (!response.ok) throw new Error("Failed to update time zone");
      return response.json();
    },

    getSchedule: async (): Promise<{
      agentTimeZone: string | null;
      workingHours: null | Record<
        string,
        { start: string; end: string } | null
      >;
    }> => {
      const response = await fetch(`${API_URL}/me/schedule`, {
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to fetch schedule";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },

    setSchedule: async (data: {
      agentTimeZone: string | null;
      workingHours: null | Record<
        string,
        { start: string; end: string } | null
      >;
    }): Promise<{
      agentTimeZone: string | null;
      workingHours: null | Record<
        string,
        { start: string; end: string } | null
      >;
    }> => {
      const response = await fetch(`${API_URL}/me/schedule`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        let message = "Failed to update schedule";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },

    getCallerId: async (): Promise<{
      phoneNumberId: string | null;
      phoneNumber: { id: string; number: string; friendlyName: string } | null;
    }> => {
      const response = await fetch(`${API_URL}/me/caller-id`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch caller ID");
      return response.json();
    },

    setCallerId: async (
      phoneNumberId: string | null
    ): Promise<{
      phoneNumberId: string | null;
    }> => {
      const response = await fetch(`${API_URL}/me/caller-id`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ phoneNumberId }),
      });
      if (!response.ok) throw new Error("Failed to update caller ID");
      return response.json();
    },
  },

  agents: {
    me: async (): Promise<{
      isCheckedIn: boolean;
      checkedInAt: string | null;
    }> => {
      const response = await fetch(`${API_URL}/agents/me`, {
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to fetch agent status";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },

    checkIn: async (): Promise<{
      isCheckedIn: boolean;
      checkedInAt: string | null;
    }> => {
      const response = await fetch(`${API_URL}/agents/check-in`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to check in";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },

    checkOut: async (): Promise<{
      isCheckedIn: boolean;
      checkedInAt: string | null;
    }> => {
      const response = await fetch(`${API_URL}/agents/check-out`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to check out";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },
  },

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

    claimNext: async (): Promise<{ claimed: Conversation | null }> => {
      const response = await fetch(`${API_URL}/conversations/claim-next`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to claim next conversation";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
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

    getBusinessHours: async (): Promise<{
      timeZone: string | null;
      businessHours: any;
      calendarAutoAddMeet?: boolean;
      maxMeetingDurationMinutes?: number;
      chatAfterHoursMode: "ONLY_ON_ESCALATION" | "ALWAYS" | "NEVER";
      chatAfterHoursMessage: string | null;
    }> => {
      const response = await fetch(`${API_URL}/tenants/me/business-hours`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch business hours");
      return response.json();
    },

    setBusinessHours: async (data: {
      timeZone: string | null;
      businessHours: any;
      calendarAutoAddMeet?: boolean;
      maxMeetingDurationMinutes?: number;
      chatAfterHoursMode: "ONLY_ON_ESCALATION" | "ALWAYS" | "NEVER";
      chatAfterHoursMessage: string | null;
    }): Promise<{
      timeZone: string | null;
      businessHours: any;
      calendarAutoAddMeet?: boolean;
      maxMeetingDurationMinutes?: number;
      chatAfterHoursMode: "ONLY_ON_ESCALATION" | "ALWAYS" | "NEVER";
      chatAfterHoursMessage: string | null;
    }> => {
      const response = await fetch(`${API_URL}/tenants/me/business-hours`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update business hours");
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

    getBusinessTimeZone: async (): Promise<{ timeZone: string | null }> => {
      const response = await fetch(`${API_URL}/tenants/me/business-timezone`, {
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to fetch tenant timezone";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },

    getWebPhoneSettings: async (): Promise<{
      webPhoneEnabled: boolean;
      webPhoneOutboundCallerNumber: string | null;
      webPhoneOutboundCallerName: string | null;
    }> => {
      const response = await fetch(`${API_URL}/tenants/me/web-phone-settings`, {
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to fetch web phone settings";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },

    setWebPhoneSettings: async (data: {
      webPhoneEnabled?: boolean;
      webPhoneOutboundCallerNumber?: string | null;
      webPhoneOutboundCallerName?: string | null;
    }): Promise<{
      webPhoneEnabled: boolean;
      webPhoneOutboundCallerNumber: string | null;
      webPhoneOutboundCallerName: string | null;
    }> => {
      const response = await fetch(`${API_URL}/tenants/me/web-phone-settings`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        let message = "Failed to update web phone settings";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },
  },

  customers: {
    list: async (): Promise<
      Array<{
        id: string;
        name: string;
        email: string;
        avatar?: string;
        role: "CUSTOMER";
        tenantId?: string;
        createdAt: string;
      }>
    > => {
      const response = await fetch(`${API_URL}/customers`, {
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to fetch customers";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },
  },

  teamMembers: {
    list: async (): Promise<
      Array<{
        id: string;
        name: string | null;
        email: string;
        avatar?: string | null;
        role: "TENANT_ADMIN" | "AGENT";
        tenantId?: string;
        createdAt: string;
        isCheckedIn: boolean;
        checkedInAt: string | null;
        agentTimeZone?: string | null;
        workingHours?: null | Record<
          string,
          { start: string; end: string } | null
        >;
        forwardingPhoneNumber?: string | null;
      }>
    > => {
      const response = await fetch(`${API_URL}/team-members`, {
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to fetch team members";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },

    updateForwardingNumber: async (
      id: string,
      data: {
        forwardingPhoneNumber: string | null;
      }
    ): Promise<{
      id: string;
      forwardingPhoneNumber: string | null;
    }> => {
      const response = await fetch(
        `${API_URL}/team-members/${id}/forwarding-number`,
        {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) {
        let message = "Failed to update forwarding number";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },

    updateSchedule: async (
      id: string,
      data: {
        agentTimeZone: string | null;
        workingHours: null | Record<
          string,
          { start: string; end: string } | null
        >;
      }
    ): Promise<{
      id: string;
      agentTimeZone: string | null;
      workingHours: any;
    }> => {
      const response = await fetch(`${API_URL}/team-members/${id}/schedule`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        let message = "Failed to update schedule";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
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
    googleAuth: async (credential: string, companyName?: string) => {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, companyName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw data;
      }
      return data;
    },
  },

  security: {
    sendPhoneVerification: async () => {
      const response = await fetch(`${API_URL}/auth/send-phone-verification`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send verification code");
      }
      return response.json();
    },
    verifyPhone: async (code: string) => {
      const response = await fetch(`${API_URL}/auth/verify-phone`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to verify phone");
      }
      return response.json();
    },
    setupMFA: async () => {
      const response = await fetch(`${API_URL}/auth/mfa/setup`, {
        method: "POST",
        headers: authHeader(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to setup MFA");
      }
      return response.json();
    },
    verifyMFASetup: async (code: string) => {
      const response = await fetch(`${API_URL}/auth/mfa/verify-setup`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to verify MFA setup");
      }
      return response.json();
    },
    verifyMFA: async (code: string) => {
      const response = await fetch(`${API_URL}/auth/mfa/verify`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to verify MFA code");
      }
      return response.json();
    },
    disableMFA: async (code: string) => {
      const response = await fetch(`${API_URL}/auth/mfa/disable`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disable MFA");
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

    updateAfterHours: async (
      numberId: string,
      data: {
        afterHoursMode: "VOICEMAIL" | "AI_WORKFLOW";
        afterHoursWorkflowId: string | null;
        afterHoursMessage: string | null;
        afterHoursNotifyUserId: string | null;
      }
    ): Promise<PhoneNumber> => {
      const response = await fetch(
        `${API_URL}/phone-numbers/${numberId}/after-hours`,
        {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify(data),
        }
      );
      if (!response.ok)
        throw new Error("Failed to update after-hours settings");
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

    agent: async (): Promise<{
      assignedActiveConversations: number;
      assignedOpenConversations: number;
      assignedPendingConversations: number;
      resolvedToday: number;
      agentMessagesToday: number;
      voiceCallsToday: number;
      voiceMinutesToday: number;
      isCheckedIn: boolean;
      checkedInAt: string | null;
    }> => {
      const response = await fetch(`${API_URL}/metrics/agent`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch agent metrics");
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
    if (!response.ok) {
      let message = `GET ${endpoint} failed`;
      try {
        const err = await response.json();
        if (err?.error) message = String(err.error);
      } catch {
        // ignore
      }

      handleAuthFailureIfNeeded(response.status, message);
      throw new Error(message);
    }
    return response.json();
  },

  getBlob: async (endpoint: string) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: authHeader(),
    });
    if (!response.ok) {
      let message = `GET ${endpoint} failed`;
      try {
        const err = await response.json();
        if (err?.error) message = String(err.error);
      } catch {
        // ignore
      }

      handleAuthFailureIfNeeded(response.status, message);
      throw new Error(message);
    }
    return response.blob();
  },

  post: async (endpoint: string, data?: any) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: authHeader(),
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      let message = `POST ${endpoint} failed`;
      try {
        const err = await response.json();
        if (err?.error) message = String(err.error);
      } catch {
        // ignore
      }

      handleAuthFailureIfNeeded(response.status, message);
      throw new Error(message);
    }
    return response.json();
  },

  put: async (endpoint: string, data?: any) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "PUT",
      headers: authHeader(),
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      let message = `PUT ${endpoint} failed`;
      try {
        const err = await response.json();
        if (err?.error) message = String(err.error);
      } catch {
        // ignore
      }

      handleAuthFailureIfNeeded(response.status, message);
      throw new Error(message);
    }
    return response.json();
  },

  delete: async (endpoint: string) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "DELETE",
      headers: authHeader(),
    });
    if (!response.ok) {
      let message = `DELETE ${endpoint} failed`;
      try {
        const err = await response.json();
        if (err?.error) message = String(err.error);
      } catch {
        // ignore
      }

      handleAuthFailureIfNeeded(response.status, message);
      throw new Error(message);
    }
    return response.json();
  },

  meetings: {
    list: async (): Promise<{
      meetings: Array<{
        id: string;
        summary: string;
        startTime: string;
        endTime: string;
        htmlLink?: string;
        attendees: string[];
        customer?: {
          id: string;
          name: string;
          email: string;
          avatar?: string;
        };
      }>;
      connected: boolean;
      total: number;
      message?: string;
    }> => {
      const response = await fetch(`${API_URL}/meetings`, {
        headers: authHeader(),
      });
      if (!response.ok) {
        let message = "Failed to fetch meetings";
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
        } catch {
          // ignore
        }
        handleAuthFailureIfNeeded(response.status, message);
        throw new Error(message);
      }
      return response.json();
    },
  },

  appointmentLogs: {
    list: async (params?: {
      status?: string;
      source?: string;
    }): Promise<{
      appointmentLogs: Array<{
        id: string;
        customerName: string;
        customerEmail: string | null;
        customerPhone: string | null;
        appointmentTime: string;
        durationMinutes: number;
        status: string;
        eventId: string | null;
        source: string;
        notes: string | null;
        createdAt: string;
        customer?: {
          id: string;
          name: string;
          email: string;
          phone: string;
        };
      }>;
      total: number;
    }> => {
      const queryParams = new URLSearchParams(params as any).toString();
      const url = `${API_URL}/appointment-logs${
        queryParams ? `?${queryParams}` : ""
      }`;
      const response = await fetch(url, { headers: authHeader() });
      if (!response.ok) throw new Error("Failed to fetch appointment logs");
      return response.json();
    },
    updateStatus: async (id: string, status: string) => {
      const response = await fetch(`${API_URL}/appointment-logs/${id}/status`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update appointment status");
      return response.json();
    },
  },

  leads: {
    list: async (params?: {
      status?: string;
      source?: string;
    }): Promise<{
      leads: Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        source: string;
        status: string;
        notes: string | null;
        spreadsheetId: string | null;
        createdAt: string;
        customer?: {
          id: string;
          name: string;
          email: string;
          phone: string;
        };
      }>;
      total: number;
    }> => {
      const queryParams = new URLSearchParams(params as any).toString();
      const url = `${API_URL}/leads${queryParams ? `?${queryParams}` : ""}`;
      const response = await fetch(url, { headers: authHeader() });
      if (!response.ok) throw new Error("Failed to fetch leads");
      return response.json();
    },
    updateStatus: async (id: string, status: string) => {
      const response = await fetch(`${API_URL}/leads/${id}/status`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update lead status");
      return response.json();
    },
  },

  callLogs: {
    list: async (params?: {
      direction?: string;
      status?: string;
    }): Promise<{
      callLogs: Array<{
        id: string;
        callSid: string;
        direction: string;
        from: string;
        to: string;
        status: string;
        durationSeconds: number | null;
        recordingUrl: string | null;
        transcriptSummary: string | null;
        sentiment: string | null;
        outcome: string | null;
        createdAt: string;
        customer?: {
          id: string;
          name: string;
          email: string;
          phone: string;
        };
        phoneNumber?: {
          id: string;
          number: string;
        };
      }>;
      total: number;
    }> => {
      const queryParams = new URLSearchParams(params as any).toString();
      const url = `${API_URL}/call-logs${queryParams ? `?${queryParams}` : ""}`;
      const response = await fetch(url, { headers: authHeader() });
      if (!response.ok) throw new Error("Failed to fetch call logs");
      return response.json();
    },
  },

  feedbackLogs: {
    list: async (params?: {
      sentiment?: string;
      category?: string;
      minRating?: number;
    }): Promise<{
      feedbackLogs: Array<{
        id: string;
        rating: number | null;
        sentiment: string | null;
        category: string | null;
        feedback: string;
        source: string;
        createdAt: string;
        customer?: {
          id: string;
          name: string;
          email: string;
          phone: string;
        };
      }>;
      total: number;
      averageRating: number;
    }> => {
      const queryParams = new URLSearchParams(params as any).toString();
      const url = `${API_URL}/feedback-logs${
        queryParams ? `?${queryParams}` : ""
      }`;
      const response = await fetch(url, { headers: authHeader() });
      if (!response.ok) throw new Error("Failed to fetch feedback logs");
      return response.json();
    },
    analytics: async (): Promise<{
      totalCount: number;
      averageRating: number;
      sentimentBreakdown: Array<{ sentiment: string; _count: number }>;
      categoryBreakdown: Array<{ category: string; _count: number }>;
    }> => {
      const response = await fetch(`${API_URL}/feedback-logs/analytics`, {
        headers: authHeader(),
      });
      if (!response.ok) throw new Error("Failed to fetch feedback analytics");
      return response.json();
    },
    submit: async (data: {
      conversationId?: string;
      customerId?: string;
      rating: number | null;
      sentiment?: string | null;
      category?: string | null;
      feedback: string;
      source?: string;
      metadata?: any;
    }): Promise<{
      message: string;
      feedbackId: string;
    }> => {
      const response = await fetch(`${API_URL}/feedback-logs`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to submit feedback");
      return response.json();
    },
  },
};
