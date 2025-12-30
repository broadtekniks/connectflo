import WebSocket from "ws";
import { EventEmitter } from "events";
import { TwilioService } from "./twilio";
import { variableResolver } from "./variableResolver";

const END_CALL_MARKER = "[[END_CALL]]";

const VOICE_CALL_RUNTIME_INSTRUCTIONS = [
  "You are speaking with a caller on a live phone call.",
  "Keep responses concise and conversational.",
  "If the caller asks to end the call, respond with a brief goodbye and confirm you are ending the call.",
  `If you decide the call should be ended now, include the token ${END_CALL_MARKER} in your TEXT output only (do not say the token out loud).`,
].join("\n");

function normalizeGreeting(raw: string, agentName?: string): string {
  const fallback = `Hello! This is ${
    agentName || "your assistant"
  }. How may I help you today?`;
  const text = (raw || "").replace(/\s+/g, " ").trim();
  const base = text.length ? text : fallback;

  // Preserve the full user-configured greeting (voice calls sometimes need longer intros).
  // Apply a generous cap to avoid extreme payloads.
  const maxChars = 2000;
  return base.length > maxChars ? base.slice(0, maxChars).trim() : base;
}

interface TwilioRealtimeSession {
  sessionId: string;
  callSid: string;
  streamSid: string;
  tenantId: string;
  workflowId?: string;
  openaiWs?: WebSocket;
  twilioWs?: WebSocket;
  conversationHistory: any[];
  systemPrompt: string;
  documentIds?: string[];
  agentName?: string;
  greeting?: string;
  greetingSent?: boolean;
  greetingInProgress?: boolean; // Track if initial greeting is currently being spoken
  infoRequestSent?: boolean; // Track if we've already requested missing info
  responseInProgress?: boolean;
  pendingHangupReason?: string;
  hangupAfterThisResponse?: boolean;
  heardUserSpeech?: boolean;
  bargeInActive?: boolean;
  responseRequested?: boolean;
  silencePromptCount?: number;
  lastUserSpeechTime?: number;
  silenceCheckTimeout?: NodeJS.Timeout;
  workflowContext?: any; // Store workflow context for variable resolution
}

/**
 * Twilio Realtime Voice Service
 * Integrates OpenAI Realtime API with Twilio Media Streams for natural voice
 */
export class TwilioRealtimeVoiceService extends EventEmitter {
  private sessions: Map<string, TwilioRealtimeSession> = new Map();
  private apiKey: string;
  private twilioService: TwilioService;

  constructor() {
    super();
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.twilioService = new TwilioService();
  }

  private extractTextFromResponseDone(message: any): string {
    const response = message?.response;
    const outputs: any[] = Array.isArray(response?.output)
      ? response.output
      : [];

    const chunks: string[] = [];
    for (const out of outputs) {
      const content: any[] = Array.isArray(out?.content) ? out.content : [];
      for (const c of content) {
        if (typeof c?.text === "string") chunks.push(c.text);
        if (typeof c?.transcript === "string") chunks.push(c.transcript);
      }

      // Some schemas put text at the top level.
      if (typeof out?.text === "string") chunks.push(out.text);
      if (typeof out?.transcript === "string") chunks.push(out.transcript);
    }

    return chunks.join("\n").trim();
  }

  private extractUserTranscript(message: any): string {
    if (!message) return "";

    if (typeof message?.transcript === "string") return message.transcript;

    // Common shapes for transcription events.
    const item = message?.item;
    const content: any[] = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (typeof c?.transcript === "string") return c.transcript;
      if (typeof c?.text === "string") return c.text;
    }

