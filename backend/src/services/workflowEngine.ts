import prisma from "../lib/prisma";
import { TelnyxService } from "./telnyx";
import { OpenAIService } from "./ai/openai";

interface WorkflowNode {
  id: string;
  type: string; // 'trigger', 'action', 'condition'
  label: string;
  config?: any;
  // ... other visual props we might ignore for execution
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export class WorkflowEngine {
  private telnyxService: TelnyxService;
  private aiService: OpenAIService;
  private activeCalls: Map<
    string,
    {
      systemPrompt: string;
      history: { role: "user" | "assistant" | "system"; content: string }[];
    }
  > = new Map();

  constructor() {
    this.telnyxService = new TelnyxService();
    this.aiService = new OpenAIService();
  }

  /**
   * Entry point for external events (Webhooks, API calls)
   */
  async trigger(triggerType: string, context: any) {
    console.log(`[WorkflowEngine] Triggered: ${triggerType}`, context);

    // 1. Find the active workflow for this trigger type
    // In a real app, we might filter by specific phone number or other criteria in 'context'
    const workflow = await prisma.workflow.findFirst({
      where: {
        isActive: true,
        triggerType: triggerType,
      },
    });

    if (!workflow) {
      console.log(
        `[WorkflowEngine] No active workflow found for ${triggerType}`
      );
      return;
    }

    console.log(
      `[WorkflowEngine] Starting workflow: ${workflow.name} (${workflow.id})`
    );

    // 2. Parse nodes and edges
    const nodes = workflow.nodes as unknown as WorkflowNode[];
    const edges = workflow.edges as unknown as WorkflowEdge[];

    // 3. Find the start node (The Trigger)
    const startNode = nodes.find(
      (n) => n.type === "trigger" && n.label === triggerType
    );

    // If exact label match fails, try to find any trigger that matches the category
    // For now, we'll assume the triggerType passed in matches the node label or we find the first trigger.
    const triggerNode = startNode || nodes.find((n) => n.type === "trigger");

    if (!triggerNode) {
      console.error("[WorkflowEngine] No trigger node found in workflow");
      return;
    }

    // Auto-answer incoming calls
    if (triggerType === "Incoming Call" && context.callControlId) {
      console.log(`[WorkflowEngine] Answering call ${context.callControlId}`);
      
      // Initialize call state
      this.activeCalls.set(context.callControlId, {
        systemPrompt: "You are a helpful assistant.",
        history: [],
      });

      await this.telnyxService.answerCall(context.callControlId);
      // Start transcription to enable 2-way conversation
      await this.telnyxService.startTranscription(context.callControlId);
    }

    // 4. Start execution
    await this.executeNode(triggerNode, nodes, edges, context);
  }

  private async executeNode(
    node: WorkflowNode,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    context: any
  ) {
    console.log(
      `[WorkflowEngine] Executing node: ${node.label} (${node.type})`
    );

    try {
      // --- EXECUTE ACTION ---
      let nextNodeId: string | null = null;

      switch (node.type) {
        case "trigger":
          // Just pass through, maybe enrich context
          break;

        case "action":
          await this.handleAction(node, context);
          break;

        case "condition":
          // Logic to determine which edge to follow
          // For now, we'll just take the first one, but this is where "If/Else" logic goes
          break;
      }

      // --- FIND NEXT NODE ---
      // Simple traversal: find edge where source == node.id
      const outgoingEdges = edges.filter((e) => e.source === node.id);

      if (outgoingEdges.length === 0) {
        console.log("[WorkflowEngine] End of flow");
        return;
      }

      // For simple linear flows, just take the first edge
      // For conditions, we would select the edge based on the result of handleAction/Condition
      const nextEdge = outgoingEdges[0];
      const nextNode = nodes.find((n) => n.id === nextEdge.target);

      if (nextNode) {
        // Add a small delay to prevent race conditions or stack overflows in tight loops
        await new Promise((resolve) => setTimeout(resolve, 100));
        await this.executeNode(nextNode, nodes, edges, context);
      }
    } catch (error) {
      console.error(`[WorkflowEngine] Error executing node ${node.id}:`, error);
    }
  }

  private async handleAction(node: WorkflowNode, context: any) {
    switch (node.label) {
      case "Send Reply":
      case "Send SMS":
        const text = node.config?.message || "Hello from ConnectFlo!";

        if (context.type === "voice" && context.callControlId) {
          console.log(`[WorkflowEngine] Speaking text on call: ${text}`);
          await this.telnyxService.speakText(context.callControlId, text);
        } else if (context.phoneNumber || context.fromNumber) {
          // context.phoneNumber is the customer, context.fromNumber is our number
          // In a real webhook, these might be reversed depending on direction
          console.log(
            `[WorkflowEngine] Sending SMS to ${context.fromNumber}: ${text}`
          );
          // await this.telnyxService.sendSms(context.fromNumber, context.phoneNumber, text);
        }
        break;

      case "AI Generate":
        console.log("[WorkflowEngine] Configuring AI Agent...");
        
        if (context.type === "voice" && context.callControlId) {
            const callState = this.activeCalls.get(context.callControlId);
            if (callState) {
                // Update system prompt from node config if available
                if (node.config?.systemPrompt) {
                    callState.systemPrompt = node.config.systemPrompt;
                    console.log(`[WorkflowEngine] Updated system prompt: ${callState.systemPrompt}`);
                }
                
                // If there's an initial message to speak, speak it
                if (node.config?.initialMessage) {
                     await this.telnyxService.speakText(context.callControlId, node.config.initialMessage);
                     // Add to history so AI knows it said it
                     callState.history.push({ role: "assistant", content: node.config.initialMessage });
                }
            }
        }
        break;

      case "Assign Agent":
        console.log("[WorkflowEngine] Assigning to agent...");
        break;

      default:
        console.log(`[WorkflowEngine] Unknown action: ${node.label}`);
    }
  }

  async handleVoiceInput(callControlId: string, transcript: string) {
    if (!transcript || transcript.trim().length < 2) {
      console.log("[WorkflowEngine] Ignoring empty/short transcript");
      return;
    }

    console.log(`[WorkflowEngine] Processing voice input: "${transcript}"`);

    const callState = this.activeCalls.get(callControlId);
    if (!callState) {
        console.warn(`[WorkflowEngine] No active call state for ${callControlId}`);
        return;
    }

    try {
      // Add user input to history
      callState.history.push({ role: "user", content: transcript });

      // Prepare messages for OpenAI
      const messages = [
          { role: "system" as const, content: callState.systemPrompt },
          ...callState.history
      ];

      // 1. Generate AI response
      const response = await this.aiService.generateResponse(messages);

      console.log(`[WorkflowEngine] AI Response: "${response}"`);

      // Add AI response to history
      callState.history.push({ role: "assistant", content: response });

      // 2. Speak response
      await this.telnyxService.speakText(callControlId, response);
    } catch (error) {
      console.error("[WorkflowEngine] Error handling voice input:", error);
    }
  }
}
