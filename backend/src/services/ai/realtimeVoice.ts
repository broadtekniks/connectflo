import WebSocket from "ws";
import { EventEmitter } from "events";

interface RealtimeSession {
  sessionId: string;
  callControlId: string;
  tenantId: string;
  workflowId?: string;
  openaiWs?: WebSocket;
  conversationHistory: any[];
  context: string;
}

export class RealtimeVoiceService extends EventEmitter {
  private sessions: Map<string, RealtimeSession> = new Map();
  private apiKey: string;
  private realtimeModel: string;

  constructor() {
    super();
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.realtimeModel =
      process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";
  }

  /**
   * Create a new OpenAI Realtime API session
   */
  async createSession(
    callControlId: string,
    tenantId: string,
    workflowId?: string,
    systemPrompt?: string
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    // Initialize session data
    const session: RealtimeSession = {
      sessionId,
      callControlId,
      tenantId,
      workflowId,
      conversationHistory: [],
      context: systemPrompt || "You are a helpful AI assistant.",
    };

    this.sessions.set(sessionId, session);

    // Connect to OpenAI Realtime API
    await this.connectToOpenAI(sessionId, systemPrompt);

    return sessionId;
  }

  /**
   * Connect to OpenAI Realtime API via WebSocket
   */
  private async connectToOpenAI(
    sessionId: string,
    systemPrompt?: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return new Promise((resolve, reject) => {
      // OpenAI Realtime API WebSocket endpoint
      const realtimeUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(
        this.realtimeModel
      )}`;
      const ws = new WebSocket(
        realtimeUrl,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "OpenAI-Beta": "realtime=v1",
          },
        }
      );

      ws.on("open", () => {
        console.log(`[Realtime] OpenAI WebSocket connected for ${sessionId}`);

        // Send session configuration
        const sessionConfig = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions:
              systemPrompt ||
              "You are a helpful AI assistant for ConnectFlo customer support. Keep responses brief and natural.",
            voice: "alloy", // Options: alloy, echo, shimmer
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            temperature: 0.8,
            max_response_output_tokens: 4096,
          },
        };
        console.log(
          `[Realtime] Sending session config:`,
          JSON.stringify(sessionConfig, null, 2)
        );
        ws.send(JSON.stringify(sessionConfig));

        session.openaiWs = ws;
        resolve();
      });

      ws.on("message", (data: WebSocket.Data) => {
        this.handleOpenAIMessage(sessionId, data);
      });

      ws.on("error", (error: Error) => {
        console.error(`[Realtime] WebSocket error for ${sessionId}:`, error);
        this.emit("error", { sessionId, error });
        reject(error);
      });

      ws.on("close", () => {
        console.log(`[Realtime] WebSocket closed for ${sessionId}`);
        this.emit("session_ended", { sessionId });
      });
    });
  }

  /**
   * Handle incoming messages from OpenAI Realtime API
   */
  private handleOpenAIMessage(sessionId: string, data: WebSocket.Data) {
    try {
      const message = JSON.parse(data.toString());
      const session = this.sessions.get(sessionId);

      if (!session) return;

      // Debug: log all OpenAI messages
      if (message.type !== "response.audio_transcript.delta") {
        console.log(`[Realtime] Event: ${message.type}`);
      }

      switch (message.type) {
        case "session.created":
        case "session.updated":
          console.log(`[Realtime] Session configured: ${sessionId}`);
          this.emit("session_ready", { sessionId });
          break;

        case "response.audio.delta":
          // Stream audio chunks back to Telnyx
          const audioChunk = Buffer.from(message.delta, "base64");
          console.log(
            `[Realtime] Audio chunk received: ${audioChunk.length} bytes`
          );
          this.emit("audio_output", {
            sessionId,
            callControlId: session.callControlId,
            audio: audioChunk,
          });
          break;

        case "response.audio_transcript.delta":
          // AI response text (for logging/display)
          this.emit("transcript_output", {
            sessionId,
            text: message.delta,
          });
          break;

        case "conversation.item.input_audio_transcription.completed":
          // User speech transcribed
          console.log(`[Realtime] User said: ${message.transcript}`);
          this.emit("transcript_input", {
            sessionId,
            text: message.transcript,
          });
          break;

        case "response.done":
          // Response completed
          this.emit("response_complete", { sessionId });
          break;

        case "error":
          console.error(`[Realtime] Error:`, message.error);
          this.emit("error", { sessionId, error: message.error });
          break;

        default:
        // Ignore other message types
      }
    } catch (error) {
      console.error(`[Realtime] Error parsing message:`, error);
    }
  }

  /**
   * Send audio from Telnyx to OpenAI
   */
  async sendAudio(sessionId: string, audioBuffer: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) {
      throw new Error(`No active OpenAI connection for ${sessionId}`);
    }

    // Convert audio to base64 and send to OpenAI
    const base64Audio = audioBuffer.toString("base64");

    session.openaiWs.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: base64Audio,
      })
    );
  }

  /**
   * Commit audio buffer and trigger response
   */
  async commitAudio(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) {
      throw new Error(`No active OpenAI connection for ${sessionId}`);
    }

    session.openaiWs.send(
      JSON.stringify({
        type: "input_audio_buffer.commit",
      })
    );

    // Trigger response generation
    session.openaiWs.send(
      JSON.stringify({
        type: "response.create",
      })
    );
  }

  /**
   * Update session instructions (inject RAG context)
   */
  async updateSessionContext(
    sessionId: string,
    context: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) {
      throw new Error(`No active OpenAI connection for ${sessionId}`);
    }

    session.context = context;

    session.openaiWs.send(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions: context,
        },
      })
    );
  }

  /**
   * Inject function calling for RAG
   */
  async addKnowledgeBaseTool(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) {
      throw new Error(`No active OpenAI connection for ${sessionId}`);
    }

    session.openaiWs.send(
      JSON.stringify({
        type: "session.update",
        session: {
          tools: [
            {
              type: "function",
              name: "search_knowledge_base",
              description:
                "Search the company knowledge base for relevant information to answer customer questions.",
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description:
                      "The search query to find relevant information",
                  },
                },
                required: ["query"],
              },
            },
          ],
          tool_choice: "auto",
        },
      })
    );
  }

  /**
   * Handle function call from OpenAI
   */
  async handleFunctionCall(
    sessionId: string,
    functionName: string,
    args: any
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) return;

    // Emit event for external handling (e.g., KB search)
    this.emit("function_call", {
      sessionId,
      functionName,
      args,
    });
  }

  /**
   * Send function result back to OpenAI
   */
  async sendFunctionResult(
    sessionId: string,
    callId: string,
    result: any
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session?.openaiWs) return;

    session.openaiWs.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(result),
        },
      })
    );
  }

  /**
   * End session and cleanup
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.openaiWs) {
      session.openaiWs.close();
    }

    this.sessions.delete(sessionId);
    console.log(`[Realtime] Session ${sessionId} ended`);
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): RealtimeSession | undefined {
    return this.sessions.get(sessionId);
  }
}

export const realtimeVoiceService = new RealtimeVoiceService();
