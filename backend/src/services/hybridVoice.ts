import { realtimeVoiceService } from "./ai/realtimeVoice";
import { TelnyxService } from "./telnyx";
import prisma from "../lib/prisma";
import { applyToneOfVoiceToSystemPrompt } from "./ai/toneOfVoice";
import { detectIntentFromConfiguredIntents } from "./intents/detectIntent";

const telnyxService = new TelnyxService();

function normalizeGreeting(raw: string, agentName?: string): string {
  const fallback = `Hello! This is ${
    agentName || "your assistant"
  }. How may I help you today?`;
  const text = (raw || "").replace(/\s+/g, " ").trim();
  const base = text.length ? text : fallback;

  // Keep greetings short for voice calls: at most 2 sentences and 220 chars.
  const maxSentences = 2;
  const maxChars = 220;

  const sentenceParts = base
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let shortened = sentenceParts.slice(0, maxSentences).join(" ");
  if (!shortened) shortened = base;
  if (shortened.length > maxChars)
    shortened = shortened.slice(0, maxChars).trim();

  return shortened;
}

/**
 * Hybrid Voice Service
 * Uses OpenAI Realtime for intelligence but Telnyx TTS/STT for audio I/O
 * This is a workaround until Telnyx supports bidirectional media streaming
 */

interface HybridSession {
  sessionId: string;
  callControlId: string;
  tenantId: string;
  workflowId?: string;
  isListening: boolean;
  conversationHistory: Array<{ role: string; content: string }>;
  voice: string;
  language: string;
  systemPrompt: string;
  intents?: unknown;
  detectedIntent?: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  language: string;
  description: string;
}

// Available Telnyx TTS voices
export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: "female",
    name: "Female (US English)",
    gender: "female",
    language: "en-US",
    description: "Standard female voice, clear and professional",
  },
  {
    id: "male",
    name: "Male (US English)",
    gender: "male",
    language: "en-US",
    description: "Standard male voice, warm and authoritative",
  },
  {
    id: "Polly.Joanna",
    name: "Joanna (Neural)",
    gender: "female",
    language: "en-US",
    description: "Natural-sounding neural voice, friendly and conversational",
  },
  {
    id: "Polly.Matthew",
    name: "Matthew (Neural)",
    gender: "male",
    language: "en-US",
    description: "Natural-sounding neural voice, confident and clear",
  },
  {
    id: "Polly.Amy",
    name: "Amy (British)",
    gender: "female",
    language: "en-GB",
    description: "British English accent, sophisticated",
  },
  {
    id: "Polly.Emma",
    name: "Emma (British, Neural)",
    gender: "female",
    language: "en-GB",
    description: "British English accent, natural and expressive",
  },
  {
    id: "Polly.Brian",
    name: "Brian (British)",
    gender: "male",
    language: "en-GB",
    description: "British English accent, professional",
  },
  {
    id: "Polly.Russell",
    name: "Russell (Australian)",
    gender: "male",
    language: "en-AU",
    description: "Australian English accent, friendly",
  },
  {
    id: "Polly.Nicole",
    name: "Nicole (Australian)",
    gender: "female",
    language: "en-AU",
    description: "Australian English accent, warm",
  },
];

class HybridVoiceService {
  private sessions: Map<string, HybridSession> = new Map();
  private voicePreferences: Map<string, { voice: string; language: string }> =
    new Map();

  /**
   * Set voice preference for a tenant
   */
  setVoicePreference(
    tenantId: string,
    voice: string,
    language: string = "en-US"
  ) {
    this.voicePreferences.set(tenantId, { voice, language });
    console.log(
      `[Hybrid] Voice preference set for tenant ${tenantId}: ${voice} (${language})`
    );
  }

