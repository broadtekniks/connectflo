import { Router } from "express";
import prisma from "../lib/prisma";
import { loggingService } from "../services/loggingService";

const router = Router();

// Submit new feedback
router.post("/", async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const userId = (req as any).user?.id;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const {
      customerId,
      conversationId,
      rating,
      sentiment,
      category,
      feedback,
      source = "manual",
      metadata,
    } = req.body;

    if (!feedback) {
      return res.status(400).json({ error: "Feedback text is required" });
    }

    // Validate rating if provided
    if (rating !== null && rating !== undefined) {
      const numRating = Number(rating);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        return res
          .status(400)
          .json({ error: "Rating must be between 1 and 5" });
      }
    }

    const result = await loggingService.logFeedback({
      tenantId,
      customerId: customerId || userId, // Use current user if no customer specified
      conversationId: conversationId || undefined,
      rating: rating ? Number(rating) : undefined,
      sentiment: sentiment || undefined,
      category: category || undefined,
      feedback,
      source,
      metadata: metadata || {},
    });

    if (!result.success) {
      return res.status(500).json({ error: "Failed to save feedback" });
    }

    res.status(201).json({
      success: true,
      id: result.id,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// List all feedback logs
router.get("/", async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const {
      sentiment,
      category,
      minRating,
      limit = 100,
      offset = 0,
    } = req.query;

    const where: any = { tenantId };
    if (sentiment) where.sentiment = sentiment;
    if (category) where.category = category;
    if (minRating) where.rating = { gte: Number(minRating) };

    const [feedbackLogs, total, avgRating] = await Promise.all([
      prisma.feedbackLog.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.feedbackLog.count({ where }),
      prisma.feedbackLog.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    res.json({
      feedbackLogs,
      total,
      averageRating: avgRating._avg.rating || 0,
    });
  } catch (error) {
    console.error("Failed to fetch feedback logs:", error);
    res.status(500).json({ error: "Failed to fetch feedback logs" });
  }
});

// Get feedback analytics
router.get("/analytics", async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID required" });
    }

    const [totalCount, avgRating, sentimentBreakdown, categoryBreakdown] =
      await Promise.all([
        prisma.feedbackLog.count({ where: { tenantId } }),
        prisma.feedbackLog.aggregate({
          where: { tenantId },
          _avg: { rating: true },
        }),
        prisma.feedbackLog.groupBy({
          by: ["sentiment"],
          where: { tenantId },
          _count: true,
        }),
        prisma.feedbackLog.groupBy({
          by: ["category"],
          where: { tenantId },
          _count: true,
        }),
      ]);

    res.json({
      totalCount,
      averageRating: avgRating._avg.rating || 0,
      sentimentBreakdown,
      categoryBreakdown,
    });
  } catch (error) {
    console.error("Failed to fetch feedback analytics:", error);
    res.status(500).json({ error: "Failed to fetch feedback analytics" });
  }
});

export default router;
