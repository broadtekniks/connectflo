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
import { buildIcsInvite } from "./calendarInvite";
import { DateTime } from "luxon";
import { isTenantOpenNow } from "./businessHours";
import { CRMService } from "./crm";

export type WorkflowTriggerResult =
  | { status: "no_workflow"; reason: "not_found" }
  | {
      status: "skipped";
      reason: "after_hours" | "no_trigger_node";
      isOpenNow: false;
      afterHours?: { shouldReply: boolean; text?: string };
    }
  | {
      status: "started";
      workflowId: string;
      executionId: string;
      isOpenNow: boolean;
    };

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
   * Check if a time range falls within working hours
   */
  private checkWithinWorkingHours(
    startTime: string,
    endTime: string,
    workingHours: any,
    workingHoursTimeZone: string
  ): boolean {
    if (!workingHours || typeof workingHours !== "object") return false;

    let start = DateTime.fromISO(startTime, { zone: workingHoursTimeZone });
    let end = DateTime.fromISO(endTime, { zone: workingHoursTimeZone });

    if (!start.isValid || !end.isValid) {
      return false;
    }

    const hasDaysObject = (raw: any): raw is { days: Record<string, any> } =>
      Boolean(
        raw &&
          typeof raw === "object" &&
          raw.days &&
          typeof raw.days === "object"
      );

    const weekdayShort = start.toFormat("ccc").toLowerCase();
    const weekdayLong = (start.weekdayLong || "").toLowerCase();

    let dayConfig: any;
    if (hasDaysObject(workingHours)) {
      dayConfig = workingHours.days?.[weekdayShort];
      if (!dayConfig?.enabled) return false;
    } else {
      dayConfig = workingHours?.[weekdayLong] ?? workingHours?.[weekdayShort];
    }

    const dayStart = String(dayConfig?.start || "").trim();
    const dayEnd = String(dayConfig?.end || "").trim();
    if (!dayStart || !dayEnd) return false;

    const [startHour, startMin] = dayStart.split(":").map(Number);
    const [endHour, endMin] = dayEnd.split(":").map(Number);
    if (
      Number.isNaN(startHour) ||
      Number.isNaN(startMin) ||
      Number.isNaN(endHour) ||
      Number.isNaN(endMin)
    ) {
      return false;
    }

    const workStart = start.set({
      hour: startHour,
      minute: startMin,
      second: 0,
    });
    let workEnd = start.set({ hour: endHour, minute: endMin, second: 0 });

    // Handle overnight shifts (e.g., 22:00 -> 06:00)
    if (workEnd <= workStart) {
      workEnd = workEnd.plus({ days: 1 });
      if (end <= start) {
        end = end.plus({ days: 1 });
      }
    }

    return start >= workStart && end <= workEnd;
  }

  /**
   * Entry point for external events (Webhooks, API calls)
   */
  async trigger(
    triggerType: string,
    contextData: any
  ): Promise<WorkflowTriggerResult> {
    const tenantId: string | undefined =
      (typeof contextData?.tenantId === "string" && contextData.tenantId) ||
      (typeof contextData?.tenant?.id === "string" && contextData.tenant.id) ||
      (typeof contextData?.trigger?.tenantId === "string" &&
        contextData.trigger.tenantId) ||
      undefined;

    const toNumberRaw: string | undefined =
      (typeof contextData?.toNumber === "string" && contextData.toNumber) ||
      (typeof contextData?.phoneNumber === "string" &&
        contextData.phoneNumber) ||
      (typeof contextData?.To === "string" && contextData.To) ||
      (typeof contextData?.message?.to === "string" &&
        contextData.message.to) ||
      (typeof contextData?.call?.to === "string" && contextData.call.to) ||
      (typeof contextData?.trigger?.phoneNumber === "string" &&
        contextData.trigger.phoneNumber) ||
      undefined;

    const toNumber = String(toNumberRaw || "").trim() || undefined;

    const include = {
      tenant: {
        select: {
          id: true,
          businessTimeZone: true,
          businessHours: true,
          chatAfterHoursMode: true,
          chatAfterHoursMessage: true,
        },
      },
      aiConfig: true,
      assignedAgent: {
        select: {
          id: true,
          name: true,
          agentTimeZone: true,
          workingHours: true,
        },
      },
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
    } as any;

    const baseWhere: any = {
      isActive: true,
      triggerType: triggerType,
      ...(tenantId ? { tenantId } : {}),
    };

    let workflow: any = null;

    if (toNumber) {
      workflow = await prisma.workflow.findFirst({
        where: {
          ...baseWhere,
          phoneNumbers: { some: { phoneNumber: { number: toNumber } } },
        },
        include,
        orderBy: { updatedAt: "desc" },
      } as any);
    }

    if (!workflow) {
      workflow = await prisma.workflow.findFirst({
        where: baseWhere,
        include,
        orderBy: { updatedAt: "desc" },
      } as any);
    }

    if (!workflow) {
      return { status: "no_workflow", reason: "not_found" };
    }

    const tenantPrefs: any = workflow.tenant;

    const hasDaysObject = (raw: any): boolean => {
      if (!raw || typeof raw !== "object") return false;
      const days = (raw as any).days;
      return Boolean(days && typeof days === "object");
    };

    const effectiveTimeZone =
      String((workflow.businessTimeZone || "").trim()) ||
      String((tenantPrefs?.businessTimeZone || "").trim()) ||
      "UTC";

    const effectiveBusinessHoursRaw = hasDaysObject(workflow.businessHours)
      ? workflow.businessHours
      : tenantPrefs?.businessHours;

    const bypassBusinessHours = contextData?.bypassBusinessHours === true;
    const isOpenNow = bypassBusinessHours
      ? true
      : isTenantOpenNow({
          tenant: {
            timeZone: effectiveTimeZone,
            businessHours: effectiveBusinessHoursRaw,
          },
        });

    const lastUserText =
      (typeof contextData?.message?.text === "string" &&
        contextData.message.text) ||
      (typeof contextData?.text === "string" && contextData.text) ||
      (typeof contextData?.Body === "string" && contextData.Body) ||
      (typeof contextData?.message === "string" && contextData.message) ||
      "";

    if (!isOpenNow && triggerType === "Incoming Message") {
      const mode = String(
        tenantPrefs?.chatAfterHoursMode || "ONLY_ON_ESCALATION"
      )
        .trim()
        .toUpperCase();

      const defaultAfterHours =
        "We're currently closed, but we've received your message. We'll follow up during business hours.";
      const afterHoursText =
        String(tenantPrefs?.chatAfterHoursMessage || "").trim() ||
        defaultAfterHours;

      const keywordEscalation = String(lastUserText || "")
        .toLowerCase()
        .match(/\b(agent|human|representative|call me|phone call|call back)\b/);

      const escalationNeeded = Boolean(keywordEscalation);

      const shouldReply =
        triggerType === "Incoming Message" &&
        (mode === "ALWAYS" ||
          (mode === "ONLY_ON_ESCALATION" && escalationNeeded));

      return {
        status: "skipped",
        reason: "after_hours",
        isOpenNow: false,
        afterHours: shouldReply
          ? { shouldReply: true, text: afterHoursText }
          : { shouldReply: false },
      };
    }

    const executionId = `exec_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Initialize comprehensive workflow context
    const context: WorkflowContext = {
      execution: {
        id: executionId,
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
        global: { isOpenNow },
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
        assignedAgent: (workflow as any).assignedAgent || undefined,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          businessTimeZone: (workflow as any).businessTimeZone,
          businessHours: (workflow as any).businessHours,
        },
        phoneNumbers: (workflow as any).phoneNumbers.map(
          (wp: any) => wp.phoneNumber
        ),
        documents: (workflow as any).documents.map((wd: any) => wd.document),
        integrations: (workflow as any).integrations.map(
          (wi: any) => wi.integration
        ),
      } as any,
    };

    // Preserve legacy context for backward compatibility
    const legacyContext = {
      ...contextData,
      workflowId: workflow.id,
      workflowTenantId: workflow.tenantId,
      workflowResources: context.resources,
      isOpenNow,
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
      return { status: "skipped", reason: "no_trigger_node", isOpenNow: false };
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

    return {
      status: "started",
      workflowId: workflow.id,
      executionId,
      isOpenNow,
    };
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

        case "integration":
          // Integration nodes are executed the same way as action nodes.
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

          // Fallback for unlabeled condition branches: if there are exactly 2 outgoing edges
          // and they are both unlabeled, treat the first as "yes" and the second as "no".
          const unlabeledEdges = conditionOutgoingEdges.filter(
            (e) => !e.label || !String(e.label).trim()
          );
          if (
            conditionOutgoingEdges.length === 2 &&
            unlabeledEdges.length === 2
          ) {
            const fallbackEdge = conditionResult
              ? conditionOutgoingEdges[0]
              : conditionOutgoingEdges[1];
            console.warn(
              `[WorkflowEngine] Condition edges are unlabeled; using fallback routing (${
                conditionResult ? "yes" : "no"
              } -> ${fallbackEdge.id}). ` +
                `FIX: label edges "yes"/"no" in the workflow builder to make this explicit.`
            );
            const nextNode = nodes.find((n) => n.id === fallbackEdge.target);
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
            return;
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

      case "End Chat":
        // Close the conversation and mark as resolved
        try {
          const conversationId =
            context.conversation?.id ||
            (context.execution as any).conversationId;

          if (conversationId) {
            await prisma.conversation.update({
              where: { id: conversationId },
              data: {
                status: "RESOLVED",
                lastActivity: new Date(),
              },
            });
            console.log(
              `[WorkflowEngine] Conversation ${conversationId} marked as RESOLVED`
            );

            // Send optional goodbye message
            if (config?.message) {
              const goodbyeMessage = config.message;

              if (
                context.conversation?.channel === "CHAT" ||
                context.conversation?.channel === "SMS"
              ) {
                // Send message to conversation
                await prisma.message.create({
                  data: {
                    conversationId,
                    tenantId: context.execution.tenantId,
                    content: goodbyeMessage,
                    sender: "AI",
                  },
                });
                console.log(
                  `[WorkflowEngine] Sent goodbye message to conversation ${conversationId}`
                );
              }
            }
          } else {
            console.warn("[WorkflowEngine] End Chat: No conversation ID found");
          }
        } catch (error) {
          console.error("[WorkflowEngine] Failed to end chat:", error);
        }
        break;

      case "End Call":
        // Terminate voice call with closing message
        try {
          let closingMessage = config?.message;

          // Generate AI closing message if not provided
          if (!closingMessage) {
            const callState = legacyContext.callControlId
              ? this.activeCalls.get(legacyContext.callControlId)
              : null;

            const conversationHistory = callState?.history || [];

            try {
              const messages = [
                {
                  role: "system" as const,
                  content:
                    "Generate a brief, professional closing message for ending a phone call. Keep it under 20 words. Examples: 'Thank you for calling. Have a great day!', 'Thanks for reaching out. Goodbye!', 'Have a wonderful day. Goodbye!'",
                },
                ...(conversationHistory.length > 0
                  ? [
                      {
                        role: "user" as const,
                        content:
                          "Generate a closing message based on our conversation.",
                      },
                    ]
                  : [
                      {
                        role: "user" as const,
                        content: "Generate a professional closing message.",
                      },
                    ]),
              ];

              closingMessage = await this.aiService.generateResponse(messages);
              closingMessage = closingMessage.trim();
              console.log(
                `[WorkflowEngine] AI-generated closing message: ${closingMessage}`
              );
            } catch (aiError) {
              console.error(
                "[WorkflowEngine] Failed to generate AI closing message:",
                aiError
              );
              closingMessage = "Thank you for calling. Have a great day!";
            }
          }

          // Speak closing message before hanging up
          if (legacyContext.type === "voice" && legacyContext.callControlId) {
            console.log(
              `[WorkflowEngine] Speaking closing message: ${closingMessage}`
            );

            await this.telnyxService.speakText(
              legacyContext.callControlId,
              closingMessage
            );

            // Wait for speech to complete (estimate based on message length)
            const estimatedDuration = Math.max(
              2000,
              closingMessage.length * 100
            );
            await new Promise((resolve) =>
              setTimeout(resolve, estimatedDuration)
            );

            // Now hang up the call
            await this.telnyxService.hangupCall(legacyContext.callControlId);
            this.activeCalls.delete(legacyContext.callControlId);
            console.log(
              `[WorkflowEngine] Ended call ${legacyContext.callControlId} after closing message`
            );
          } else if (context.call?.sid) {
            // For Twilio calls - would need TwilioService instance
            console.log(
              `[WorkflowEngine] End Call node - Twilio call ${context.call.sid}`
            );
            // Note: TwilioRealtimeVoiceService handles this automatically via END_CALL_MARKER
          } else {
            console.warn("[WorkflowEngine] End Call: No active call found");
          }
        } catch (error) {
          console.error("[WorkflowEngine] Failed to end call:", error);
        }
        break;

      // Google Calendar Actions
      case "Create Calendar Event":
        try {
          // Recommended default: generate a universal .ics invite and email it.
          const rawAttendees = String(config?.attendees ?? "");
          const attendees = rawAttendees
            .split(",")
            .map((e: string) => e.trim())
            .filter(Boolean);

          const fallbackRecipient = String(
            context.customer?.email ?? ""
          ).trim();
          const to =
            attendees.length > 0
              ? attendees
              : fallbackRecipient
              ? [fallbackRecipient]
              : [];

          if (to.length === 0) {
            console.warn(
              "[WorkflowEngine] Create Calendar Event: No attendees/to address provided and customer.email is empty"
            );
            break;
          }

          const summary =
            String(config?.summary ?? "Meeting").trim() || "Meeting";
          const description =
            String(config?.description ?? "").trim() || undefined;
          const location = String(config?.location ?? "").trim() || undefined;
          const triggerSource: any = (context as any)?.trigger?.source;
          const triggerBooking: any = triggerSource?.booking;

          const startTime =
            String(config?.startTime ?? "").trim() ||
            String(triggerSource?.startTime ?? "").trim() ||
            String(triggerBooking?.startTime ?? "").trim() ||
            String(
              variableResolver.get(
                "variables.workflow.booking.startTime",
                context
              ) ?? ""
            ).trim();

          const endTime =
            String(config?.endTime ?? "").trim() ||
            String(triggerSource?.endTime ?? "").trim() ||
            String(triggerBooking?.endTime ?? "").trim() ||
            String(
              variableResolver.get(
                "variables.workflow.booking.endTime",
                context
              ) ?? ""
            ).trim();

          const timeZone =
            String(config?.timeZone ?? "").trim() ||
            String(triggerSource?.timeZone ?? "").trim() ||
            String(triggerBooking?.timeZone ?? "").trim() ||
            "UTC";

          if (!startTime || !endTime) {
            console.warn(
              "[WorkflowEngine] Create Calendar Event: Missing startTime and/or endTime"
            );
            break;
          }

          // Validate against working hours (agent's if assigned, otherwise tenant's business hours)
          const assignedAgent = (context.resources as any)?.assignedAgent;
          const tenantPrefs = await prisma.tenant.findUnique({
            where: { id: context.execution.tenantId },
            select: {
              calendarAutoAddMeet: true,
              businessHours: true,
              businessTimeZone: true,
            },
          });

          const workflowHours = (context.resources as any)?.workflow
            ?.businessHours;
          const workflowTz = (context.resources as any)?.workflow
            ?.businessTimeZone;

          const hasDaysObject = (raw: any): boolean => {
            if (!raw || typeof raw !== "object") return false;
            const days = (raw as any).days;
            return Boolean(days && typeof days === "object");
          };

          const workingHours = hasDaysObject(workflowHours)
            ? workflowHours
            : assignedAgent?.workingHours || tenantPrefs?.businessHours;

          const workingHoursTimeZone =
            String((workflowTz || "").trim()) ||
            assignedAgent?.agentTimeZone ||
            tenantPrefs?.businessTimeZone ||
            timeZone;

          if (workingHours && typeof workingHours === "object") {
            const isWithinWorkingHours = this.checkWithinWorkingHours(
              startTime,
              endTime,
              workingHours as any,
              workingHoursTimeZone
            );

            if (!isWithinWorkingHours) {
              const scheduleName = assignedAgent
                ? `${assignedAgent.name}'s schedule`
                : "business hours";
              console.warn(
                `[WorkflowEngine] Create Calendar Event: Time ${startTime} is outside ${scheduleName}`
              );
              break;
            }
          }

          // If the tenant has Google Calendar connected, create the event there as well.
          // This is best-effort: failures fall back to .ics email only.
          let googleEvent: {
            eventId?: string;
            htmlLink?: string;
            meetLink?: string;
          } | null = null;
          try {
            const addMeet =
              typeof config?.addMeeting === "boolean"
                ? Boolean(config.addMeeting)
                : tenantPrefs?.calendarAutoAddMeet ?? true;

            const meetingProvider = String(
              config?.meetingProvider ?? ""
            ).trim();

            const googleResult = await this.googleCalendar.createEvent(
              context.execution.tenantId,
              {
                summary,
                description,
                location,
                startTime,
                endTime,
                attendees: Array.isArray(to) ? to : [String(to)],
                timeZone,
                sendUpdates: "none",
                addMeet,
                conferenceSolutionType: meetingProvider || undefined,
              }
            );

            if (googleResult?.success) {
              googleEvent = {
                eventId: googleResult.eventId ?? undefined,
                htmlLink: googleResult.htmlLink ?? undefined,
                meetLink: googleResult.meetLink ?? undefined,
              };

              console.log(
                `[WorkflowEngine] Google Calendar event created (id=${googleResult.eventId})`
              );

              if (googleResult.eventId) {
                variableResolver.set(
                  "variables.workflow.calendarEventId",
                  googleResult.eventId,
                  context
                );
              }
              if (googleResult.htmlLink) {
                variableResolver.set(
                  "variables.workflow.calendarEventHtmlLink",
                  googleResult.htmlLink,
                  context
                );
              }
              if (googleResult.meetLink) {
                variableResolver.set(
                  "variables.workflow.calendarMeetLink",
                  googleResult.meetLink,
                  context
                );
              }
            }
          } catch (error: any) {
            const msg = String(error?.message ?? error ?? "");
            if (msg.toLowerCase().includes("not connected")) {
              console.log(
                "[WorkflowEngine] Google Calendar not connected; sending .ics email invite only"
              );
            } else {
              console.warn(
                "[WorkflowEngine] Google Calendar event create failed; continuing with .ics email invite:",
                error
              );
            }
          }

          const effectiveDescription =
            googleEvent?.meetLink &&
            !String(description ?? "").includes(googleEvent.meetLink)
              ? [
                  String(description ?? "").trim(),
                  `Join: ${googleEvent.meetLink}`,
                ]
                  .filter(Boolean)
                  .join("\n")
              : description;

          const { uid, ics } = buildIcsInvite({
            summary,
            description: effectiveDescription,
            location,
            startTime,
            endTime,
            timeZone,
            organizerEmail: String(config?.from ?? "").trim() || undefined,
            attendees: Array.isArray(to) ? to : [String(to)],
          });

          const subject =
            String(config?.emailSubject ?? "").trim() ||
            `Invitation: ${summary}`;
          const body =
            String(config?.emailBody ?? "").trim() ||
            [
              `You're invited: ${summary}`,
              location ? `Location: ${location}` : "",
              effectiveDescription ? `\n${effectiveDescription}` : "",
              googleEvent?.htmlLink
                ? `\nView in Google Calendar: ${googleEvent.htmlLink}`
                : "",
              "\nThis email includes an .ics calendar invite attachment.",
            ]
              .filter(Boolean)
              .join("\n");

          await this.emailService.sendEmail({
            to,
            subject,
            body,
            isHtml: false,
            from: config?.from,
            replyTo: config?.replyTo,
            attachments: [
              {
                filename: "invite.ics",
                content: ics,
                contentType: "text/calendar; charset=utf-8; method=REQUEST",
              },
            ],
          });

          console.log(
            `[WorkflowEngine] Calendar invite sent (uid=${uid}) to ${
              Array.isArray(to) ? to.join(", ") : to
            }`
          );

          variableResolver.set(
            "variables.workflow.calendarInviteUid",
            uid,
            context
          );
          variableResolver.set(
            "variables.workflow.calendarInviteRecipients",
            Array.isArray(to) ? to.join(",") : String(to),
            context
          );
        } catch (error) {
          console.error(
            "[WorkflowEngine] Failed to send calendar invite:",
            error
          );
        }
        break;

      // HubSpot (CRM) Actions
      case "HubSpot":
      case "HubSpot Search":
      case "HubSpot Create":
      case "HubSpot Update":
      case "HubSpot Get":
      case "HubSpot Log Activity":
        try {
          const tenantId = context.execution.tenantId;

          const connection = await prisma.crmConnection.findFirst({
            where: {
              tenantId,
              crmType: "hubspot",
              status: "active",
            },
            orderBy: { updatedAt: "desc" },
          });

          if (!connection) {
            const msg =
              "HubSpot is not connected for this tenant (or connection is not active).";
            console.warn(`[WorkflowEngine] ${node.label}: ${msg}`);
            variableResolver.set(
              "variables.workflow.hubspotError",
              msg,
              context
            );
            (context as any).hubspot = (context as any).hubspot || {};
            (context as any).hubspot.error = msg;
            break;
          }

          const provider = await CRMService.getProvider(connection.id);

          const actionFromLabel = (): string => {
            const label = String(node.label || "").toLowerCase();
            if (label.includes("search")) return "search";
            if (label.includes("create")) return "create";
            if (label.includes("update")) return "update";
            if (label.includes("log")) return "logActivity";
            if (label.includes("get")) return "getById";
            return "create";
          };

          const action = String(config?.action || actionFromLabel()).trim();
          const objectType = String(config?.objectType || "contact")
            .trim()
            .toLowerCase();

          (context as any).hubspot = (context as any).hubspot || {};
          (context as any).hubspot.connectionId = connection.id;
          (context as any).hubspot.lastAction = { action, objectType };
          variableResolver.set(
            "variables.workflow.hubspotLastAction",
            { action, objectType },
            context
          );

          if (action === "search") {
            if (objectType === "contact") {
              const email = String(
                config?.email || context.customer?.email || ""
              ).trim();
              const phone = String(
                config?.phone || context.customer?.phone || ""
              ).trim();
              const firstName = String(config?.firstName || "").trim();
              const lastName = String(config?.lastName || "").trim();
              const name = String(
                [firstName, lastName].filter(Boolean).join(" ") ||
                  config?.name ||
                  context.customer?.name ||
                  ""
              ).trim();

              const results = await provider.searchContacts({
                ...(email ? { email } : {}),
                ...(phone ? { phone } : {}),
                ...(!email && !phone && name ? { name } : {}),
              });

              (context as any).hubspot.contactSearchResults = results;
              (context as any).hubspot.contact = results?.[0] || null;
              variableResolver.set(
                "variables.workflow.hubspotContactSearchResults",
                results,
                context
              );
            } else if (objectType === "company") {
              const name = String(
                config?.companyName || config?.company || ""
              ).trim();
              const domain = String(config?.domain || "").trim();
              const results = await provider.searchCompanies({
                ...(name ? { name } : {}),
                ...(domain ? { domain } : {}),
              });

              (context as any).hubspot.companySearchResults = results;
              (context as any).hubspot.company = results?.[0] || null;
              variableResolver.set(
                "variables.workflow.hubspotCompanySearchResults",
                results,
                context
              );
            } else if (objectType === "deal") {
              const stage = String(config?.stage || "").trim();
              const contactId =
                String(
                  config?.contactId ||
                    (context as any)?.hubspot?.contact?.id ||
                    ""
                ).trim() || undefined;
              const companyId =
                String(
                  config?.companyId ||
                    (context as any)?.hubspot?.company?.id ||
                    ""
                ).trim() || undefined;
              const results = await provider.searchDeals({
                ...(contactId ? { contactId } : {}),
                ...(companyId ? { companyId } : {}),
                ...(stage ? { stage } : {}),
              });
              (context as any).hubspot.dealSearchResults = results;
              (context as any).hubspot.deal = results?.[0] || null;
              variableResolver.set(
                "variables.workflow.hubspotDealSearchResults",
                results,
                context
              );
            }
          } else if (action === "create") {
            if (objectType === "contact") {
              const email = String(
                config?.email || context.customer?.email || ""
              ).trim();
              const contact = await provider.createContact({
                ...(email ? { email } : {}),
                ...(String(config?.firstName || "").trim()
                  ? { firstName: String(config.firstName).trim() }
                  : {}),
                ...(String(config?.lastName || "").trim()
                  ? { lastName: String(config.lastName).trim() }
                  : {}),
                ...(String(
                  config?.phone || context.customer?.phone || ""
                ).trim()
                  ? {
                      phone: String(
                        config.phone || context.customer?.phone
                      ).trim(),
                    }
                  : {}),
                ...(String(config?.company || "").trim()
                  ? { company: String(config.company).trim() }
                  : {}),
              });
              (context as any).hubspot.contact = contact;
              variableResolver.set(
                "variables.workflow.hubspotContactId",
                contact?.id,
                context
              );
            } else if (objectType === "company") {
              const name = String(
                config?.companyName || config?.company || ""
              ).trim();
              const domain = String(config?.domain || "").trim() || undefined;
              const phone = String(config?.phone || "").trim() || undefined;
              const company = await provider.createCompany({
                ...(name ? { name } : { name: "New Company" }),
                ...(domain ? { domain } : {}),
                ...(phone ? { phone } : {}),
              } as any);
              (context as any).hubspot.company = company;
              variableResolver.set(
                "variables.workflow.hubspotCompanyId",
                company?.id,
                context
              );
            } else if (objectType === "deal") {
              const name = String(config?.dealName || "").trim() || "New Deal";
              const amountRaw = String(config?.amount || "").trim();
              const amount = amountRaw ? Number(amountRaw) : undefined;
              const stage = String(config?.stage || "").trim() || undefined;
              const closeDate =
                String(config?.closeDate || "").trim() || undefined;
              const deal = await provider.createDeal({
                name,
                ...(typeof amount === "number" && !Number.isNaN(amount)
                  ? { amount }
                  : {}),
                ...(stage ? { stage } : {}),
                ...(closeDate ? { closeDate } : {}),
              } as any);
              (context as any).hubspot.deal = deal;
              variableResolver.set(
                "variables.workflow.hubspotDealId",
                deal?.id,
                context
              );
            }
          } else if (action === "getById") {
            const recordId = String(config?.recordId || "").trim();
            if (!recordId) {
              const msg = "HubSpot Get by ID requires a recordId.";
              console.warn(`[WorkflowEngine] ${node.label}: ${msg}`);
              variableResolver.set(
                "variables.workflow.hubspotError",
                msg,
                context
              );
              break;
            }

            if (objectType === "contact") {
              const contact = await provider.getContact(recordId);
              (context as any).hubspot.contact = contact;
            } else if (objectType === "company") {
              const company = await provider.getCompany(recordId);
              (context as any).hubspot.company = company;
            } else if (objectType === "deal") {
              const deal = await provider.getDeal(recordId);
              (context as any).hubspot.deal = deal;
            }
          } else if (action === "update") {
            const recordId = String(config?.recordId || "").trim();
            if (!recordId) {
              const msg = "HubSpot Update requires a recordId.";
              console.warn(`[WorkflowEngine] ${node.label}: ${msg}`);
              variableResolver.set(
                "variables.workflow.hubspotError",
                msg,
                context
              );
              break;
            }

            if (objectType === "contact") {
              const contact = await provider.updateContact(recordId, {
                ...(String(config?.email || "").trim()
                  ? { email: String(config.email).trim() }
                  : {}),
                ...(String(config?.firstName || "").trim()
                  ? { firstName: String(config.firstName).trim() }
                  : {}),
                ...(String(config?.lastName || "").trim()
                  ? { lastName: String(config.lastName).trim() }
                  : {}),
                ...(String(config?.phone || "").trim()
                  ? { phone: String(config.phone).trim() }
                  : {}),
                ...(String(config?.company || "").trim()
                  ? { company: String(config.company).trim() }
                  : {}),
              });
              (context as any).hubspot.contact = contact;
            } else if (objectType === "company") {
              const company = await provider.updateCompany(recordId, {
                ...(String(config?.companyName || "").trim()
                  ? { name: String(config.companyName).trim() }
                  : {}),
                ...(String(config?.domain || "").trim()
                  ? { domain: String(config.domain).trim() }
                  : {}),
                ...(String(config?.phone || "").trim()
                  ? { phone: String(config.phone).trim() }
                  : {}),
              } as any);
              (context as any).hubspot.company = company;
            } else if (objectType === "deal") {
              const amountRaw = String(config?.amount || "").trim();
              const amount = amountRaw ? Number(amountRaw) : undefined;
              const deal = await provider.updateDeal(recordId, {
                ...(String(config?.dealName || "").trim()
                  ? { name: String(config.dealName).trim() }
                  : {}),
                ...(typeof amount === "number" && !Number.isNaN(amount)
                  ? { amount }
                  : {}),
                ...(String(config?.stage || "").trim()
                  ? { stage: String(config.stage).trim() }
                  : {}),
                ...(String(config?.closeDate || "").trim()
                  ? { closeDate: String(config.closeDate).trim() }
                  : {}),
              } as any);
              (context as any).hubspot.deal = deal;
            }
          } else if (action === "logActivity") {
            const activityType = String(config?.activityType || "note")
              .trim()
              .toLowerCase();
            const associatedRecordId = String(
              config?.associatedRecordId || ""
            ).trim();
            const notes = String(config?.activityNotes || "").trim();
            const duration = config?.callDuration
              ? Number(config.callDuration)
              : undefined;

            const activity = await provider.logActivity({
              type: (activityType as any) || "note",
              subject:
                String(config?.activitySubject || "").trim() || undefined,
              notes: notes || undefined,
              timestamp: new Date().toISOString(),
              ...(typeof duration === "number" && !Number.isNaN(duration)
                ? { duration }
                : {}),
              ...(associatedRecordId ? { contactId: associatedRecordId } : {}),
            } as any);

            (context as any).hubspot.lastActivity = activity;
            variableResolver.set(
              "variables.workflow.hubspotLastActivityId",
              activity?.id,
              context
            );
          }

          // Clear any previous error
          variableResolver.delete("variables.workflow.hubspotError", context);
        } catch (error: any) {
          const msg = String(error?.message || error || "HubSpot error");
          console.error(`[WorkflowEngine] ${node.label} failed:`, error);
          variableResolver.set("variables.workflow.hubspotError", msg, context);
          (context as any).hubspot = (context as any).hubspot || {};
          (context as any).hubspot.error = msg;
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
          const errAny = error as any;
          const errMessage = String(
            errAny?.message ||
              errAny?.response?.data?.error?.message ||
              "Failed to send Gmail"
          );

          const isApiDisabled =
            /gmail api has not been used|gmail\.googleapis\.com|it is disabled/i.test(
              errMessage
            );

          if (isApiDisabled) {
            console.error(
              "[WorkflowEngine] Failed to send Gmail: Gmail API is disabled for the Google Cloud project used by your OAuth client. " +
                "Enable the Gmail API in Google Cloud Console for that project, then retry (may take a few minutes to propagate).\n" +
                `Details: ${errMessage}`
            );
          } else {
            console.error(
              `[WorkflowEngine] Failed to send Gmail: ${errMessage}`
            );
          }

          variableResolver.set(
            "variables.workflow.gmailSendError",
            errMessage,
            context
          );
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
          const spreadsheetId = variableResolver.resolve(
            config?.spreadsheetId || "",
            context
          );
          const sheetName = variableResolver.resolve(
            config?.sheetName || "Sheet1",
            context
          );

          // Resolve variables in row values
          const rawValues = Array.isArray(config?.values) ? config.values : [];
          const resolvedValues = rawValues.map((val: any) =>
            typeof val === "string"
              ? variableResolver.resolve(val, context)
              : val
          );

          if (!spreadsheetId) {
            console.warn(
              "[WorkflowEngine] No spreadsheet ID provided for Add Row to Sheet"
            );
            break;
          }

          const sheetResult = await this.googleSheets.appendRow(
            context.execution.tenantId,
            spreadsheetId,
            sheetName,
            resolvedValues
          );
          console.log(
            `[WorkflowEngine] Row added to sheet: ${sheetResult.updatedRange}`
          );

          variableResolver.set(
            "variables.workflow.sheetUpdatedRange",
            sheetResult.updatedRange,
            context
          );

          // If this is a lead capture, save to database too
          if (config?.saveAsLead) {
            try {
              await prisma.leadCapture.create({
                data: {
                  tenantId: context.execution.tenantId,
                  customerId: context.customer?.id,
                  name:
                    variableResolver.resolve(config?.leadName || "", context) ||
                    context.customer?.name,
                  email:
                    variableResolver.resolve(
                      config?.leadEmail || "",
                      context
                    ) || context.customer?.email,
                  phone: variableResolver.resolve(
                    config?.leadPhone || "",
                    context
                  ),
                  source: (context.trigger as any)?.channel || "workflow",
                  status: "NEW",
                  notes: variableResolver.resolve(
                    config?.leadNotes || "",
                    context
                  ),
                  spreadsheetId,
                  conversationId: (context.execution as any).conversationId,
                  metadata: {
                    workflowId: context.execution.workflowId,
                    nodeId: node.id,
                    sheetName,
                  },
                },
              });
              console.log("[WorkflowEngine] Lead capture saved to database");
            } catch (leadError) {
              console.error(
                "[WorkflowEngine] Failed to save lead capture:",
                leadError
              );
            }
          }
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
