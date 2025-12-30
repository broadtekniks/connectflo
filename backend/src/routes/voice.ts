import { Router } from "express";
import WebSocket from "ws";
import { IncomingMessage } from "http";
import { realtimeVoiceService } from "../services/ai/realtimeVoice";
import { AudioStreamManager } from "../services/audioStreamManager";
import { KnowledgeBaseService } from "../services/knowledgeBase";

const knowledgeBaseService = new KnowledgeBaseService();

/**
 * Voice Streaming Route
 * Handles WebSocket connections for Telnyx Media Streaming <-> OpenAI Realtime
 */

// Session management
interface VoiceSession {
  sessionId: string;
  callControlId: string;
  tenantId: string;
  workflowId?: string;
  telnyxWs?: WebSocket;
  audioBuffer: ReturnType<typeof AudioStreamManager.createAudioBuffer>;
  streamSid?: string;
}

const activeSessions = new Map<string, VoiceSession>();

/**
 * Initialize WebSocket server for voice streaming
 */
export function initializeVoiceWebSocket(server: any) {
  const wss = new WebSocket.Server({
    noServer: true,
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    console.log("[VoiceWS] New connection from Telnyx");

    // Extract call info from query params or headers
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const callControlId = url.searchParams.get("callControlId") || "";
    const tenantId = url.searchParams.get("tenantId") || "";
    const workflowId = url.searchParams.get("workflowId") || "";

    if (!callControlId || !tenantId) {
      console.error("[VoiceWS] Missing required parameters");
      ws.close(1008, "Missing callControlId or tenantId");
      return;
    }

    handleTelnyxConnection(ws, callControlId, tenantId, workflowId);
  });

  console.log("[VoiceWS] WebSocket server initialized on /ws/voice");

  return wss; // Return the WebSocket server instance
}

/**
 * Handle Telnyx Media Streaming connection
 */
async function handleTelnyxConnection(
  ws: WebSocket,
  callControlId: string,
  tenantId: string,
  workflowId: string
) {
  let sessionId: string | null = null;

  try {
    // Create OpenAI Realtime session
    sessionId = await realtimeVoiceService.createSession(
      callControlId,
      tenantId,
      workflowId,
      "You are a helpful AI assistant for ConnectFlo. Answer customer questions professionally and concisely."
    );

    // Create voice session
    const session: VoiceSession = {
      sessionId,
      callControlId,
      tenantId,
      workflowId,
      telnyxWs: ws,
      audioBuffer: AudioStreamManager.createAudioBuffer(100), // 100ms chunks
    };

    activeSessions.set(sessionId, session);
    console.log(
      `[VoiceWS] Session ${sessionId} created for call ${callControlId}`
    );

    // Set up OpenAI event handlers
    setupRealtimeEventHandlers(sessionId);

    // Handle incoming Telnyx messages
    ws.on("message", async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(
          `[VoiceWS] Telnyx message:`,
          JSON.stringify(message, null, 2)
        );
        await handleTelnyxMessage(sessionId!, message);
      } catch (error) {
        console.error("[VoiceWS] Error handling Telnyx message:", error);
      }
    });

    ws.on("close", async () => {
      console.log(`[VoiceWS] Telnyx connection closed for ${sessionId}`);
      if (sessionId) {
        await realtimeVoiceService.endSession(sessionId);
        activeSessions.delete(sessionId);
      }
    });

    ws.on("error", (error: Error) => {
      console.error("[VoiceWS] Telnyx WebSocket error:", error);
    });
  } catch (error) {
    console.error("[VoiceWS] Error setting up session:", error);
    ws.close(1011, "Internal error");
  }
}

/**
 * Handle messages from Telnyx Media Stream
 */
async function handleTelnyxMessage(sessionId: string, message: any) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  switch (message.event) {
    case "start":
      // Media stream started
      session.streamSid = message.streamSid;
      console.log(`[VoiceWS] Media stream started: ${message.streamSid}`);
      break;

    case "media":
      // Incoming audio from caller
      const mulawAudio = AudioStreamManager.base64ToBuffer(
        message.media.payload
      );

      // Convert µ-law to PCM16
      const pcm16Audio = AudioStreamManager.mulawToPcm16(mulawAudio);

      // Send to OpenAI Realtime
      await realtimeVoiceService.sendAudio(sessionId, pcm16Audio);
      break;

    case "stop":
      // Media stream stopped
      console.log(`[VoiceWS] Media stream stopped: ${session.streamSid}`);
      await realtimeVoiceService.endSession(sessionId);
      activeSessions.delete(sessionId);
      break;

    default:
      console.log(`[VoiceWS] Unknown event: ${message.event}`);
  }
}

/**
 * Set up event handlers for OpenAI Realtime responses
 */
function setupRealtimeEventHandlers(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  // Handle audio output from OpenAI
  realtimeVoiceService.on("audio_output", async (data) => {
    if (data.sessionId !== sessionId) return;

    console.log(
      `[VoiceWS] Sending audio to Telnyx: ${data.audio.length} bytes`
    );

    // Convert PCM16 to µ-law
    const mulawAudio = AudioStreamManager.pcm16ToMulaw(data.audio);

    // Send to Telnyx
    if (session.telnyxWs?.readyState === WebSocket.OPEN) {
      const mediaMessage = {
        event: "media",
        streamSid: session.streamSid,
        media: {
          payload: AudioStreamManager.bufferToBase64(mulawAudio),
        },
      };
      console.log(
        `[VoiceWS] Telnyx send:`,
        JSON.stringify(mediaMessage).substring(0, 200) + "..."
      );
      session.telnyxWs.send(JSON.stringify(mediaMessage));
    } else {
      console.error(
        `[VoiceWS] Cannot send audio - WebSocket not open or streamSid missing`
      );
    }
  });

  // Handle function calls for RAG
  realtimeVoiceService.on("function_call", async (data) => {
    if (data.sessionId !== sessionId) return;

    if (data.functionName === "search_knowledge_base") {
      console.log(`[VoiceWS] KB search: ${data.args.query}`);

      // Search knowledge base
      const results = await knowledgeBaseService.search(
        data.args.query,
        session.tenantId,
        5
      );

      const context = results.map((r: any) => r.content).join("\n\n");

      // Send result back to OpenAI
      await realtimeVoiceService.sendFunctionResult(sessionId, data.callId, {
        results: context,
      });
    }
  });

  // Handle transcripts for logging
  realtimeVoiceService.on("transcript_input", (data) => {
    if (data.sessionId !== sessionId) return;
    console.log(`[VoiceWS] User: ${data.text}`);
  });

  realtimeVoiceService.on("transcript_output", (data) => {
    if (data.sessionId !== sessionId) return;
    console.log(`[VoiceWS] AI: ${data.text}`);
  });

  // Handle errors
  realtimeVoiceService.on("error", (data) => {
    if (data.sessionId !== sessionId) return;
    console.error(`[VoiceWS] Error:`, data.error);
  });
}

/**
 * Get active session info
 */
export function getActiveSession(sessionId: string): VoiceSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Get all active sessions
 */
export function getAllActiveSessions(): VoiceSession[] {
  return Array.from(activeSessions.values());
}

export const voiceRouter = Router();

// Health check endpoint
voiceRouter.get("/health", (req, res) => {
  res.json({
    status: "ok",
    activeSessions: activeSessions.size,
    sessions: Array.from(activeSessions.values()).map((s) => ({
      sessionId: s.sessionId,
      callControlId: s.callControlId,
      tenantId: s.tenantId,
    })),
  });
});