    return "";
  }

  private userWantsToEndCall(transcript: string): boolean {
    const t = (transcript || "").toLowerCase();
    if (!t) return false;

    // Keep this conservative to avoid accidental hangups.
    return (
      t.includes("hang up") ||
      t.includes("end the call") ||
      t.includes("please end") ||
      t.includes("goodbye") ||
      t === "bye" ||
      t.includes("bye bye")
    );
  }

  async hangupCall(sessionId: string, reason: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(
      `[TwilioRealtime] Hanging up call ${session.callSid} (reason=${reason})`
    );

    try {
      await this.twilioService.endCall(session.callSid);
    } catch (error) {
      // If the caller already hung up, Twilio may reject the update; treat as best-effort.
      console.log(
        `[TwilioRealtime] Hangup best-effort failed for ${session.callSid}`
      );
    } finally {
      await this.endSession(sessionId);
    }
  }

  async endSessionByCallSid(callSid: string): Promise<void> {
    for (const [sessionId, s] of this.sessions.entries()) {
      if (s.callSid === callSid) {
        await this.endSession(sessionId);
      }
    }
  }

  /**
   * Start a new session when Twilio Media Stream connects
   */
  async startSession(
    callSid: string,
    streamSid: string,
    tenantId: string,
    workflowId?: string,
    systemPrompt?: string,
    documentIds?: string[],
    agentName?: string,
    greeting?: string,
    workflowContext?: any
  ): Promise<string> {
    const sessionId = `twilio_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    const session: TwilioRealtimeSession = {
      sessionId,
      callSid,
      streamSid,
      tenantId,
      workflowId,
      conversationHistory: [],
      systemPrompt:
        systemPrompt ||
        "You are a helpful AI assistant for customer support. Keep responses brief and natural.",
      documentIds,
      agentName,
      greeting,
      greetingSent: false,
      greetingInProgress: false,
      infoRequestSent: false,
      responseInProgress: false,
      heardUserSpeech: false,
      bargeInActive: false,
      responseRequested: false,
      silencePromptCount: 0,
      lastUserSpeechTime: Date.now(),
      workflowContext, // Store workflow context in session
    };

    this.sessions.set(sessionId, session);
    console.log(
      `[TwilioRealtime] Session ${sessionId} created for call ${callSid}`
    );
    if (agentName) {
      console.log(`[TwilioRealtime] Agent name: ${agentName}`);
    }
    if (documentIds && documentIds.length > 0) {
      console.log(
        `[TwilioRealtime] Documents available: ${documentIds.length}`
      );
    }
    if (workflowContext?.customer?.name) {
      console.log(
        `[TwilioRealtime] Customer: ${workflowContext.customer.name}`
      );
    }

    return sessionId;
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connectToOpenAI(
    sessionId: string,
    voice: string = "alloy"
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "OpenAI-Beta": "realtime=v1",
          },
        }
      );

      ws.on("open", () => {
        console.log(
          `[TwilioRealtime] OpenAI WebSocket connected for ${sessionId}`
        );

        // Configure session
        const config = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `${session.systemPrompt}\n\n${VOICE_CALL_RUNTIME_INSTRUCTIONS}\n\nWhen you learn the caller's name, email, phone number, order number, or reason for calling, use the update_customer_info function to save it.`,
            voice: voice, // Options: alloy, echo, shimmer
            input_audio_format: "g711_ulaw", // Twilio uses mulaw
            output_audio_format: "g711_ulaw",
            input_audio_transcription: {
              model: "whisper-1",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5, // Lower threshold = more sensitive to speech
              prefix_padding_ms: 300,
              silence_duration_ms: 800, // Shorter silence = faster response
              // We explicitly create responses after speech_stopped,
              // so the assistant reliably waits for the caller.
              create_response: false,
            },
            temperature: 0.8,
            tools: [
              {
                type: "function",
                name: "update_customer_info",
                description:
                  "Save customer information learned during the conversation (name, email, phone, order number, reason for calling)",
                parameters: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "The customer's full name",
                    },
                    email: {
                      type: "string",
                      description: "The customer's email address",
                    },
                    phone: {
                      type: "string",
                      description: "The customer's phone number",
                    },
                    orderNumber: {
                      type: "string",
                      description: "Order or account number",
                    },
                    reason: {
                      type: "string",
                      description: "The reason for their call",
                    },
                  },
                  required: [],
                },
              },
            ],
            tool_choice: "auto",
          },
        };

        ws.send(JSON.stringify(config));

        session.openaiWs = ws;
        console.log(
          `[TwilioRealtime] Session ${sessionId} configured and ready`
        );
        resolve();
      });

      ws.on("message", (data: Buffer) => {
        this.handleOpenAIMessage(sessionId, data);
      });

      ws.on("error", (error) => {
        console.error(`[TwilioRealtime] OpenAI WebSocket error:`, error);
        reject(error);
      });

      ws.on("close", (code, reason) => {
        console.log(
          `[TwilioRealtime] OpenAI WebSocket closed for ${sessionId} - Code: ${code}, Reason: ${
            reason || "(none)"
          }`
        );
      });
    });
  }

  /**
   * Handle incoming audio from Twilio Media Stream
   */
  handleTwilioAudio(sessionId: string, audioPayload: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) return;

    // Twilio occasionally sends empty payloads; ignore them.
    if (!audioPayload) return;

    // Forward audio to OpenAI Realtime API
    session.openaiWs.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: audioPayload, // Base64 mulaw audio from Twilio
      })
    );
  }

  /**
   * Handle messages from OpenAI Realtime API
   */
  private handleOpenAIMessage(sessionId: string, data: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message = JSON.parse(data.toString());

      // Capture user transcription events (shape varies by event type).
      if (
        typeof message?.type === "string" &&
        message.type.includes("transcription")
      ) {
        const transcript = this.extractUserTranscript(message);
        if (transcript) {
          console.log(`[TwilioRealtime] User transcript: ${transcript}`);
          if (this.userWantsToEndCall(transcript)) {
            session.pendingHangupReason = "caller_requested";
            session.hangupAfterThisResponse = false;
          }
        }
      }

      switch (message.type) {
        case "session.created":
          console.log(`[TwilioRealtime] Session created:`, message.session.id);
          break;

        case "session.updated":
          console.log(`[TwilioRealtime] Session updated`);
          break;

        case "conversation.item.created":
          // Track conversation history
          if (message.item) {
            session.conversationHistory.push(message.item);
          }
          break;

        case "response.created":
          // Treat as active so we can cancel immediately on user barge-in.
          session.responseRequested = false;
          session.responseInProgress = true;
          break;

        case "response.audio.delta":
          session.responseInProgress = true;
          // If the user barges in, stop sending any further assistant audio.
          if (session.bargeInActive) {
            break;
          }
          // Stream audio back to Twilio
          if (message.delta && session.twilioWs) {
            session.twilioWs.send(
              JSON.stringify({
                event: "media",
                streamSid: session.streamSid,
                media: {
                  payload: message.delta, // Base64 mulaw audio
                },
              })
            );
          }
          break;

        case "response.audio.done":
          console.log(`[TwilioRealtime] Audio response complete`);
          break;

        case "response.done":
          console.log(`[TwilioRealtime] Response complete`);
          session.responseInProgress = false;
          session.responseRequested = false;

          // Mark greeting as complete if it was in progress
          if (session.greetingInProgress) {
            session.greetingInProgress = false;
            console.log(
              `[TwilioRealtime] Greeting completed - barge-in now enabled`
            );

            // After greeting, request missing information
            this.requestMissingInformation(sessionId);
          }

          // Agent-requested hangup via explicit marker in TEXT output.
          // (We hang up only after the response is done so the goodbye audio finishes.)
          {
            const text = this.extractTextFromResponseDone(message);
            if (text && text.includes(END_CALL_MARKER)) {
              session.pendingHangupReason = "agent_requested";
              session.hangupAfterThisResponse = true;
            }
          }

          if (session.pendingHangupReason && session.hangupAfterThisResponse) {
            // Fire-and-forget; teardown is best-effort.
            this.hangupCall(sessionId, session.pendingHangupReason);
          } else {
            // Set up silence detection - check if user responds within 20 seconds
            this.scheduleSilenceCheck(sessionId);
          }
          break;

        case "response.cancelled":
          session.responseInProgress = false;
          session.responseRequested = false;
          break;

        case "input_audio_buffer.speech_started":
          console.log(
            `[TwilioRealtime] User started speaking - attempting to interrupt`
          );

          session.heardUserSpeech = true;
          session.bargeInActive = true;
          session.lastUserSpeechTime = Date.now();
          session.silencePromptCount = 0; // Reset silence counter when user speaks

          // Clear any pending silence check
          if (session.silenceCheckTimeout) {
            clearTimeout(session.silenceCheckTimeout);
            session.silenceCheckTimeout = undefined;
          }

          // Do NOT interrupt if the initial greeting is still in progress
          if (session.greetingInProgress) {
            console.log(
              `[TwilioRealtime] Greeting in progress - barge-in disabled`
            );
            break;
          }

          // Clear Twilio's audio buffer to stop playback immediately
          if (session.twilioWs) {
            session.twilioWs.send(
              JSON.stringify({
                event: "clear",
                streamSid: session.streamSid,
              })
            );
          }

          // Interrupt AI response ONLY if there's actually an active response
          if (session.openaiWs && session.responseInProgress) {
            console.log(
              `[TwilioRealtime] Cancelling active response for barge-in`
            );
            session.responseInProgress = false;
            session.responseRequested = false;
            session.openaiWs.send(
              JSON.stringify({
                type: "response.cancel",
              })
            );
          }
          break;

        case "input_audio_buffer.speech_stopped":
          console.log(`[TwilioRealtime] User stopped speaking`);

          session.bargeInActive = false;
          session.lastUserSpeechTime = Date.now();

          // Only create a response if the user actually spoke.
          if (!session.heardUserSpeech) {
            break;
          }

          session.heardUserSpeech = false;

          // Create a response ONLY after the user finishes speaking.
          // This prevents the assistant from talking without user input.
          if (session.openaiWs) {
            // With server_vad, committing here can race with internal buffer management
            // and can trigger input_audio_buffer_commit_empty.
            session.responseRequested = true;

            if (session.pendingHangupReason) {
              session.hangupAfterThisResponse = true;
            }

            session.openaiWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                  // If the caller wants to end the call, have the model say a short goodbye.
                  ...(session.pendingHangupReason
                    ? {
                        instructions:
                          "The caller wants to end the call. Reply with a very short goodbye and confirm you are ending the call now.",
                      }
                    : {}),
                },
              })
            );
          }
          break;

        case "response.function_call_arguments.done":
          console.log(`[TwilioRealtime] Function call:`, message);
          this.handleFunctionCall(sessionId, message);
          break;

        case "error":
          console.error(
            `[TwilioRealtime] Error from OpenAI (session ${sessionId}):`,
            message.error
          );
          // If error is severe, it may cause the session to close
          if (
            message.error?.type === "server_error" ||
            message.error?.code === "session_expired"
          ) {
            console.error(
              `[TwilioRealtime] Fatal error detected, session may disconnect`
            );
          }
          break;
      }
    } catch (error) {
      console.error(`[TwilioRealtime] Error parsing OpenAI message:`, error);
    }
  }

  /**
   * Handle function calls from OpenAI
   */
  private async handleFunctionCall(
    sessionId: string,
    message: any
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const callId = message.call_id;
    const functionName = message.name;
    const argsString = message.arguments;

    try {
      const args = JSON.parse(argsString);
      console.log(
        `[TwilioRealtime] Function ${functionName} called with:`,
        args
      );

      if (functionName === "update_customer_info") {
        // Update workflow context with collected information
        if (!session.workflowContext) {
          session.workflowContext = {};
        }
        if (!session.workflowContext.customer) {
          session.workflowContext.customer = {};
        }

        // Track what information was just collected
        const collectedItems: string[] = [];

        // Update context with provided information
        if (args.name) {
          session.workflowContext.customer.name = args.name;
          collectedItems.push("name");
          console.log(`[TwilioRealtime] Saved customer name: ${args.name}`);
        }
        if (args.email) {
          session.workflowContext.customer.email = args.email;
          collectedItems.push("email");
          console.log(`[TwilioRealtime] Saved customer email: ${args.email}`);
        }
        if (args.phone) {
          session.workflowContext.customer.phone = args.phone;
          collectedItems.push("phone");
          console.log(`[TwilioRealtime] Saved customer phone: ${args.phone}`);
        }
        if (args.orderNumber) {
          if (!session.workflowContext.customer.metadata) {
            session.workflowContext.customer.metadata = {};
          }
          session.workflowContext.customer.metadata.orderNumber =
            args.orderNumber;
          collectedItems.push("orderNumber");
          console.log(
            `[TwilioRealtime] Saved order number: ${args.orderNumber}`
          );
        }
        if (args.reason) {
          if (!session.workflowContext.customer.metadata) {
            session.workflowContext.customer.metadata = {};
          }
          session.workflowContext.customer.metadata.callReason = args.reason;
          collectedItems.push("reason");
          console.log(`[TwilioRealtime] Saved call reason: ${args.reason}`);
        }

        // Send function call result back to OpenAI
        if (session.openaiWs) {
          session.openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  success: true,
                  message: "Information saved",
                }),
              },
            })
          );

          // Check if there are more items to collect
          this.promptForNextItem(sessionId, collectedItems);
        }
      }
    } catch (error) {
      console.error(`[TwilioRealtime] Error handling function call:`, error);
    }
  }

  /**
   * Prompt for the next item after collecting information
   */
  private promptForNextItem(sessionId: string, justCollected: string[]): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) return;

    const requestInfo = session.workflowContext?.trigger?.requestInfo || {};

    // Initialize collected tracker if not exists
    if (!session.workflowContext) session.workflowContext = {};
    if (!session.workflowContext.infoCollected) {
      session.workflowContext.infoCollected = [];
    }

    // Add just collected items to the tracker
    session.workflowContext.infoCollected.push(...justCollected);
    console.log(
      `[TwilioRealtime] Info collected so far: ${session.workflowContext.infoCollected.join(
        ", "
      )}`
    );

    // Build list of what still needs to be collected based ONLY on configuration
    const stillNeeded: string[] = [];
    const stillNeededKeys: string[] = [];

    if (
      requestInfo.name === true &&
      !session.workflowContext.infoCollected.includes("name")
    ) {
      stillNeeded.push("their full name");
      stillNeededKeys.push("name");
    }
    if (
      requestInfo.email === true &&
      !session.workflowContext.infoCollected.includes("email")
    ) {
      stillNeeded.push("their email address");
      stillNeededKeys.push("email");
    }
    if (
      requestInfo.callbackNumber === true &&
      !session.workflowContext.infoCollected.includes("phone")
    ) {
      stillNeeded.push("a callback phone number");
      stillNeededKeys.push("phone");
    }
    if (
      requestInfo.orderNumber === true &&
      !session.workflowContext.infoCollected.includes("orderNumber")
    ) {
      stillNeeded.push("their order or account number");
      stillNeededKeys.push("orderNumber");
    }
    if (
      requestInfo.reason === true &&
      !session.workflowContext.infoCollected.includes("reason")
    ) {
      stillNeeded.push("the reason for their call");
      stillNeededKeys.push("reason");
    }

    if (stillNeeded.length > 0) {
      console.log(
        `[TwilioRealtime] Still need to collect: ${stillNeeded.join(
          ", "
        )} (${stillNeededKeys.join(", ")})`
      );

      // Prompt for the next item
      const nextItem = stillNeeded[0];
      const continueInstructions = `Thank the caller briefly, then ask for ${nextItem}. Use the update_customer_info function when they provide it.`;

      session.responseRequested = true;
      session.openaiWs.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions: continueInstructions,
          },
        })
      );
    } else {
      console.log(`[TwilioRealtime] All requested information collected`);

      // All info collected, proceed with normal conversation
      const doneInstructions =
        "Thank the caller for providing their information. Now ask how you can help them today.";

      session.responseRequested = true;
      session.openaiWs.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions: doneInstructions,
          },
        })
      );
    }
  }

  /**
   * Set Twilio WebSocket connection for bidirectional audio
   */
  setTwilioWebSocket(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.twilioWs = ws;
      console.log(
        `[TwilioRealtime] Twilio WebSocket attached to session ${sessionId}`
      );

      // If we have a greeting, trigger it once audio path is ready.
      if (session.openaiWs && !session.greetingSent) {
        this.sendGreetingIfNeeded(sessionId);
      }
    }
  }

  private sendGreetingIfNeeded(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs || !session.twilioWs) return;
    if (session.greetingSent) return;

    console.log(`[TwilioRealtime] Preparing to send greeting`);

    // User-configured greeting (from workflow trigger) always takes precedence.
    let greetingTemplate = session.greeting || "";

    // Resolve variables in greeting if context is available
    if (greetingTemplate && session.workflowContext) {
      try {
        greetingTemplate = variableResolver.resolve(
          greetingTemplate,
          session.workflowContext
        );
        console.log(`[TwilioRealtime] Resolved greeting variables`);
      } catch (error) {
        console.error(
          `[TwilioRealtime] Error resolving greeting variables:`,
          error
        );
      }
    }

    const greetingText = normalizeGreeting(greetingTemplate, session.agentName);

    session.greetingSent = true;
    session.greetingInProgress = true; // Mark greeting as in progress
    console.log(
      `[TwilioRealtime] Sending greeting: ${greetingText.substring(0, 80)}...`
    );

    // Build greeting instructions - just the greeting, info will be requested after
    let greetingInstructions = `Say this greeting to the caller: "${greetingText}". Then stop and listen for their response.`;

    // Ask OpenAI Realtime to speak the greeting immediately.
    // Mark as requested so barge-in can cancel right away.
    session.responseRequested = true;
    session.responseInProgress = false; // Ensure we can detect interruption immediately
    session.openaiWs.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          instructions: greetingInstructions,
        },
      })
    );
  }

  /**
   * Request missing customer information after greeting
   */
  private requestMissingInformation(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs || session.infoRequestSent) {
      console.log(
        `[TwilioRealtime] Skip info request - openaiWs: ${!!session?.openaiWs}, infoRequestSent: ${
          session?.infoRequestSent
        }`
      );
      return;
    }

    // Get request info configuration from workflow context
    const requestInfo = session.workflowContext?.trigger?.requestInfo || {};

    console.log(`[TwilioRealtime] requestMissingInformation called`);
    console.log(
      `[TwilioRealtime] Full workflow context:`,
      JSON.stringify(session.workflowContext, null, 2)
    );
    console.log(
      `[TwilioRealtime] Request info config:`,
      JSON.stringify(requestInfo, null, 2)
    );

    // Check if we have customer information (for logging purposes)
    const hasCustomerName = session.workflowContext?.customer?.name;
    const hasCustomerEmail = session.workflowContext?.customer?.email;
    const hasPhoneNumber =
      session.workflowContext?.customer?.phone ||
      session.workflowContext?.call?.from;

    console.log(
      `[TwilioRealtime] Customer info - name: ${hasCustomerName}, email: ${hasCustomerEmail}, phone: ${hasPhoneNumber}`
    );

    // Build list of information to request based on config
    // Note: We ask for ALL configured info, not just missing info (allows verification/updates)
    const infoToRequest: string[] = [];

    if (requestInfo.name === true) {
      infoToRequest.push("their full name");
      console.log(
        `[TwilioRealtime] Will request name (currently have: ${
          hasCustomerName || "none"
        })`
      );
    }

    if (requestInfo.email === true) {
      infoToRequest.push("their email address");
      console.log(
        `[TwilioRealtime] Will request email (currently have: ${
          hasCustomerEmail || "none"
        })`
      );
    }

    if (requestInfo.callbackNumber === true) {
      infoToRequest.push("a callback phone number");
      console.log(
        `[TwilioRealtime] Will request callback number (currently have: ${
          hasPhoneNumber || "none"
        })`
      );
    }

    if (requestInfo.orderNumber === true) {
      infoToRequest.push("their order or account number");
      console.log(`[TwilioRealtime] Will request order number`);
    }

    if (requestInfo.reason === true) {
      infoToRequest.push("the reason for their call");
      console.log(`[TwilioRealtime] Will request call reason`);
    }

    // If no info to request, skip
    if (infoToRequest.length === 0) {
      console.log(
        `[TwilioRealtime] No missing information to request - requestInfo:`,
        requestInfo
      );
      return;
    }

    session.infoRequestSent = true;
    const infoList = infoToRequest.join(", ");
    console.log(`[TwilioRealtime] Requesting missing info: ${infoList}`);

    // Store the list of info to collect in session for tracking
    session.workflowContext = session.workflowContext || {};
    session.workflowContext.infoToCollect = infoToRequest;
    session.workflowContext.infoCollected =
      session.workflowContext.infoCollected || [];

    // Build collection instructions with verification if we have existing data
    let collectionInstructions = `You need to collect the following information from the caller: ${infoList}.\n\n`;

    // If we have existing customer name, ask for verification first
    if (requestInfo.name === true && hasCustomerName) {
      collectionInstructions += `IMPORTANT: Our records show this number belongs to ${hasCustomerName}. Start by asking the caller to confirm their name for verification. If they give a different name, use the update_customer_info function to save the correct name.\n\n`;
    }

    collectionInstructions += `Ask for ONE piece of information at a time. After the caller provides each piece:
1. Use the update_customer_info function to save what they told you
2. Then ask for the NEXT piece of information on the list
3. Continue until you have collected ALL items: ${infoList}

Start by asking for the first item now.`;

    session.responseRequested = true;
    session.openaiWs.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          instructions: collectionInstructions,
        },
      })
    );
  }

  /**
   * Schedule a silence check after AI finishes speaking
   * Prompts user if no response, and disconnects after 3 failed prompts
   */
  private scheduleSilenceCheck(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) return;

    // Clear any existing timeout
    if (session.silenceCheckTimeout) {
      clearTimeout(session.silenceCheckTimeout);
    }

    // Wait 20 seconds for user response
    session.silenceCheckTimeout = setTimeout(() => {
      const currentSession = this.sessions.get(sessionId);
      if (!currentSession?.openaiWs) return;

      const timeSinceLastSpeech =
        Date.now() - (currentSession.lastUserSpeechTime || 0);

      // If user spoke recently (within last 20 seconds), don't prompt
      if (timeSinceLastSpeech < 20000) {
        return;
      }

      const promptCount = currentSession.silencePromptCount || 0;

      if (promptCount >= 3) {
        // After 3 prompts with no response, disconnect
        console.log(
          `[TwilioRealtime] No response after 3 prompts, disconnecting call ${sessionId}`
        );

        currentSession.responseRequested = true;
        currentSession.openaiWs.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio", "text"],
              instructions:
                "Say: 'I haven't heard from you, so I'm going to disconnect this call now. Goodbye!' Then include the marker [[END_CALL]] in your text output.",
            },
          })
        );
      } else {
        // Prompt the user
        console.log(
          `[TwilioRealtime] Silence detected, prompting user (attempt ${
            promptCount + 1
          }/3)`
        );

        currentSession.silencePromptCount = promptCount + 1;
        currentSession.responseRequested = true;

        const prompts = [
          "Are you still there? How can I help you?",
          "Hello? I'm still here if you need assistance.",
          "I haven't heard from you. Is there anything else I can help with?",
        ];

        currentSession.openaiWs.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio", "text"],
              instructions: `Say: "${prompts[promptCount]}"`,
            },
          })
        );
      }
    }, 20000); // 20 second timeout
  }

  /**
   * End session and cleanup
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`[TwilioRealtime] Ending session ${sessionId}`);

    // Clear any pending silence check
    if (session.silenceCheckTimeout) {
      clearTimeout(session.silenceCheckTimeout);
    }

    // Close OpenAI WebSocket
    if (session.openaiWs) {
      session.openaiWs.close();
    }

    // Don't close Twilio WebSocket (Twilio manages it)

    this.sessions.delete(sessionId);
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): TwilioRealtimeSession | undefined {
    return this.sessions.get(sessionId);
  }
}

// Singleton instance
export const twilioRealtimeVoiceService = new TwilioRealtimeVoiceService();
