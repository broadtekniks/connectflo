import { Router, Request, Response } from "express";
import { Server as WebSocketServer } from "ws";
import { URL } from "url";
import prisma from "../lib/prisma";
import { twilioRealtimeVoiceService } from "../services/twilioRealtimeVoice";
import { hybridVoiceService } from "../services/hybridVoice";
import { applyToneOfVoiceToSystemPrompt } from "../services/ai/toneOfVoice";
import { isTenantOpenNow } from "../services/businessHours";
import { UsageService } from "../services/usage";
import {
  isNowWithinWorkingHours,
  normalizeWorkingHoursConfig,
} from "../services/agentSchedule";
import { isWebPhoneReady } from "../services/webPhonePresence";
import {
  parseTwilioClientIdentity,
  toTwilioClientIdentity,
} from "../services/twilioClientIdentity";

const router = Router();

const usageService = new UsageService();

type WorkflowNode = {
  id: string;
  type: string;
  label: string;
  config?: any;
};

type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

type DialTarget =
  | { type: "external"; number: string }
  | { type: "user"; userId: string; number: string; clientIdentity?: string }
  | {
      type: "callGroup";
      callGroupId: string;
      memberUserIds: string[];
      numbers: string[];
      clientIdentities: string[];
    };

function deriveTwilioDialActionUrl(
  req: Request,
  params: Record<string, string>
): string {
  const base = String(process.env.TWILIO_WEBHOOK_URL || "").trim();
  const dialPath = base.endsWith("/voice")
    ? base.replace(/\/voice$/, "/dial-action")
    : base.endsWith("/webhooks/twilio")
    ? `${base}/dial-action`
    : base
    ? base.endsWith("/")
      ? `${base}dial-action`
      : `${base}/dial-action`
    : `${req.protocol}://${req.get("host")}${req.baseUrl}/dial-action`;

  const url = new URL(dialPath);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

function buildTwilioStreamTwiml(publicUrl: string): string {
  const streamUrl = `${publicUrl}/ws/twilio`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
}

function buildTwilioDialTwiml(options: {
  toCallerId: string;
  numbers: string[];
  clients?: string[];
  timeoutSeconds: number;
  actionUrl: string;
}): string {
  const callerId = escapeXml(options.toCallerId);
  const timeout = Math.min(
    60,
    Math.max(5, Math.floor(options.timeoutSeconds || 20))
  );
  const actionUrl = escapeXml(options.actionUrl);
  const numbers = options.numbers
    .map((n) => `<Number>${escapeXml(n)}</Number>`)
    .join("\n    ");
  const clients = (options.clients || [])
    .filter(Boolean)
    .map((c) => `<Client>${escapeXml(c)}</Client>`)
    .join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" timeout="${timeout}" action="${actionUrl}" method="POST" answerOnBridge="true">
    ${numbers}
    ${clients}
  </Dial>
</Response>`;
}

function buildTwilioClientOutboundTwiml(options: {
  callerId?: string;
  toNumber?: string;
  toClient?: string;
}): string {
  const toNumber = options.toNumber ? escapeXml(options.toNumber) : "";
  const toClient = options.toClient ? escapeXml(options.toClient) : "";

  if (toClient) {
    // For Client-to-Client calls, omit callerId to avoid carrier-style callerId rules interfering.
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true">
    <Client>${toClient}</Client>
  </Dial>
</Response>`;
  }

  if (!toNumber) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Reject/></Response>`;
  }

  const callerId = String(options.callerId || "").trim();
  if (!callerId) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Reject/></Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}" answerOnBridge="true">
    <Number>${toNumber}</Number>
  </Dial>
</Response>`;
}

function getWorkflowGraph(selectedWorkflow: any): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const nodes = Array.isArray(selectedWorkflow?.nodes)
    ? (selectedWorkflow.nodes as any[])
    : [];
  const edges = Array.isArray(selectedWorkflow?.edges)
    ? (selectedWorkflow.edges as any[])
    : [];
  return {
    nodes: nodes.filter(Boolean) as WorkflowNode[],
    edges: edges.filter(Boolean) as WorkflowEdge[],
  };
}

function getFirstNodeAfterTrigger(graph: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}): WorkflowNode | null {
  const trigger =
    graph.nodes.find(
      (n) => n?.type === "trigger" && n?.label === "Incoming Call"
    ) ||
    graph.nodes.find((n) => n?.type === "trigger") ||
    null;
  if (!trigger) return null;

  const out = graph.edges.filter((e) => e.source === trigger.id);
  if (!out.length) return null;

  const first = out[0];
  const next = graph.nodes.find((n) => n.id === first.target) || null;
  return next;
}

function normalizeE164Like(raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return "";
  // Keep + and digits.
  const cleaned = v.replace(/[^+0-9]/g, "");
  return cleaned;
}

async function resolveDialTargetsFromNode(input: {
  tenantId: string;
  phoneNumberId: string;
  toNumber: string;
  node: WorkflowNode;
}): Promise<
  { targets: DialTarget[]; timeoutSeconds: number } | { error: string }
