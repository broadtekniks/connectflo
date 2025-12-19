import prisma from "../lib/prisma";

export class UsageService {
  /**
   * Track voice call usage
   */
  async trackVoiceCall(data: {
    tenantId: string;
    userId?: string;
    phoneNumberId: string;
    callSid: string;
    durationSeconds: number;
    direction: "inbound" | "outbound";
    conversationId?: string;
    wholesaleCost?: number; // If provided by Telnyx webhook
  }) {
    // Calculate costs
    const perMinuteRate = 0.0085; // Example: Telnyx rate per minute
    const wholesaleCost =
      data.wholesaleCost ?? (data.durationSeconds / 60) * perMinuteRate;

    // Apply your markup (e.g., 30%)
    const markup = 0.3;
    const retailCost = wholesaleCost * (1 + markup);

    return prisma.usageRecord.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        type: data.direction === "inbound" ? "VOICE_INBOUND" : "VOICE_OUTBOUND",
        phoneNumberId: data.phoneNumberId,
        callSid: data.callSid,
        durationSeconds: data.durationSeconds,
        wholesaleCost,
        retailCost,
        markup: retailCost - wholesaleCost,
        conversationId: data.conversationId,
      },
    });
  }

  /**
   * Track AI token usage
   */
  async trackAITokens(data: {
    tenantId: string;
    userId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    conversationId?: string;
  }) {
    // OpenAI pricing (as of December 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4": { input: 0.03, output: 0.06 }, // per 1K tokens
      "gpt-4-turbo": { input: 0.01, output: 0.03 },
      "gpt-3.5-turbo": { input: 0.0015, output: 0.002 },
      "text-embedding-ada-002": { input: 0.0001, output: 0 },
      "text-embedding-3-small": { input: 0.00002, output: 0 },
      "text-embedding-3-large": { input: 0.00013, output: 0 },
    };

    const rates = pricing[data.model] || pricing["gpt-3.5-turbo"];

    const wholesaleCost =
      (data.inputTokens / 1000) * rates.input +
      (data.outputTokens / 1000) * rates.output;

    // Your markup (25% on AI)
    const markup = 0.25;
    const retailCost = wholesaleCost * (1 + markup);

    return prisma.usageRecord.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        type: "AI_TOKENS_INPUT",
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.inputTokens + data.outputTokens,
        wholesaleCost,
        retailCost,
        markup: retailCost - wholesaleCost,
        conversationId: data.conversationId,
      },
    });
  }

  /**
   * Track SMS usage
   */
  async trackSMS(data: {
    tenantId: string;
    userId?: string;
    phoneNumberId: string;
    messageId: string;
    segmentCount: number;
    direction: "inbound" | "outbound";
    conversationId?: string;
    wholesaleCost?: number; // If provided by Telnyx
  }) {
    const perSegmentRate = 0.0079; // Telnyx SMS rate
    const wholesaleCost =
      data.wholesaleCost ?? data.segmentCount * perSegmentRate;

    // Your markup (40% on SMS)
    const markup = 0.4;
    const retailCost = wholesaleCost * (1 + markup);

    return prisma.usageRecord.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        type: data.direction === "inbound" ? "SMS_INBOUND" : "SMS_OUTBOUND",
        phoneNumberId: data.phoneNumberId,
        messageId: data.messageId,
        messageCount: data.segmentCount,
        wholesaleCost,
        retailCost,
        markup: retailCost - wholesaleCost,
        conversationId: data.conversationId,
      },
    });
  }

  /**
   * Get usage summary for a tenant
   */
  async getTenantUsageSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    const records = await prisma.usageRecord.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const summary = {
      voice: {
        inbound: { minutes: 0, calls: 0, cost: 0 },
        outbound: { minutes: 0, calls: 0, cost: 0 },
        total: { minutes: 0, calls: 0, cost: 0 },
      },
      sms: {
        inbound: { messages: 0, cost: 0 },
        outbound: { messages: 0, cost: 0 },
        total: { messages: 0, cost: 0 },
      },
      ai: {
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        requests: 0,
      },
      totalCost: 0,
      totalWholesaleCost: 0,
      totalMargin: 0,
    };

    records.forEach((record) => {
      switch (record.type) {
        case "VOICE_INBOUND":
          summary.voice.inbound.minutes += (record.durationSeconds || 0) / 60;
          summary.voice.inbound.calls += 1;
          summary.voice.inbound.cost += record.retailCost;
          break;
        case "VOICE_OUTBOUND":
          summary.voice.outbound.minutes += (record.durationSeconds || 0) / 60;
          summary.voice.outbound.calls += 1;
          summary.voice.outbound.cost += record.retailCost;
          break;
        case "SMS_INBOUND":
          summary.sms.inbound.messages += record.messageCount || 0;
          summary.sms.inbound.cost += record.retailCost;
          break;
        case "SMS_OUTBOUND":
          summary.sms.outbound.messages += record.messageCount || 0;
          summary.sms.outbound.cost += record.retailCost;
          break;
        case "AI_TOKENS_INPUT":
        case "AI_TOKENS_OUTPUT":
        case "AI_EMBEDDING":
          summary.ai.tokens += record.totalTokens || 0;
          summary.ai.inputTokens += record.inputTokens || 0;
          summary.ai.outputTokens += record.outputTokens || 0;
          summary.ai.cost += record.retailCost;
          summary.ai.requests += 1;
          break;
      }
      summary.totalCost += record.retailCost;
      summary.totalWholesaleCost += record.wholesaleCost;
      summary.totalMargin += record.markup;
    });

    // Calculate totals
    summary.voice.total.minutes =
      summary.voice.inbound.minutes + summary.voice.outbound.minutes;
    summary.voice.total.calls =
      summary.voice.inbound.calls + summary.voice.outbound.calls;
    summary.voice.total.cost =
      summary.voice.inbound.cost + summary.voice.outbound.cost;

    summary.sms.total.messages =
      summary.sms.inbound.messages + summary.sms.outbound.messages;
    summary.sms.total.cost =
      summary.sms.inbound.cost + summary.sms.outbound.cost;

    return summary;
  }

  /**
   * Get detailed usage records for a tenant with pagination
   */
  async getTenantUsageRecords(
    tenantId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      type?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { startDate, endDate, type, limit = 50, offset = 0 } = options;

    const where: any = { tenantId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (type) {
      where.type = type;
    }

    const [records, total] = await Promise.all([
      prisma.usageRecord.findMany({
        where,
        include: {
          phoneNumber: {
            select: {
              number: true,
              friendlyName: true,
            },
          },
          conversation: {
            select: {
              id: true,
              channel: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.usageRecord.count({ where }),
    ]);

    return {
      records,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get usage breakdown by type for a tenant
   */
  async getUsageBreakdown(tenantId: string, startDate: Date, endDate: Date) {
    const records = await prisma.usageRecord.groupBy({
      by: ["type"],
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        retailCost: true,
        wholesaleCost: true,
        markup: true,
        durationSeconds: true,
        totalTokens: true,
        messageCount: true,
      },
      _count: {
        id: true,
      },
    });

    return records.map((record) => ({
      type: record.type,
      count: record._count.id,
      totalRetailCost: record._sum.retailCost || 0,
      totalWholesaleCost: record._sum.wholesaleCost || 0,
      totalMargin: record._sum.markup || 0,
      totalDurationSeconds: record._sum.durationSeconds || 0,
      totalTokens: record._sum.totalTokens || 0,
      totalMessages: record._sum.messageCount || 0,
    }));
  }
}

export const usageService = new UsageService();
