import prisma from "../lib/prisma";
import { TelnyxService } from "./telnyx";
import { OpenAIService } from "./ai/openai";
import { KnowledgeBaseService } from "./knowledgeBase";
import { variableResolver, WorkflowContext } from "./variableResolver";
import { conditionEvaluator, ConditionConfig } from "./conditionEvaluator";
import { EmailService } from "./email";
import { applyToneOfVoiceToSystemPrompt } from "./ai/toneOfVoice";
import { GoogleCalendarService } from "./integrations/google/calendar";
import { GoogleGmailService } from "./integrations/google/gmail";
import { GoogleDriveService } from "./integrations/google/drive";
import { GoogleSheetsService } from "./integrations/google/sheets";

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
  private kbService: KnowledgeBaseService;
  private emailService: EmailService;
  private googleCalendar: GoogleCalendarService;
  private googleGmail: GoogleGmailService;
  private googleDrive: GoogleDriveService;
  private googleSheets: GoogleSheetsService;
  private activeCalls: Map<
    string,
    {
      systemPrompt: string;
      toneOfVoice?: string;
      history: { role: "user" | "assistant" | "system"; content: string }[];
      workflowId?: string;
      tenantId?: string;
      documentIds?: string[];
    }
  > = new Map();

  constructor() {
    this.telnyxService = new TelnyxService();
    this.aiService = new OpenAIService();
    this.kbService = new KnowledgeBaseService();
    this.emailService = new EmailService();
    this.googleCalendar = new GoogleCalendarService();
    this.googleGmail = new GoogleGmailService();
    this.googleDrive = new GoogleDriveService();
    this.googleSheets = new GoogleSheetsService();
  }

  /**
   * Entry point for external events (Webhooks, API calls)
   */
  async trigger(triggerType: string, contextData: any) {
    // Find the active workflow for this trigger type and load assigned resources
    const workflow = await prisma.workflow.findFirst({
      where: {
        isActive: true,
        triggerType: triggerType,
      },
      include: {
        aiConfig: true,
        phoneNumbers: {
          include: { phoneNumber: true },
        },
        documents: {
          include: {
            document: {
              include: { chunks: true },
            },
          },
        },
        integrations: {
          include: { integration: true },
        },
      },
    });

    if (!workflow) {
      return;
    }

    // Initialize comprehensive workflow context
    const context: WorkflowContext = {
      execution: {
        id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workflowId: workflow.id,
        tenantId: workflow.tenantId,
        startedAt: new Date(),
      },
      trigger: {
        type: triggerType,
        source: contextData,
      },
      variables: {
        workflow: {},
        conversation: {},
        global: {},
      },
      customer: {
        id: contextData.customerId,
        name: contextData.customerName,
        email: contextData.customerEmail,
        phone: contextData.fromNumber || contextData.phoneNumber,
        metadata: {},
      },
      conversation: {
        id: contextData.conversationId,
        channel:
          contextData.type ||
          (triggerType === "Incoming Call" ? "phone" : "chat"),
        status: "active",
        messages: [],
        lastMessage: contextData.message || contextData.transcript,
        createdAt: new Date(),
      },
      call:
        contextData.type === "voice"
          ? {
              sid: contextData.CallSid,
              from: contextData.fromNumber || contextData.From,
              to: contextData.phoneNumber || contextData.To,
              status: contextData.CallStatus,
              direction: contextData.Direction,
            }
          : undefined,
      resources: {
        aiConfig: (workflow as any).aiConfig,
        phoneNumbers: (workflow as any).phoneNumbers.map(
          (wp: any) => wp.phoneNumber
        ),
        documents: (workflow as any).documents.map((wd: any) => wd.document),
        integrations: (workflow as any).integrations.map(
          (wi: any) => wi.integration
        ),
      },
    };

    // Preserve legacy context for backward compatibility
    const legacyContext = {
      ...contextData,
      workflowId: workflow.id,
      workflowTenantId: workflow.tenantId,
      workflowResources: context.resources,
    };

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
    if (triggerType === "Incoming Call" && legacyContext.callControlId) {
      const workflowAiConfig: any = (workflow as any).aiConfig;
      const workflowToneOfVoice = String(
        (workflow as any)?.toneOfVoice ?? ""
      ).trim();
      const configToneOfVoice = String(
        workflowAiConfig?.toneOfVoice ?? ""
      ).trim();
      const effectiveToneOfVoice = workflowToneOfVoice || configToneOfVoice;

      const businessInfo = String(
        workflowAiConfig?.businessDescription ?? ""
      ).trim();
      let baseSystemPrompt =
        String(workflowAiConfig?.systemPrompt ?? "").trim() ||
        "You are a helpful assistant.";
      if (businessInfo) {
        baseSystemPrompt = `${baseSystemPrompt}\n\nBusiness Context: ${businessInfo}`;
      }
      baseSystemPrompt = applyToneOfVoiceToSystemPrompt(
        baseSystemPrompt,
        effectiveToneOfVoice
      );

      // Initialize call state with workflow context
      this.activeCalls.set(legacyContext.callControlId, {
        systemPrompt: baseSystemPrompt,
        toneOfVoice: effectiveToneOfVoice || undefined,
        history: [],
        workflowId: workflow.id,
        tenantId: workflow.tenantId,
        documentIds: (workflow as any).documents.map(
          (wd: any) => wd.document.id
        ),
      });

      await this.telnyxService.answerCall(legacyContext.callControlId);

      // Resolve variables in greeting
      const greetingTemplate = triggerNode.config?.greeting;
      if (greetingTemplate) {
        const greeting = variableResolver.resolve(greetingTemplate, context);
        await this.telnyxService.speakText(
          legacyContext.callControlId,
          greeting
        );
        // Transcription will be started when speak.ended event is received
      } else {
        // No greeting, start transcription immediately
        await this.telnyxService.startTranscription(
          legacyContext.callControlId
        );
      }
    }

    // 4. Start execution
    await this.executeNode(triggerNode, nodes, edges, context, legacyContext);
  }

  private async executeNode(
    node: WorkflowNode,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    context: WorkflowContext,
    legacyContext: any
  ) {
    console.log(
      `[WorkflowEngine] Executing node: ${node.label} (${node.type})`
    );

    try {
      // Resolve variables in node config before execution
      const resolvedConfig = variableResolver.resolveObject(
        node.config || {},
        context
      );

      // --- EXECUTE ACTION ---
      let nextNodeId: string | null = null;

      switch (node.type) {
        case "trigger":
          // Just pass through, maybe enrich context
          break;

        case "action":
          await this.handleAction(node, resolvedConfig, context, legacyContext);
          break;

        case "condition":
          // Evaluate condition and determine which path to take
          const conditionConfig = node.config?.condition as ConditionConfig;

          if (!conditionConfig) {
            console.warn(
              `[WorkflowEngine] Condition node ${node.id} has no condition config`
            );
            break;
          }

          const conditionResult = conditionEvaluator.evaluate(
            conditionConfig,
            context
          );
          console.log(
            `[WorkflowEngine] Condition ${node.id} evaluated to: ${conditionResult}`
          );

          // Find outgoing edges for this node
          const conditionOutgoingEdges = edges.filter(
            (e) => e.source === node.id
          );

          console.log(
            `[WorkflowEngine] Condition has ${conditionOutgoingEdges.length} outgoing edges:`,
            conditionOutgoingEdges.map((e) => ({
              id: e.id,
              label: e.label || "(no label)",
            }))
          );

          // Find the appropriate edge based on condition result
          const targetLabel = conditionResult ? "yes" : "no";
          const conditionEdge = conditionOutgoingEdges.find(
            (e) =>
              e.label?.toLowerCase() === targetLabel ||
              e.label?.toLowerCase() === String(conditionResult)
          );

          if (conditionEdge) {
            const nextNode = nodes.find((n) => n.id === conditionEdge.target);
            if (nextNode) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              await this.executeNode(
                nextNode,
                nodes,
                edges,
                context,
                legacyContext
              );
            }
            return; // Exit early since we handled routing
          }

          console.warn(
            `[WorkflowEngine] No matching edge found for condition result: ${conditionResult}.`,
            `Looking for edge with label "${targetLabel}".`,
            `Available edges:`,
            conditionOutgoingEdges
              .map((e) => `"${e.label || "(unlabeled)"}"`)
              .join(", "),
            `\nFIX: Click the edge in the workflow builder and set its label to "${targetLabel}"`
          );
          return; // Exit if no matching edge
      }

      // --- FIND NEXT NODE ---
      // Simple traversal: find edge where source == node.id
      const outgoingEdges = edges.filter((e) => e.source === node.id);

      if (outgoingEdges.length === 0) {
        return;
      }

      // For simple linear flows, just take the first edge
      // For conditions, routing is handled above
      const nextEdge = outgoingEdges[0];
      const nextNode = nodes.find((n) => n.id === nextEdge.target);

      if (nextNode) {
        // Add a small delay to prevent race conditions or stack overflows in tight loops
        await new Promise((resolve) => setTimeout(resolve, 100));
        await this.executeNode(nextNode, nodes, edges, context, legacyContext);
      }
    } catch (error) {
      console.error(`[WorkflowEngine] Error executing node ${node.id}:`, error);
    }
  }

  private async handleAction(
    node: WorkflowNode,
    config: any,
    context: WorkflowContext,
    legacyContext: any
  ) {
    switch (node.label) {
      case "Send Reply":
      case "Send SMS":
        // Variables are already resolved in config.message
        const text = config?.message || "Hello from ConnectFlo!";

        if (legacyContext.type === "voice" && legacyContext.callControlId) {
          await this.telnyxService.speakText(legacyContext.callControlId, text);
        } else if (legacyContext.phoneNumber || legacyContext.fromNumber) {
          // context.phoneNumber is the customer, context.fromNumber is our number
          // In a real webhook, these might be reversed depending on direction
          // await this.telnyxService.sendSms(context.fromNumber, context.phoneNumber, text);
        }
        break;

      case "Set Variable":
        // Set a workflow variable
        if (config?.variableName && config?.value !== undefined) {
          variableResolver.set(
            `variables.workflow.${config.variableName}`,
            config.value,
            context
          );
          console.log(
            `[WorkflowEngine] Set variable: ${config.variableName} = ${config.value}`
          );
        }
        break;

      case "AI Generate":
        if (legacyContext.type === "voice" && legacyContext.callControlId) {
          const callState = this.activeCalls.get(legacyContext.callControlId);
          if (callState) {
            // Update system prompt from node config if available (already resolved)
            if (config?.systemPrompt) {
              callState.systemPrompt = applyToneOfVoiceToSystemPrompt(
                config.systemPrompt,
                callState.toneOfVoice
              );
            }

            // If there's an initial message to speak, speak it (already resolved)
            if (config?.initialMessage) {
              await this.telnyxService.speakText(
                legacyContext.callControlId,
                config.initialMessage
              );
              // Add to history so AI knows it said it
              callState.history.push({
                role: "assistant",
                content: config.initialMessage,
              });
            }
          }
        }
        break;

      case "Send Email":
        // Send email using Nodemailer
        const to = String(config?.to ?? "").trim();
        const subject = String(config?.subject ?? "").trim();
        const body = String(config?.body ?? "").trim();
        const isHtml = Boolean(config?.isHtml);

        const missingFields: string[] = [];
        if (!to) missingFields.push("to");
        if (!subject) missingFields.push("subject");
        if (!body) missingFields.push("body");
        if (missingFields.length > 0) {
          console.warn(
            `[WorkflowEngine] Send Email: Missing required field(s): ${missingFields.join(
              ", "
            )}`
          );
          break;
        }

        try {
          await this.emailService.sendEmail({
            to,
            subject,
            body,
            isHtml,
            from: config?.from,
            replyTo: config?.replyTo,
          });
          console.log(`[WorkflowEngine] Email sent to ${to}`);
        } catch (error) {
          console.error("[WorkflowEngine] Failed to send email:", error);
        }
        break;

      case "Assign Agent":
        // Handle agent assignment
        break;

      // Google Calendar Actions
      case "Create Calendar Event":
        try {
          const eventResult = await this.googleCalendar.createEvent(
            context.execution.tenantId,
            {
              summary: config?.summary || "Meeting",
              description: config?.description,
              startTime: config?.startTime,
              endTime: config?.endTime,
              attendees: config?.attendees
                ?.split(",")
                .map((e: string) => e.trim()),
              location: config?.location,
              timeZone: config?.timeZone,
            }
          );
          console.log(
            `[WorkflowEngine] Calendar event created: ${eventResult.eventId}`
          );

          // Store result in context variables
          variableResolver.set(
            "variables.workflow.calendarEventId",
            eventResult.eventId,
            context
          );
          variableResolver.set(
            "variables.workflow.calendarEventLink",
            eventResult.htmlLink,
            context
          );
          variableResolver.set(
            "variables.workflow.meetLink",
            eventResult.meetLink,
            context
          );
        } catch (error) {
          console.error(
            "[WorkflowEngine] Failed to create calendar event:",
            error
          );
        }
        break;

      // Gmail Actions
      case "Send Gmail":
        try {
          const emailResult = await this.googleGmail.sendEmail(
            context.execution.tenantId,
            {
              to: config?.to,
              subject: config?.subject || "Message from ConnectFlo",
              body: config?.body || "",
              isHtml: config?.isHtml || false,
              cc: config?.cc,
              bcc: config?.bcc,
            }
          );
          console.log(`[WorkflowEngine] Gmail sent: ${emailResult.messageId}`);

          variableResolver.set(
            "variables.workflow.emailMessageId",
            emailResult.messageId,
            context
          );
        } catch (error) {
          console.error("[WorkflowEngine] Failed to send Gmail:", error);
        }
        break;

      // Google Drive Actions
      case "Upload to Drive":
        try {
          const driveResult = await this.googleDrive.uploadFile(
            context.execution.tenantId,
            {
              name: config?.fileName || "document.txt",
              content: config?.fileContent || "",
              mimeType: config?.mimeType || "text/plain",
              folderId: config?.folderId,
            }
          );
          console.log(
            `[WorkflowEngine] File uploaded to Drive: ${driveResult.fileId}`
          );

          variableResolver.set(
            "variables.workflow.driveFileId",
            driveResult.fileId,
            context
          );
          variableResolver.set(
            "variables.workflow.driveFileLink",
            driveResult.webViewLink,
            context
          );
        } catch (error) {
          console.error("[WorkflowEngine] Failed to upload to Drive:", error);
        }
        break;

      // Google Sheets Actions
      case "Add Row to Sheet":
        try {
          const sheetResult = await this.googleSheets.appendRow(
            context.execution.tenantId,
            config?.spreadsheetId,
            config?.sheetName || "Sheet1",
            config?.values || []
          );
          console.log(
            `[WorkflowEngine] Row added to sheet: ${sheetResult.updatedRange}`
          );

          variableResolver.set(
            "variables.workflow.sheetUpdatedRange",
            sheetResult.updatedRange,
            context
          );
        } catch (error) {
          console.error("[WorkflowEngine] Failed to add row to sheet:", error);
        }
        break;

      default:
        break;
    }
  }

  async handleVoiceInput(callControlId: string, transcript: string) {
    if (!transcript || transcript.trim().length < 2) {
      return;
    }

    const callState = this.activeCalls.get(callControlId);
    if (!callState) {
      console.warn(
        `[WorkflowEngine] No active call state for ${callControlId}`
      );
      return;
    }

    try {
      // Add user input to history
      callState.history.push({ role: "user", content: transcript });

      // RAG: Search for relevant context
      // Use tenant from call state (set when call was initialized)
      const tenantId = callState.tenantId;

      if (!tenantId) {
        console.warn("[WorkflowEngine] No tenantId found, skipping KB search");
        const messages = [
          { role: "system" as const, content: callState.systemPrompt },
          ...callState.history,
        ];
        const response = await this.aiService.generateResponse(messages);
        callState.history.push({ role: "assistant", content: response });
        await this.telnyxService.speakText(callControlId, response);
        return;
      }

      // Get assigned document IDs from call state
      const documentIds = callState.documentIds || [];

      const relevantDocs = await this.kbService.search(
        transcript,
        tenantId,
        10,
        documentIds
      );
      let kbContext = "";
      if (relevantDocs.length > 0) {
        kbContext = `Relevant Knowledge Base Info:\n${relevantDocs.join(
          "\n\n"
        )}`;
      }

      // Prepare messages for OpenAI
      const messages = [
        {
          role: "system" as const,
          content: `${callState.systemPrompt}\n\n${kbContext}`,
        },
        ...callState.history,
      ];

      // 1. Generate AI response
      const response = await this.aiService.generateResponse(messages);

      // Add AI response to history
      callState.history.push({ role: "assistant", content: response });

      // 2. Speak response
      await this.telnyxService.speakText(callControlId, response);
    } catch (error) {
      console.error("[WorkflowEngine] Error handling voice input:", error);
    }
  }

  /**
   * Handle speak.ended event - start transcription after greeting finishes
   */
  async handleSpeakEnded(callControlId: string) {
    try {
      const callState = this.activeCalls.get(callControlId);
      if (!callState) {
        console.warn(
          `[WorkflowEngine] No call state found for ${callControlId}`
        );
        return;
      }

      // Start transcription now that greeting has finished
      await this.telnyxService.startTranscription(callControlId);
      console.log(
        `[WorkflowEngine] Started transcription for ${callControlId} after greeting`
      );
    } catch (error) {
      console.error("[WorkflowEngine] Error handling speak ended:", error);
    }
  }
}