> {
  const { tenantId, node } = input;
  const label = String(node.label || "").trim();
  const config = (node as any)?.config ?? {};

  const timeoutSecondsInput = Number(
    config?.timeoutSeconds ?? config?.ringTimeoutSeconds
  );
  const timeoutSeconds = Number.isFinite(timeoutSecondsInput)
    ? Math.min(60, Math.max(5, Math.floor(timeoutSecondsInput)))
    : 20;

  const tenant = await (prisma as any).tenant.findUnique({
    where: { id: tenantId },
    select: {
      businessTimeZone: true,
      businessHours: true,
      restrictExternalForwarding: true,
      externalForwardingAllowList: true,
    },
  });

  const tenantTimeZone = String(tenant?.businessTimeZone || "").trim();
  const tenantHours = normalizeWorkingHoursConfig(
    (tenant as any)?.businessHours as any
  );

  const shouldRespectWorkingHours = Boolean(
    config?.respectWorkingHours ?? true
  );
  const onlyCheckedIn = Boolean(config?.onlyCheckedIn ?? true);

  const isTenantOpen =
    tenantTimeZone && tenantHours && shouldRespectWorkingHours
      ? isTenantOpenNow({
          tenant: {
            timeZone: tenantTimeZone,
            businessHours: tenantHours as any,
          },
        })
      : true;

  const agentIsOpenNow = (user: any): boolean => {
    if (!shouldRespectWorkingHours) return true;
    const userTz = String(user?.agentTimeZone || "").trim();
    const userHours = normalizeWorkingHoursConfig(user?.workingHours);
    if (userTz && userHours) {
      return isNowWithinWorkingHours({
        workingHours: userHours,
        timeZone: userTz,
      }).isOpen;
    }

    if (tenantTimeZone && tenantHours) {
      return isTenantOpen;
    }

    return true;
  };

  const buildUserTarget = (user: any): DialTarget | null => {
    if (onlyCheckedIn && !user?.isCheckedIn) return null;
    if (!agentIsOpenNow(user)) return null;
    const number = normalizeE164Like(user?.forwardingPhoneNumber || "");
    if (!number) return null;

    const clientIdentity = (() => {
      const ready =
        tenantId && user?.id
          ? isWebPhoneReady({ tenantId, userId: String(user.id) })
          : false;
      return ready
        ? toTwilioClientIdentity({ tenantId, userId: String(user.id) })
        : undefined;
    })();

    return { type: "user", userId: user.id, number, clientIdentity };
  };

  if (label === "Call Forwarding") {
    const overrideNumber = normalizeE164Like(
      (config?.overrideNumber ?? config?.forwardingNumberOverride ?? "") as any
    );
    if (overrideNumber) {
      if ((tenant as any)?.restrictExternalForwarding) {
        const allowList = Array.isArray(
          (tenant as any)?.externalForwardingAllowList
        )
          ? (tenant as any).externalForwardingAllowList
          : [];
        if (!allowList.includes(overrideNumber)) {
          return {
            error: "External forwarding number is not allowed for this tenant",
          };
        }
      }
      return {
        targets: [{ type: "external", number: overrideNumber }],
        timeoutSeconds,
      };
    }

    const targetType = String(config?.targetType || "").trim();
    if (targetType === "external") {
      const number = normalizeE164Like(config?.externalNumber || "");
      if (!number) return { error: "Missing external forwarding number" };
      if ((tenant as any)?.restrictExternalForwarding) {
        const allowList = Array.isArray(
          (tenant as any)?.externalForwardingAllowList
        )
          ? (tenant as any).externalForwardingAllowList
          : [];
        if (!allowList.includes(number)) {
          return {
            error: "External forwarding number is not allowed for this tenant",
          };
        }
      }
      return { targets: [{ type: "external", number }], timeoutSeconds };
    }

    if (targetType === "user") {
      const userId = String(config?.userId || "").trim();
      if (!userId) return { error: "Missing userId for forwarding" };
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
          role: { in: ["TENANT_ADMIN", "AGENT"] },
        },
        select: {
          id: true,
          isCheckedIn: true,
          agentTimeZone: true,
          workingHours: true,
          forwardingPhoneNumber: true,
        } as any,
      });
      if (!user) return { error: "User not found" };
      const t = buildUserTarget(user);
      if (!t) return { error: "User is not available for forwarding" };
      return { targets: [t], timeoutSeconds };
    }

    if (targetType === "callGroup") {
      const callGroupId = String(config?.callGroupId || "").trim();
      if (!callGroupId) return { error: "Missing callGroupId for forwarding" };

      const group = await (prisma as any).callGroup.findFirst({
        where: { id: callGroupId, tenantId },
        include: {
          members: {
            orderBy: { order: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  isCheckedIn: true,
                  agentTimeZone: true,
                  workingHours: true,
                  forwardingPhoneNumber: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!group) return { error: "Call group not found" };

      const members = group.members
        .map((m: any) => m.user)
        .filter(
          (u: any) => u && (u.role === "TENANT_ADMIN" || u.role === "AGENT")
        );

      const targets: DialTarget[] = [];
      const memberUserIds: string[] = [];
      const numbers: string[] = [];
      const clientIdentities: string[] = [];
      for (const u of members) {
        const t = buildUserTarget(u);
        if (t && t.type === "user") {
          targets.push(t);
          memberUserIds.push(u.id);
          numbers.push(t.number);
          clientIdentities.push(t.clientIdentity || "");
        }
      }

      if (!targets.length)
        return { error: "No available members in call group" };
      return {
        targets: [
          {
            type: "callGroup",
            callGroupId,
            memberUserIds,
            numbers,
            clientIdentities,
          },
        ],
        timeoutSeconds,
      };
    }

    return { error: "Invalid Call Forwarding targetType" };
  }

  if (label === "Call Group") {
    const callGroupId = String(config?.callGroupId || "").trim();
    if (!callGroupId) return { error: "Missing callGroupId" };

    const group = await (prisma as any).callGroup.findFirst({
      where: { id: callGroupId, tenantId },
      include: {
        members: {
          orderBy: { order: "asc" },
          include: {
            user: {
              select: {
                id: true,
                isCheckedIn: true,
                agentTimeZone: true,
                workingHours: true,
                forwardingPhoneNumber: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!group) return { error: "Call group not found" };

    const members = group.members
      .map((m: any) => m.user)
      .filter(
        (u: any) => u && (u.role === "TENANT_ADMIN" || u.role === "AGENT")
      );

    const memberUserIds: string[] = [];
    const numbers: string[] = [];
    const clientIdentities: string[] = [];
    for (const u of members) {
      const t = buildUserTarget(u);
      if (t && t.type === "user") {
        memberUserIds.push(u.id);
        numbers.push(t.number);
        clientIdentities.push(t.clientIdentity || "");
      }
    }

    if (!numbers.length) return { error: "No available members in call group" };

    return {
      targets: [
        {
          type: "callGroup",
          callGroupId,
          memberUserIds,
          numbers,
          clientIdentities,
        },
      ],
      timeoutSeconds:
        typeof group.ringTimeoutSeconds === "number"
          ? group.ringTimeoutSeconds
          : timeoutSeconds,
    };
  }

  return { error: "Unsupported routing node" };
}

function normalizeTwilioSayText(raw: string): string {
  // TwiML <Say> is plain text; preserve the full configured message.
  // Only normalize whitespace and apply a generous safety cap.
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Twilio can speak longer messages, but keep a hard cap to avoid extreme payloads.
  const maxChars = 2000;
  return text.length > maxChars ? text.slice(0, maxChars).trim() : text;
}

function escapeXml(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function deriveVoicemailCallbackUrl(): string {
  const voiceUrl = String(process.env.TWILIO_WEBHOOK_URL || "").trim();
  if (!voiceUrl) return "";

  if (voiceUrl.endsWith("/voice"))
    return voiceUrl.replace(/\/voice$/, "/voicemail");
  if (voiceUrl.endsWith("/voicemail")) return voiceUrl;

  // If it's set to /webhooks/twilio, append.
  if (voiceUrl.endsWith("/webhooks/twilio")) return `${voiceUrl}/voicemail`;

  // Otherwise best-effort append.
  return voiceUrl.endsWith("/")
    ? `${voiceUrl}voicemail`
    : `${voiceUrl}/voicemail`;
}

function deriveOpenAIVoiceFromPhoneVoiceId(
  phoneVoiceId: string
): "alloy" | "echo" | "shimmer" {
  const id = (phoneVoiceId || "").toLowerCase();
  // Best-effort mapping from our system voice IDs (female/male/Polly.*)
  // to OpenAI Realtime voice names.
  if (
    id.includes("male") ||
    id.includes("matthew") ||
    id.includes("brian") ||
    id.includes("russell")
  ) {
    return "echo";
  }
  if (
    id.includes("female") ||
    id.includes("joanna") ||
    id.includes("amy") ||
    id.includes("emma") ||
    id.includes("nicole")
  ) {
    return "shimmer";
  }
  return "alloy";
}

function deriveAccentInstruction(options: {
  phoneVoiceId?: string;
  language?: string;
}): string {
  const id = (options.phoneVoiceId || "").toLowerCase();
  const language = (options.language || "").trim().toLowerCase();

  const isBritish =
    language === "en-gb" ||
    id.includes("polly.amy") ||
    id.includes("polly.emma") ||
    id.includes("polly.brian");
  const isAustralian =
    language === "en-au" ||
    id.includes("polly.nicole") ||
    id.includes("polly.russell");

  if (isBritish) {
    return "Speak with a natural British English accent.";
  }
  if (isAustralian) {
    return "Speak with a natural Australian English accent.";
  }
  return "";
}

/**
 * Twilio Voice Webhook - Handles incoming calls
 */
router.post("/voice", async (req: Request, res: Response) => {
  try {
    const {
      CallSid,
      From,
      To,
      CallStatus,
      CallerCity,
      CallerState,
      CallerCountry,
      Direction,
    } = req.body;

    // Some Twilio configurations mistakenly point status callbacks to /voice.
    // If this request is a call-progress event callback, acknowledge it and do cleanup.
    if (req.body?.CallbackSource === "call-progress-events") {
      console.log(
        `[Twilio] /voice received call-progress-events callback for ${CallSid} (${CallStatus})`
      );

      if (
        ["completed", "canceled", "failed", "busy", "no-answer"].includes(
          String(CallStatus || "").toLowerCase()
        )
      ) {
        await twilioRealtimeVoiceService.endSessionByCallSid(CallSid);
        if ((global as any).twilioCallMetadata?.[CallSid]) {
          delete (global as any).twilioCallMetadata[CallSid];
        }
      }

      res.sendStatus(200);
      return;
    }

    console.log(`[Twilio] Voice webhook received:`, req.body);
    console.log(`[Twilio] Voice webhook: ${CallStatus} from ${From} to ${To}`);

    // Look up tenant from the inbound phone number
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { number: To },
      select: {
        id: true,
        number: true,
        tenantId: true,
        afterHoursMode: true,
        afterHoursWorkflowId: true,
        afterHoursMessage: true,
        afterHoursNotifyUserId: true,
      },
    });

    if (!phoneNumber) {
      console.log(`[Twilio] Phone number ${To} not found in database`);
      // Return TwiML to reject call
      res.type("text/xml");
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This number is not configured. Please contact support.</Say>
  <Hangup/>
</Response>`;
      console.log(`[Twilio] Sending TwiML:`, twiml);
      res.send(twiml);
      return;
    }

    // Get tenant name separately
    const tenant = await prisma.tenant.findUnique({
      where: { id: phoneNumber.tenantId },
      select: { name: true, businessTimeZone: true, businessHours: true },
    });

    const isOpenNow = isTenantOpenNow({
      tenant: {
        timeZone: (tenant as any)?.businessTimeZone,
        businessHours: (tenant as any)?.businessHours,
      },
    });

    const afterHoursMode = String(phoneNumber.afterHoursMode || "VOICEMAIL")
      .trim()
      .toUpperCase();

    // After-hours short-circuit BEFORE starting Realtime streaming.
    if (!isOpenNow) {
      // Option A: route to an after-hours Incoming Call workflow.
      if (
        afterHoursMode === "AI_WORKFLOW" &&
        phoneNumber.afterHoursWorkflowId
      ) {
        const workflow = await prisma.workflow.findFirst({
          where: {
            id: phoneNumber.afterHoursWorkflowId,
            tenantId: phoneNumber.tenantId,
            isActive: true,
            triggerType: "Incoming Call",
          },
          include: {
            aiConfig: true,
            documents: { include: { document: true } },
            assignedAgent: {
              select: {
                id: true,
                name: true,
                agentTimeZone: true,
                workingHours: true,
              },
            },
          } as any,
        });

        if (!workflow) {
          console.warn(
            `[Twilio] After-hours workflow ${phoneNumber.afterHoursWorkflowId} not found/active. Falling back to voicemail.`
          );
        } else {
          // Reuse the normal workflow path below.
          (req as any).__afterHoursWorkflow = workflow;
        }
      }

      // Option B: voicemail
      if (!(req as any).__afterHoursWorkflow) {
        const callbackUrl =
          deriveVoicemailCallbackUrl() ||
          `${req.protocol}://${req.get("host")}${req.baseUrl}/voicemail`;
        const maxLength = 120;
        const sayText =
          normalizeTwilioSayText(phoneNumber.afterHoursMessage || "") ||
          "Thanks for calling. We're currently closed. Please leave a message after the beep.";

        res.type("text/xml");
        const actionAttr = callbackUrl
          ? ` action="${escapeXml(callbackUrl)}?phoneNumberId=${escapeXml(
              phoneNumber.id
            )}" method="POST"`
          : "";

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(sayText)}</Say>
  <Record${actionAttr} maxLength="${maxLength}" playBeep="true" />
  <Say>Thank you. Goodbye.</Say>
  <Hangup/>
</Response>`;
        console.log(`[Twilio] After-hours voicemail TwiML:`, twiml);
        res.send(twiml);
        return;
      }
    }

    // Select workflow based on the workflow canvas trigger configuration.
    // In the UI, Incoming Call trigger stores config.phoneNumberId (or empty for Any/All).
    const candidateWorkflows = (req as any).__afterHoursWorkflow
      ? []
      : await prisma.workflow.findMany({
          where: {
            tenantId: phoneNumber.tenantId,
            isActive: true,
            triggerType: "Incoming Call",
          },
          include: {
            aiConfig: true,
            documents: {
              include: {
                document: true,
              },
            },
            assignedAgent: {
              select: {
                id: true,
                name: true,
                agentTimeZone: true,
                workingHours: true,
              },
            },
          } as any,
          orderBy: { updatedAt: "desc" },
        });

    const extractIncomingCallTrigger = (nodesJson: unknown) => {
      const nodes = Array.isArray(nodesJson) ? (nodesJson as any[]) : [];
      const triggerNode =
        nodes.find(
          (n) => n?.type === "trigger" && n?.label === "Incoming Call"
        ) || nodes.find((n) => n?.type === "trigger");
      const config = triggerNode?.config || {};
      return {
        phoneNumberId:
          typeof config.phoneNumberId === "string" ? config.phoneNumberId : "",
        greeting: typeof config.greeting === "string" ? config.greeting : "",
        phoneVoiceId:
          typeof config.phoneVoiceId === "string" ? config.phoneVoiceId : "",
        phoneVoiceLanguage:
          typeof config.phoneVoiceLanguage === "string"
            ? config.phoneVoiceLanguage
            : "",
        requestInfo: config.requestInfo || {},
      };
    };

    const selectedWorkflow = (req as any).__afterHoursWorkflow
      ? (req as any).__afterHoursWorkflow
      : candidateWorkflows.find((wf) => {
          const { phoneNumberId } = extractIncomingCallTrigger(wf.nodes);
          if (!phoneNumberId) return true; // Any / All Numbers
          return phoneNumberId === phoneNumber.id;
        });

    let workflowId = "default";
    let systemPrompt =
      "You are a helpful AI assistant for customer support. Keep responses brief and natural.";
    let documentIds: string[] = [];
    let agentName = "AI Assistant";
    let greeting = "";
    let phoneVoiceId = "";
    let phoneVoiceLanguage = "";
    let requestInfo: any = {};

    if (selectedWorkflow) {
      workflowId = selectedWorkflow.id;
      documentIds = selectedWorkflow.documents.map((wd: any) => wd.document.id);

      const workflowPhoneVoiceId = String(
        (selectedWorkflow as any)?.phoneVoiceId ?? ""
      );
      const workflowPhoneVoiceLanguage = String(
        (selectedWorkflow as any)?.phoneVoiceLanguage ?? ""
      );

      const trigger = extractIncomingCallTrigger(selectedWorkflow.nodes);
      greeting = trigger.greeting;
      phoneVoiceId = (trigger.phoneVoiceId || "").trim()
        ? trigger.phoneVoiceId
        : workflowPhoneVoiceId;
      phoneVoiceLanguage = (trigger.phoneVoiceLanguage || "").trim()
        ? trigger.phoneVoiceLanguage
        : workflowPhoneVoiceLanguage;
      requestInfo = trigger.requestInfo;

      const aiConfig = selectedWorkflow.aiConfig;
      if (aiConfig) {
        agentName = aiConfig.name || agentName;
        const businessInfo = aiConfig.businessDescription || "";
        systemPrompt = aiConfig.systemPrompt || systemPrompt;
        if (businessInfo) {
          systemPrompt = `${systemPrompt}\n\nBusiness Context: ${businessInfo}`;
        }
      }

      const workflowToneOfVoice = String(
        (selectedWorkflow as any)?.toneOfVoice ?? ""
      ).trim();
      const configToneOfVoice = String(
        (selectedWorkflow.aiConfig as any)?.toneOfVoice ?? ""
      ).trim();
      const effectiveToneOfVoice = workflowToneOfVoice || configToneOfVoice;
      if (effectiveToneOfVoice) {
        systemPrompt = applyToneOfVoiceToSystemPrompt(
          systemPrompt,
          effectiveToneOfVoice
        );
      }

      console.log(
        `[Twilio] Selected workflow ${selectedWorkflow.id} (${selectedWorkflow.name}) for To=${To}`
      );
      console.log(`[Twilio] Agent name: ${agentName}`);
      console.log(`[Twilio] Documents assigned: ${documentIds.length}`);
      console.log(`[Twilio] Trigger greeting set: ${Boolean(greeting)}`);
    } else {
      console.log(
        `[Twilio] No matching active Incoming Call workflow found for tenant ${phoneNumber.tenantId} (To=${To}). Using defaults.`
      );
    }

    // Return TwiML to start Media Stream.
    // NOTE: We avoid Twilio <Say> for the greeting to reduce robotic-sounding TTS.
    // The greeting is spoken by OpenAI Realtime once the media stream is connected.
    const publicUrl =
      process.env.PUBLIC_URL || "wss://chamois-holy-unduly.ngrok-free.app";
    const streamUrl = `${publicUrl}/ws/twilio`;

    console.log(
      `[Twilio] Starting OpenAI Realtime call ${CallSid}, Stream URL: ${streamUrl}`
    );
    console.log(
      `[Twilio] Using workflow ${workflowId} for tenant ${phoneNumber.tenantId}`
    );

    // Resolve a phone-voice preference for best-effort OpenAI voice mapping + accent.
    const tenantPreference = await hybridVoiceService.getVoicePreference(
      phoneNumber.tenantId
    );
    const effectivePhoneVoiceId =
      (phoneVoiceId || "").trim() || tenantPreference.voice;
    const effectivePhoneVoiceLanguage =
      (phoneVoiceLanguage || "").trim() || tenantPreference.language;
    const openaiVoice = deriveOpenAIVoiceFromPhoneVoiceId(
      effectivePhoneVoiceId
    );

    const accentInstruction = deriveAccentInstruction({
      phoneVoiceId: effectivePhoneVoiceId,
      language: effectivePhoneVoiceLanguage,
    });
    if (accentInstruction) {
      systemPrompt = `${systemPrompt}\n\nVoice style: ${accentInstruction}`;
    }

    // Look up customer by phone number if exists
    let customer = await prisma.user.findFirst({
      where: {
        tenantId: phoneNumber.tenantId,
        role: "CUSTOMER",
        // For voice calls, we might store phone in a metadata field or use a different approach
        // For now, we'll just check if there's any existing conversation for this number
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    // Try to find existing conversation for this customer phone number
    let existingConversation = await prisma.conversation.findFirst({
      where: {
        tenantId: phoneNumber.tenantId,
        status: { not: "RESOLVED" },
        channel: "VOICE",
        messages: {
          some: {
            content: { contains: From }, // Check if any message references this number
          },
        },
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        channel: true,
      },
      orderBy: {
        lastActivity: "desc",
      },
    });

    // Build comprehensive context for workflow engine
    const workflowContext = {
      trigger: {
        type: "Incoming Call",
        source: "twilio",
        phoneNumberId: phoneNumber.id,
        phoneNumber: To,
        requestInfo, // Include what information to request from caller
      },
      customer: customer
        ? {
            id: customer.id,
            name: customer.name || undefined,
            email: customer.email || undefined,
            phone: From,
            metadata: {},
          }
        : {
            phone: From,
            metadata: {},
          },
      conversation: existingConversation
        ? {
            id: existingConversation.id,
            channel: existingConversation.channel,
            status: existingConversation.status,
            metadata: {},
          }
        : undefined,
      call: {
        sid: CallSid,
        from: From,
        to: To,
        status: CallStatus,
        direction: Direction || "inbound",
        callerCity: CallerCity || undefined,
        callerState: CallerState || undefined,
        callerCountry: CallerCountry || undefined,
      },
      tenant: {
        id: phoneNumber.tenantId,
        name: tenant?.name,
      },
      workflow: {
        id: workflowId,
        name: selectedWorkflow?.name,
        assignedAgent: selectedWorkflow?.assignedAgent
          ? {
              id: selectedWorkflow.assignedAgent.id,
              name: selectedWorkflow.assignedAgent.name,
              agentTimeZone: selectedWorkflow.assignedAgent.agentTimeZone,
              workingHours: selectedWorkflow.assignedAgent.workingHours,
            }
          : undefined,
      },
    };

    // Store call metadata for later (either immediate stream or post-dial fallback)
    (global as any).twilioCallMetadata =
      (global as any).twilioCallMetadata || {};
    (global as any).twilioCallMetadata[CallSid] = {
      tenantId: phoneNumber.tenantId,
      workflowId,
      phoneNumberId: phoneNumber.id,
      systemPrompt,
      documentIds,
      agentName,
      greeting,
      greetingSpokenByTwilio: false,
      openaiVoice,
      workflowContext,
      routing: undefined as any,
    };

    // If the first node after Incoming Call is a call routing node, dial before starting AI stream.
    if (selectedWorkflow) {
      const graph = getWorkflowGraph(selectedWorkflow);
      const first = getFirstNodeAfterTrigger(graph);
      const firstLabel = String(first?.label || "").trim();
      if (
        first &&
        (firstLabel === "Call Forwarding" || firstLabel === "Call Group")
      ) {
        const resolution = await resolveDialTargetsFromNode({
          tenantId: phoneNumber.tenantId,
          phoneNumberId: phoneNumber.id,
          toNumber: To,
          node: first,
        });

        if ("error" in resolution) {
          console.warn(
            `[Twilio] Routing node error (${firstLabel}): ${resolution.error}. Falling back to AI.`
          );
        } else {
          const { targets, timeoutSeconds } = resolution;

          const config = (first as any)?.config ?? {};
          const strategyRaw = String(config?.ringStrategy || "")
            .trim()
            .toUpperCase();
          const strategy =
            strategyRaw === "SIMULTANEOUS" ? "SIMULTANEOUS" : "SEQUENTIAL";

          const numbers = (() => {
            const t0 = targets[0];
            if (t0?.type === "external") return [t0.number];
            if (t0?.type === "user") return [t0.number];
            if (t0?.type === "callGroup") {
              return strategy === "SIMULTANEOUS" ? t0.numbers : [t0.numbers[0]];
            }
            return [];
          })();

          const clients = (() => {
            const t0 = targets[0];
            if (t0?.type === "user")
              return t0.clientIdentity ? [t0.clientIdentity] : [];
            if (t0?.type === "callGroup") {
              if (strategy === "SIMULTANEOUS") {
                return Array.isArray(t0.clientIdentities)
                  ? t0.clientIdentities.filter(Boolean)
                  : [];
              }
              const first = Array.isArray(t0.clientIdentities)
                ? t0.clientIdentities[0]
                : "";
              return first ? [first] : [];
            }
            return [];
          })();

          if (numbers.length) {
            (global as any).twilioCallMetadata[CallSid].routing = {
              nodeId: first.id,
              nodeLabel: firstLabel,
              strategy,
              targets,
              nextIndex: strategy === "SEQUENTIAL" ? 1 : numbers.length,
              dialAttempts: [
                {
                  at: new Date().toISOString(),
                  numbers,
                },
              ],
            };

            const actionUrl = deriveTwilioDialActionUrl(req, {
              callSid: CallSid,
              workflowId,
              nodeId: first.id,
            });

            res.type("text/xml");
            const twiml = buildTwilioDialTwiml({
              toCallerId: To,
              numbers,
              clients,
              timeoutSeconds,
              actionUrl,
            });
            console.log(
              `[Twilio] Sending dial TwiML for ${firstLabel}:`,
              twiml
            );
            res.send(twiml);
            return;
          }
        }
      }
    }

    res.type("text/xml");
    const twiml = buildTwilioStreamTwiml(publicUrl);
    console.log(`[Twilio] Sending TwiML:`, twiml);
    res.send(twiml);
  } catch (error) {
    console.error("[Twilio] Voice webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Twilio <Dial> action callback
 * This is used for Call Group / Call Forwarding nodes before starting the AI media stream.
 */
router.post("/dial-action", async (req: Request, res: Response) => {
  try {
    const CallSid = String(req.body?.CallSid || "");
    const DialCallStatus = String(req.body?.DialCallStatus || "").toLowerCase();
    const DialCallDurationRaw = req.body?.DialCallDuration;
    const DialCallSid = String(req.body?.DialCallSid || "");

    const metadata = (global as any).twilioCallMetadata?.[CallSid];
    if (!metadata) {
      res.type("text/xml");
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Hangup/></Response>`
      );
      return;
    }

    const phoneNumberId = String(metadata.phoneNumberId || "");
    const tenantId = String(metadata.tenantId || "");

    // Track outbound forwarded leg usage on completion.
    const durationSeconds = Number(DialCallDurationRaw);
    if (
      tenantId &&
      phoneNumberId &&
      DialCallSid &&
      DialCallStatus === "completed" &&
      Number.isFinite(durationSeconds) &&
      durationSeconds > 0
    ) {
      try {
        await usageService.trackVoiceCall({
          tenantId,
          phoneNumberId,
          callSid: DialCallSid,
          durationSeconds: Math.floor(durationSeconds),
          direction: "outbound",
        });
      } catch (e) {
        console.warn("[Twilio] Failed to track forwarded leg usage:", e);
      }
    }

    const routing = metadata.routing;
    const strategy = String(routing?.strategy || "SEQUENTIAL");
    const targets = Array.isArray(routing?.targets) ? routing.targets : [];
    const nextIndex =
      typeof routing?.nextIndex === "number" ? routing.nextIndex : 0;

    // If call was answered and bridged, end the call when the bridge ends.
    if (DialCallStatus === "completed") {
      res.type("text/xml");
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Hangup/></Response>`
      );
      return;
    }

    // Sequential retry for call groups.
    const t0 = targets[0];
    if (strategy === "SEQUENTIAL" && t0?.type === "callGroup") {
      const numbers = Array.isArray(t0.numbers) ? t0.numbers : [];
      if (nextIndex < numbers.length) {
        const nextNumber = numbers[nextIndex];
        const clientId = Array.isArray(t0.clientIdentities)
          ? String(t0.clientIdentities[nextIndex] || "").trim()
          : "";
        metadata.routing = {
          ...routing,
          nextIndex: nextIndex + 1,
          dialAttempts: [
            ...(Array.isArray(routing?.dialAttempts)
              ? routing.dialAttempts
              : []),
            { at: new Date().toISOString(), numbers: [nextNumber] },
          ],
        };

        const actionUrl = deriveTwilioDialActionUrl(req, {
          callSid: CallSid,
          workflowId: String(metadata.workflowId || ""),
          nodeId: String(routing?.nodeId || ""),
        });

        res.type("text/xml");
        res.send(
          buildTwilioDialTwiml({
            toCallerId:
              String(req.body?.To || "") ||
              String(metadata.workflowContext?.call?.to || ""),
            numbers: [nextNumber],
            clients: clientId ? [clientId] : [],
            timeoutSeconds: 20,
            actionUrl,
          })
        );
        return;
      }
    }

    // Otherwise fall back to AI stream.
    const publicUrl =
      process.env.PUBLIC_URL || "wss://chamois-holy-unduly.ngrok-free.app";
    res.type("text/xml");
    res.send(buildTwilioStreamTwiml(publicUrl));
  } catch (error) {
    console.error("[Twilio] dial-action error:", error);
    res.status(500).send("Internal server error");
  }
});

/**
 * Twilio Voice SDK outbound webhook (TwiML App Voice URL)
 * The browser device calls connect(params), Twilio hits this endpoint to get TwiML.
 */
async function handleTwilioClientVoice(req: Request, res: Response) {
  try {
    const fromRaw = String(req.body?.From || "").trim();
    const identity = fromRaw.startsWith("client:")
      ? fromRaw.slice("client:".length)
      : fromRaw;
    const parsed = parseTwilioClientIdentity(identity);

    const toRaw = String(req.body?.To || req.body?.to || "").trim();
    const toDigitsOnly = toRaw.replace(/[^0-9]/g, "");

    // Treat short digit-only values as internal extensions (e.g. 101, 102, 5432).
    // This prevents Twilio from trying to dial "102" as a PSTN number.
    const isExtensionDial = /^[0-9]{2,6}$/.test(toDigitsOnly);
    const toNumber = isExtensionDial ? "" : normalizeE164Like(toRaw);

    if (!parsed?.tenantId || !parsed?.userId) {
      res.type("text/xml");
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Reject/></Response>`
      );
      return;
    }

    const tenantId = parsed.tenantId;
    const userId = parsed.userId;

    // Prisma uses UUID-typed columns for tenant/user IDs; reject malformed IDs to avoid DB errors.
    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidLike.test(tenantId) || !uuidLike.test(userId)) {
      res.type("text/xml");
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Reject/></Response>`
      );
      return;
    }

    // Resolve internal extension target (dial another webphone client)
    let toClient: string | null = null;
    if (isExtensionDial) {
      const targetUser: any = await prisma.user.findFirst({
        where: {
          tenantId,
          extension: toDigitsOnly,
          extensionEnabled: true,
        } as any,
        select: { id: true } as any,
      });

      if (!targetUser?.id) {
        res.type("text/xml");
        res.send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say>That extension is not available.</Say><Reject/></Response>`
        );
        return;
      }

      toClient = toTwilioClientIdentity({
        tenantId,
        userId: String(targetUser.id),
      });
      console.log("[Twilio] client-voice extension dial:", {
        tenantId,
        fromUserId: userId,
        toExtension: toDigitsOnly,
        toClient,
      });
    } else {
      // External number validation: reject too-short values (prevents short codes being dialed).
      const digits = String(toNumber || "").replace(/[^0-9]/g, "");
      if (!toNumber || digits.length < 10) {
        res.type("text/xml");
        res.send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Reject/></Response>`
        );
        return;
      }
    }

    // If tenant restricts external forwarding, treat outbound similarly (MVP safety).
    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: {
        restrictExternalForwarding: true,
        externalForwardingAllowList: true,
        webPhoneOutboundCallerNumber: true,
      },
    });

    if (!toClient && (tenant as any)?.restrictExternalForwarding) {
      const allowList = Array.isArray(
        (tenant as any)?.externalForwardingAllowList
      )
        ? (tenant as any).externalForwardingAllowList
        : [];
      if (!allowList.includes(toNumber)) {
        res.type("text/xml");
        res.send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Reject/></Response>`
        );
        return;
      }
    }

    // Choose callerId: admin-configured tenant number, else first active TWILIO number for tenant.
    let callerId = String(
      (tenant as any)?.webPhoneOutboundCallerNumber || ""
    ).trim();

    console.log("[Twilio] client-voice callerId selection:", {
      tenantId,
      userId,
      configuredNumber: callerId,
      toNumber: toClient ? "(client)" : toNumber,
      toClient: toClient || undefined,
    });

    if (callerId) {
      const pn: any = await prisma.phoneNumber.findFirst({
        where: {
          tenantId,
          number: callerId,
          status: "active",
          provider: "TWILIO",
        } as any,
        select: { number: true } as any,
      });
      console.log("[Twilio] client-voice configured number lookup:", {
        configuredNumber: callerId,
        found: Boolean(pn),
        foundNumber: pn?.number,
      });
      if (!pn) {
        callerId = "";
      }
    }

    if (!callerId) {
      const pn: any = await prisma.phoneNumber.findFirst({
        where: {
          tenantId,
          status: "active",
          provider: "TWILIO",
        } as any,
        select: { number: true } as any,
      });
      console.log("[Twilio] client-voice fallback number lookup:", {
        found: Boolean(pn),
        foundNumber: pn?.number,
      });
      callerId = String(pn?.number || "").trim();
    }

    console.log("[Twilio] client-voice final callerId:", callerId);

    if (!callerId) {
      res.type("text/xml");
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Reject/></Response>`
      );
      return;
    }

    res.type("text/xml");
    res.send(
      buildTwilioClientOutboundTwiml({
        callerId: toClient ? undefined : callerId,
        toNumber: toClient ? undefined : toNumber,
        toClient: toClient || undefined,
      })
    );
  } catch (error) {
    console.error("[Twilio] client-voice error:", error);
    res.status(500).send("Internal server error");
  }
}

// Twilio Voice SDK outbound webhook (TwiML App Voice URL)
router.post("/client-voice", handleTwilioClientVoice);

/**
 * Twilio Voicemail Callback - receives RecordingUrl and creates a VOICE conversation + message.
 */
router.post("/voicemail", async (req: Request, res: Response) => {
  try {
    const { CallSid, From, To, RecordingUrl, RecordingSid } = req.body || {};
    const phoneNumberId =
      typeof req.query?.phoneNumberId === "string"
        ? req.query.phoneNumberId
        : null;

    console.log("[Twilio] Voicemail callback:", {
      CallSid,
      From,
      To,
      RecordingSid,
      hasRecordingUrl: Boolean(RecordingUrl),
      phoneNumberId,
    });

    const phoneNumber = phoneNumberId
      ? await prisma.phoneNumber.findUnique({
          where: { id: phoneNumberId },
          select: {
            id: true,
            number: true,
            tenantId: true,
            afterHoursNotifyUserId: true,
          },
        })
      : await prisma.phoneNumber.findUnique({
          where: { number: To },
          select: {
            id: true,
            number: true,
            tenantId: true,
            afterHoursNotifyUserId: true,
          },
        });

    if (!phoneNumber) {
      res.type("text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thanks. Goodbye.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    const safeDigits = String(From || "")
      .replace(/[^0-9]/g, "")
      .slice(-15);
    const email = safeDigits
      ? `voice-${safeDigits}@example.com`
      : `voice-${Date.now()}@example.com`;

    let customer = await prisma.user.findUnique({ where: { email } });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          email,
          name: safeDigits ? `Caller ${From}` : "Caller",
          role: "CUSTOMER",
          tenantId: phoneNumber.tenantId,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            safeDigits ? `Caller ${safeDigits}` : "Caller"
          )}`,
        },
      });
    }

    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId: phoneNumber.tenantId,
        channel: "VOICE",
        status: { not: "RESOLVED" },
        messages: {
          some: { content: { contains: String(From || "") } },
        },
      },
      orderBy: { lastActivity: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId: phoneNumber.tenantId,
          channel: "VOICE",
          customerId: customer.id,
          assigneeId: phoneNumber.afterHoursNotifyUserId || null,
          subject: `Voicemail from ${From || "unknown caller"}`,
          lastActivity: new Date(),
          tags: [],
        },
      });
    } else if (phoneNumber.afterHoursNotifyUserId && !conversation.assigneeId) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { assigneeId: phoneNumber.afterHoursNotifyUserId },
      });
    }

    const recording = typeof RecordingUrl === "string" ? RecordingUrl : "";
    const content = `Voicemail received from ${From || "unknown"} on ${
      phoneNumber.number
    }.${recording ? ` Recording: ${recording}` : ""}`;

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          tenantId: phoneNumber.tenantId,
          content,
          sender: "CUSTOMER",
          attachments: recording ? [recording] : [],
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastActivity: new Date() },
      }),
    ]);

    const io = req.app.get("io");
    if (io) {
      io.to(conversation.id).emit("new_message", {
        ...message,
        timestamp: message.createdAt.toISOString(),
      });
    }

    res.type("text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thanks. We've received your message. Goodbye.</Say>
  <Hangup/>
</Response>`);
  } catch (error) {
    console.error("[Twilio] Voicemail callback error:", error);
    res.status(500).send("Internal server error");
  }
});

/**
 * Twilio Status Callback - Tracks call completion
 */
router.post("/status", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    console.log(
      `[Twilio] Status callback: ${CallSid} - ${CallStatus}, Duration: ${CallDuration}s`
    );

    // Proactively clean up resources on terminal call states.
    if (
      ["completed", "canceled", "failed", "busy", "no-answer"].includes(
        String(CallStatus || "").toLowerCase()
      )
    ) {
      await twilioRealtimeVoiceService.endSessionByCallSid(CallSid);
      if ((global as any).twilioCallMetadata?.[CallSid]) {
        delete (global as any).twilioCallMetadata[CallSid];
      }
    }

    // Track usage if call completed
    if (CallStatus === "completed" && CallDuration) {
      const durationSeconds = Number(CallDuration);
      const meta = (global as any).twilioCallMetadata?.[CallSid];
      const tenantId = String(meta?.tenantId || "");
      const phoneNumberId = String(meta?.phoneNumberId || "");

      if (tenantId && phoneNumberId && Number.isFinite(durationSeconds)) {
        try {
          await usageService.trackVoiceCall({
            tenantId,
            phoneNumberId,
            callSid: String(CallSid),
            durationSeconds: Math.floor(durationSeconds),
            direction: "inbound",
          });
        } catch (e) {
          console.warn("[Twilio] Failed to track inbound call usage:", e);
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("[Twilio] Status callback error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Initialize Twilio WebSocket server for Media Streams
 */
export function initializeTwilioWebSocket(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  console.log("[Twilio] WebSocket Server created (noServer mode)");

  wss.on("error", (error) => {
    console.error("[Twilio] WebSocket Server error:", error);
  });

  wss.on("connection", (ws, req) => {
    console.log("[Twilio] ✓✓✓ WebSocket connection ESTABLISHED ✓✓✓");
    console.log(`[Twilio] Connection from: ${req.socket.remoteAddress}`);

    let sessionId: string | null = null;
    let streamSid: string | null = null;
    let callSid: string | null = null;

    ws.on("message", async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.event) {
          case "start":
            streamSid = data.start.streamSid;
            callSid = data.start.callSid;
            console.log(
              `[Twilio] Media stream started: ${streamSid} for call ${callSid}`
            );

            // Get call metadata
            if (callSid && streamSid) {
              const metadata = (global as any).twilioCallMetadata?.[callSid];
              if (metadata) {
                // Start Twilio Realtime session
                sessionId = await twilioRealtimeVoiceService.startSession(
                  callSid,
                  streamSid,
                  metadata.tenantId,
                  metadata.workflowId,
                  metadata.systemPrompt,
                  metadata.documentIds,
                  metadata.agentName,
                  metadata.greeting,
                  metadata.workflowContext // Pass workflow context
                );

                // Connect to OpenAI Realtime API
                await twilioRealtimeVoiceService.connectToOpenAI(
                  sessionId,
                  metadata.openaiVoice || "alloy"
                );

                // If Twilio already spoke the greeting in TwiML, don't repeat it via OpenAI.
                if (metadata.greetingSpokenByTwilio) {
                  const s = twilioRealtimeVoiceService.getSession(sessionId);
                  if (s) s.greetingSent = true;
                }

                // Set Twilio WebSocket for bidirectional audio
                twilioRealtimeVoiceService.setTwilioWebSocket(sessionId, ws);

                // No need to send any placeholder audio; OpenAI will speak the greeting.
              }
            }
            break;

          case "media":
            // Forward audio to OpenAI Realtime API
            if (sessionId && data.media?.payload) {
              twilioRealtimeVoiceService.handleTwilioAudio(
                sessionId,
                data.media.payload
              );
            }
            break;

          case "stop":
            console.log(`[Twilio] Media stream stopped: ${streamSid}`);
            if (sessionId) {
              await twilioRealtimeVoiceService.endSession(sessionId);
            }
            // Cleanup metadata
            if (callSid && (global as any).twilioCallMetadata) {
              delete (global as any).twilioCallMetadata[callSid];
            }
            break;
        }
      } catch (error) {
        console.error("[Twilio] WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      console.log("[Twilio] WebSocket connection closed");
      if (sessionId) {
        twilioRealtimeVoiceService.endSession(sessionId);
      }
    });

    ws.on("error", (error) => {
      console.error("[Twilio] WebSocket error:", error);
    });
  });

  console.log("[Twilio] WebSocket server initialized on /ws/twilio");

  return wss; // Return the WebSocket server instance
}

// Extension Dialing Endpoints

/**
 * POST /dial-extension
 * Handle extension-to-extension calls with VoIP-first routing
 */
router.post("/dial-extension", async (req: Request, res: Response) => {
  try {
    const { toExtension, tenantId, callerId } = req.body;

    if (!toExtension || !tenantId || !callerId) {
      return res.status(400).send("Missing required parameters");
    }

    const { ExtensionDirectory } = await import(
      "../services/extensionDirectory"
    );
    const targetUser = await ExtensionDirectory.findByExtension(
      tenantId,
      toExtension
    );

    if (!targetUser) {
      // Extension not found - play error message
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Extension ${escapeXml(
    toExtension
  )} is not available. Please try again.</Say>
  <Hangup/>
</Response>`;
      return res.type("text/xml").send(twiml);
    }

    // Check if user's web phone is online (VoIP-first)
    const isOnline = await ExtensionDirectory.isWebPhoneReady(targetUser.id);
    const clientIdentity = toTwilioClientIdentity({
      tenantId,
      userId: targetUser.id,
    });

    const actionUrl = deriveTwilioDialActionUrl(req, {});

    if (isOnline) {
      // Route via VoIP (FREE)
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}" timeout="30" action="${escapeXml(
        actionUrl
      )}" method="POST" answerOnBridge="true">
    <Client>${escapeXml(clientIdentity)}</Client>
  </Dial>
