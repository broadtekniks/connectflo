import dotenv from "dotenv";
dotenv.config({ override: true });

import express, { Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "./lib/prisma";
import conversationRoutes from "./routes/conversations";
import messageRoutes from "./routes/messages";
import aiRoutes from "./routes/ai";
import phoneNumberRoutes from "./routes/phoneNumbers";
import webhookRoutes from "./routes/webhooks";
import twilioWebhookRoutes, {
  initializeTwilioWebSocket,
} from "./routes/twilioWebhooks";
import workflowRoutes from "./routes/workflows";
import workflowResourceRoutes from "./routes/workflowResources";
import knowledgeBaseRoutes from "./routes/knowledgeBase";
import tenantRoutes from "./routes/tenants";
import aiConfigRoutes from "./routes/ai-config";
import authRoutes from "./routes/auth";
import metricsRoutes from "./routes/metrics";
import planRoutes from "./routes/plans";
import usageRoutes from "./routes/usage";
import customerRoutes from "./routes/customers";
import teamMemberRoutes from "./routes/teamMembers";
import agentRoutes from "./routes/agents";
import { voiceRouter, initializeVoiceWebSocket } from "./routes/voice";
import voiceConfigRoutes from "./routes/voiceConfig";
import conditionSchemaRoutes from "./routes/conditionSchema";
import integrationRoutes from "./routes/integrations";
import { authenticateToken } from "./middleware/auth";

const app = express();
const port = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Allow Twilio webhooks to bypass ngrok browser warning
app.use((req, res, next) => {
  if (req.path.startsWith("/webhooks/")) {
    res.setHeader("ngrok-skip-browser-warning", "true");
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Add support for form-encoded bodies from Twilio

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for now, restrict in production
    methods: ["GET", "POST"],
  },
  path: "/socket.io", // Explicitly set Socket.IO path to avoid conflicts
});

// Initialize voice streaming WebSocket
const voiceWss = initializeVoiceWebSocket(httpServer);

// Initialize Twilio Media Stream WebSocket
const twilioWss = initializeTwilioWebSocket(httpServer);

// Manual upgrade handler for all WebSocket connections
httpServer.on("upgrade", (request, socket, head) => {
  const pathname = request.url;
  console.log(`[Server] Upgrade request for: ${pathname}`);

  if (pathname === "/ws/twilio") {
    console.log("[Server] Routing to Twilio WebSocket");
    twilioWss.handleUpgrade(request, socket, head, (ws) => {
      twilioWss.emit("connection", ws, request);
    });
  } else if (pathname?.startsWith("/ws/voice")) {
    console.log("[Server] Routing to Voice WebSocket");
    voiceWss.handleUpgrade(request, socket, head, (ws) => {
      voiceWss.emit("connection", ws, request);
    });
  } else if (pathname?.startsWith("/socket.io")) {
    // Let Socket.IO handle its own upgrade requests.
    return;
  } else {
    console.log(`[Server] Unknown WebSocket path: ${pathname}`);
    socket.destroy();
  }
});

// Make io accessible to routes
app.set("io", io);

// Authenticate Socket.IO connections using the same JWT as the API.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Unauthorized"));

    const verified = jwt.verify(token, JWT_SECRET) as any;
    socket.data.user = verified;

    const tenantId = verified?.tenantId as string | undefined;
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
    }

    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
});

app.use("/api/conversations", authenticateToken, conversationRoutes);
app.use("/api/messages", authenticateToken, messageRoutes);
app.use("/api/ai", authenticateToken, aiRoutes);
app.use("/api/phone-numbers", authenticateToken, phoneNumberRoutes);
app.use("/api/workflows", authenticateToken, workflowRoutes);
app.use("/api/workflow-resources", authenticateToken, workflowResourceRoutes);
app.use("/api/knowledge-base", authenticateToken, knowledgeBaseRoutes);
app.use("/api/tenants", authenticateToken, tenantRoutes);
app.use("/api/ai-config", authenticateToken, aiConfigRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/metrics", authenticateToken, metricsRoutes);
app.use("/api/customers", authenticateToken, customerRoutes);
app.use("/api/team-members", authenticateToken, teamMemberRoutes);
app.use("/api/agents", authenticateToken, agentRoutes);
app.use("/api/plans", authenticateToken, planRoutes);
app.use("/api/usage", authenticateToken, usageRoutes);
app.use("/api/voice", authenticateToken, voiceRouter);
app.use("/api/voice-config", authenticateToken, voiceConfigRoutes);
app.use("/api/integrations", integrationRoutes); // Must be BEFORE the catch-all /api route
app.use("/api", authenticateToken, conditionSchemaRoutes);
app.use("/webhooks", webhookRoutes);
app.use("/webhooks/twilio", twilioWebhookRoutes);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/users", async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