  /**
   * Get voice preference for a tenant (default: female, en-US)
   */
  async getVoicePreference(
    tenantId: string
  ): Promise<{ voice: string; language: string }> {
    const cached = this.voicePreferences.get(tenantId);
    if (cached) return cached;

    const defaultPreference = { voice: "female", language: "en-US" };

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { phoneVoiceId: true, phoneVoiceLanguage: true },
      });

      const preference = {
        voice: (tenant?.phoneVoiceId || "").trim() || defaultPreference.voice,
        language:
          (tenant?.phoneVoiceLanguage || "").trim() ||
          defaultPreference.language,
      };

      this.voicePreferences.set(tenantId, preference);
      return preference;
    } catch (error) {
      console.error(
        `[Hybrid] Failed to load voice preference from DB for tenant ${tenantId}:`,
        error
      );
      return defaultPreference;
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): VoiceOption[] {
    return AVAILABLE_VOICES;
  }

  /**
   * Start a hybrid voice session
   */
  async startSession(
    callControlId: string,
    tenantId: string,
    workflowId?: string
  ): Promise<void> {
    const sessionId = `hybrid_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    let { voice, language } = await this.getVoicePreference(tenantId);

    const applyPhoneVoiceOverride = (
      overrideVoiceId: string,
      overrideLanguage: string,
      sourceLabel: string
    ) => {
      if (!overrideVoiceId || !overrideVoiceId.trim()) return;

      const availableVoices = this.getAvailableVoices();
      const voiceInfo = availableVoices.find((v) => v.id === overrideVoiceId);
      if (!voiceInfo) {
        console.log(
          `[Hybrid] Ignoring unknown ${sourceLabel} phoneVoiceId override: ${overrideVoiceId}`
        );
        return;
      }

      voice = voiceInfo.id;
      language =
        overrideLanguage && overrideLanguage.trim()
          ? overrideLanguage
          : voiceInfo.language || language;

      console.log(
        `[Hybrid] Using ${sourceLabel} phone voice override: ${voice} (${language})`
      );
    };

    // Load workflow's AI config if workflow is assigned
    let agentName = "AI Assistant";
    let greeting = "";
    let systemPrompt =
      "You are a helpful AI assistant for customer support. Keep responses brief, natural, and conversational.";

    let configuredIntents: unknown = undefined;

    if (workflowId && workflowId !== "default") {
      try {
        const workflow = await prisma.workflow.findUnique({
          where: { id: workflowId },
          include: { aiConfig: true },
        });

        const workflowToneOfVoice = String(
          (workflow as any)?.toneOfVoice ?? ""
        ).trim();
        const configToneOfVoice = String(
          (workflow as any)?.aiConfig?.toneOfVoice ?? ""
        ).trim();
        const effectiveToneOfVoice = workflowToneOfVoice || configToneOfVoice;

        // If the workflow has a custom greeting on the Incoming Call trigger, prefer it.
        const nodes = Array.isArray(workflow?.nodes)
          ? (workflow?.nodes as any[]) ?? []
          : [];
        const triggerNode =
          nodes.find(
            (n) => n?.type === "trigger" && n?.label === "Incoming Call"
          ) || nodes.find((n) => n?.type === "trigger");
        const triggerGreeting =
          typeof triggerNode?.config?.greeting === "string"
            ? triggerNode.config.greeting
            : "";

        const triggerPhoneVoiceId =
          typeof triggerNode?.config?.phoneVoiceId === "string"
            ? triggerNode.config.phoneVoiceId
            : "";
        const triggerPhoneVoiceLanguage =
          typeof triggerNode?.config?.phoneVoiceLanguage === "string"
            ? triggerNode.config.phoneVoiceLanguage
            : "";

        // Precedence: tenant default -> Incoming Call trigger override
        applyPhoneVoiceOverride(
          triggerPhoneVoiceId,
          triggerPhoneVoiceLanguage,
          "Incoming Call trigger"
        );

        if (triggerGreeting && triggerGreeting.trim()) {
          // User-configured greeting always wins.
          greeting = triggerGreeting;
          console.log(`[Hybrid] Using workflow trigger greeting`);
        }

        if (workflow?.aiConfig) {
          configuredIntents = (workflow as any)?.aiConfig?.intents;
          agentName = workflow.aiConfig.name || "AI Assistant";
          const businessDescription =
            workflow.aiConfig.businessDescription || "";

          const basePrompt =
            String(workflow.aiConfig.systemPrompt || "").trim() || systemPrompt;
          systemPrompt = basePrompt;
          if (businessDescription && businessDescription.trim()) {
            systemPrompt = `${systemPrompt}\n\nBusiness Context: ${businessDescription.trim()}`;
          }
          systemPrompt = applyToneOfVoiceToSystemPrompt(
            systemPrompt,
            effectiveToneOfVoice
          );

          // If no explicit trigger greeting, derive one from AI config
          if (!triggerGreeting || !triggerGreeting.trim()) {
            if (businessDescription) {
              greeting = `Hello! Thank you for calling ${businessDescription}. This is ${agentName}. How may I help you today?`;
            } else {
              greeting = `Hello! This is ${agentName}. How may I help you today?`;
            }
          }

          console.log(`[Hybrid] Using AI config - Agent: ${agentName}`);
        }
      } catch (error) {
        console.error("[Hybrid] Error loading workflow AI config:", error);
      }
    }

    if (!configuredIntents) {
      try {
        const aiConfig = await prisma.aiConfig.findUnique({
          where: { tenantId },
          select: { intents: true },
        });
        configuredIntents = aiConfig?.intents;
      } catch {
        // ignore
      }
    }

    const session: HybridSession = {
      sessionId,
      callControlId,
      tenantId,
      workflowId,
      isListening: false,
      conversationHistory: [],
      voice,
      language,
      systemPrompt,
      intents: configuredIntents,
      detectedIntent: detectIntentFromConfiguredIntents("", configuredIntents),
    };

    this.sessions.set(callControlId, session);

    // Answer call and greet
    await telnyxService.answerCall(callControlId);
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log(
      `[Hybrid] Speaking greeting with voice: ${voice}, language: ${language}`
    );
    const greetingToSpeak = normalizeGreeting(greeting, agentName);
    console.log(`[Hybrid] Greeting: ${greetingToSpeak}`);
    await telnyxService.speakText(
      callControlId,
      greetingToSpeak,
      voice,
      language
    );

    console.log(
      `[Hybrid] Session ${sessionId} started for call ${callControlId}`
    );
  }

  /**
   * Handle speech ended event (after greeting or AI response)
   */
  async onSpeakEnded(callControlId: string): Promise<void> {
    const session = this.sessions.get(callControlId);
    if (!session) return;

    // Start listening for user input
    await telnyxService.startTranscription(callControlId);
    session.isListening = true;
    console.log(`[Hybrid] Listening for user input on ${callControlId}`);
  }

  /**
   * Handle transcribed user input
   */
  async onUserInput(callControlId: string, transcript: string): Promise<void> {
    const session = this.sessions.get(callControlId);
    if (!session || !session.isListening) return;

    console.log(`[Hybrid] User said: ${transcript}`);

    // Update detected intent from the latest transcript (best-effort).
    try {
      session.detectedIntent = detectIntentFromConfiguredIntents(
        transcript,
        session.intents
      );
    } catch {
      // ignore
    }

    // Stop listening while we process
    await telnyxService.stopTranscription(callControlId);
    session.isListening = false;

    // Add to conversation history
    session.conversationHistory.push({
      role: "user",
      content: transcript,
    });

    // Get AI response using OpenAI Realtime's text mode
    // (We'll use the standard OpenAI API for now since Realtime is complex without full audio)
    const response = await this.getAIResponse(session, transcript);

    // Add AI response to history
    session.conversationHistory.push({
      role: "assistant",
      content: response,
    });

    // Speak the response using Telnyx TTS with configured voice
    await telnyxService.speakText(
      callControlId,
      response,
      session.voice,
      session.language
    );
    console.log(`[Hybrid] AI responded (${session.voice}): ${response}`);
  }

  /**
   * Get AI response (simplified - using text-based OpenAI)
   */
  private async getAIResponse(
    session: HybridSession,
    userMessage: string
  ): Promise<string> {
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${session.systemPrompt}\n\nKeep responses brief. Aim for 1-2 sentences unless the user explicitly asks for more detail.`,
          },
          ...session.conversationHistory.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ],
        temperature: 0.8,
        max_tokens: 150,
      });

      return (
        completion.choices[0]?.message?.content ||
        "I'm sorry, I didn't catch that. Could you repeat?"
      );
    } catch (error) {
      console.error("[Hybrid] Error getting AI response:", error);
      return "I'm sorry, I'm having trouble processing that right now.";
    }
  }

  /**
   * End session
   */
  async endSession(callControlId: string): Promise<void> {
    const session = this.sessions.get(callControlId);
    if (!session) return;

    this.sessions.delete(callControlId);
    console.log(`[Hybrid] Session ended for call ${callControlId}`);
  }

  /**
   * Get session
   */
  getSession(callControlId: string): HybridSession | undefined {
    return this.sessions.get(callControlId);
  }
}

export const hybridVoiceService = new HybridVoiceService();