</Response>`;
      res.type("text/xml").send(twiml);
    } else {
      // Fallback to PSTN if web phone offline
      const user = await prisma.user.findUnique({
        where: { id: targetUser.id },
        select: { phoneNumber: true, forwardingPhoneNumber: true },
      });

      const pstnNumber =
        user?.forwardingPhoneNumber || user?.phoneNumber || null;

      if (pstnNumber) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Extension ${escapeXml(
    toExtension
  )} is offline. Forwarding to their phone.</Say>
  <Dial callerId="${escapeXml(callerId)}" timeout="30" action="${escapeXml(
          actionUrl
        )}" method="POST" answerOnBridge="true">
    <Number>${escapeXml(pstnNumber)}</Number>
  </Dial>
</Response>`;
        res.type("text/xml").send(twiml);
      } else {
        // No fallback number
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Extension ${escapeXml(
    toExtension
  )} is currently unavailable. Please try again later.</Say>
  <Hangup/>
</Response>`;
        res.type("text/xml").send(twiml);
      }
    }
  } catch (error) {
    console.error("Error in dial-extension:", error);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">An error occurred. Please try again.</Say>
  <Hangup/>
</Response>`);
  }
});

/**
 * POST /extension-action
 * Track extension call outcome and cost
 */
router.post("/extension-action", async (req: Request, res: Response) => {
  try {
    const { CallSid, DialCallStatus, DialCallDuration } = req.body;

    console.log(
      `[Extension Action] CallSid=${CallSid}, Status=${DialCallStatus}, Duration=${DialCallDuration}`
    );

    // Log call outcome (could track VoIP vs PSTN routing here)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`;
    res.type("text/xml").send(twiml);
  } catch (error) {
    console.error("Error in extension-action:", error);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`);
  }
});

/**
 * POST /blind-transfer
 * Transfer active call to extension or PSTN number
 */
router.post("/blind-transfer", async (req: Request, res: Response) => {
  try {
    const { transferTo, tenantId, callerId } = req.body;

    if (!transferTo || !tenantId) {
      return res.status(400).send("Missing required parameters");
    }

    // Check if transferTo is extension (3-4 digits) or PSTN number
    const isExtension = /^\d{3,4}$/.test(transferTo);

    const actionUrl = deriveTwilioDialActionUrl(req, {});

    if (isExtension) {
      // Transfer to extension
      const { ExtensionDirectory } = await import(
        "../services/extensionDirectory"
      );
      const targetUser = await ExtensionDirectory.findByExtension(
        tenantId,
        transferTo
      );

      if (!targetUser) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Extension ${escapeXml(
    transferTo
  )} is not available.</Say>
  <Hangup/>
</Response>`;
        return res.type("text/xml").send(twiml);
      }

      // Try VoIP first
      const isOnline = await ExtensionDirectory.isWebPhoneReady(targetUser.id);
      const clientIdentity = toTwilioClientIdentity({
        tenantId,
        userId: targetUser.id,
      });

      if (isOnline) {
        // VoIP transfer (FREE)
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Transferring to extension ${escapeXml(
    transferTo
  )}.</Say>
  <Dial callerId="${escapeXml(
    callerId || ""
  )}" timeout="30" action="${escapeXml(actionUrl)}" method="POST">
    <Client>${escapeXml(clientIdentity)}</Client>
  </Dial>
</Response>`;
        res.type("text/xml").send(twiml);
      } else {
        // PSTN fallback
        const user = await prisma.user.findUnique({
          where: { id: targetUser.id },
          select: { phoneNumber: true, forwardingPhoneNumber: true },
        });

        const pstnNumber =
          user?.forwardingPhoneNumber || user?.phoneNumber || null;

        if (pstnNumber) {
          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Transferring to extension ${escapeXml(
    transferTo
  )}.</Say>
  <Dial callerId="${escapeXml(
    callerId || ""
  )}" timeout="30" action="${escapeXml(actionUrl)}" method="POST">
    <Number>${escapeXml(pstnNumber)}</Number>
  </Dial>
</Response>`;
          res.type("text/xml").send(twiml);
        } else {
          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Extension ${escapeXml(
    transferTo
  )} is unavailable.</Say>
  <Hangup/>
</Response>`;
          res.type("text/xml").send(twiml);
        }
      }
    } else {
      // Transfer to PSTN number
      const normalizedNumber = normalizeE164Like(transferTo);

      if (!normalizedNumber) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Invalid transfer number.</Say>
  <Hangup/>
</Response>`;
        return res.type("text/xml").send(twiml);
      }

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Transferring your call.</Say>
  <Dial callerId="${escapeXml(
    callerId || ""
  )}" timeout="30" action="${escapeXml(actionUrl)}" method="POST">
    <Number>${escapeXml(normalizedNumber)}</Number>
  </Dial>
</Response>`;
      res.type("text/xml").send(twiml);
    }
  } catch (error) {
    console.error("Error in blind-transfer:", error);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Transfer failed. Please try again.</Say>
  <Hangup/>
</Response>`);
  }
});

/**
 * POST /transfer-action
 * Track transfer outcome and cost
 */
router.post("/transfer-action", async (req: Request, res: Response) => {
  try {
    const { CallSid, DialCallStatus, DialCallDuration } = req.body;

    console.log(
      `[Transfer Action] CallSid=${CallSid}, Status=${DialCallStatus}, Duration=${DialCallDuration}`
    );

    // Could log transfer success/failure and cost here
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`;
    res.type("text/xml").send(twiml);
  } catch (error) {
    console.error("Error in transfer-action:", error);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`);
  }
});

export default router;
