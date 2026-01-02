import { Router, Request, Response } from "express";
import multer from "multer";
import prisma from "../lib/prisma";
import { KnowledgeBaseService } from "../services/knowledgeBase";
import { StorageService } from "../services/storage";
import { AuthRequest } from "../middleware/auth";

const router = Router();
const kbService = new KnowledgeBaseService();
const storageService = new StorageService();

// Configure storage (Memory for R2 upload)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// List documents
router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    const documents = await prisma.document.findMany({
      where: { tenantId } as any,
      orderBy: { createdAt: "desc" },
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Upload document
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const tenantId = authReq.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID not found in token" });
      }

      // Check document limits based on plan
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true },
      });

      const planName = tenant?.plan || "STARTER";
      const plan = await prisma.plan.findUnique({
        where: { name: planName },
      });

      // 1. Check Document Count Limit
      const docCount = await prisma.document.count({
        where: { tenantId },
      });

      const limit = plan?.documentLimit || 5;
      if (docCount >= limit) {
        return res.status(403).json({
          error: `Document limit reached for ${planName} plan. Max ${limit} documents allowed.`,
        });
      }

      // 2. Check File Size Limit
      const sizeLimitMB = plan?.docSizeLimitMB || 5;
      const fileSizeMB = req.file.size / (1024 * 1024);
      if (fileSizeMB > sizeLimitMB) {
        return res.status(400).json({
          error: `File size exceeds limit for ${planName} plan. Max ${sizeLimitMB}MB allowed.`,
        });
      }

      const fileKey = `${tenantId}/${Date.now()}-${req.file.originalname}`;

      // Upload to R2
      await storageService.uploadFile(
        fileKey,
        req.file.buffer,
        req.file.mimetype
      );

      const document = await prisma.document.create({
        data: {
          name: req.file.originalname,
          type: req.file.mimetype,
          size: req.file.size,
          url: fileKey, // Storing the key as URL for now
          status: "PENDING",
          tenantId,
        } as any,
      });

      // Trigger async processing
      kbService.processDocument(document.id, fileKey, req.file.mimetype);

      res.status(201).json(document);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  }
);

// Delete document
router.delete("/:id", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify document belongs to tenant
    const document = await prisma.document.findFirst({
      where: { id, tenantId },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    await prisma.document.deleteMany({ where: { id, tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Get document preview URL
router.get("/:id/preview", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify document belongs to tenant
    const document = await prisma.document.findFirst({
      where: { id, tenantId },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const url = await storageService.getSignedUrl(document.url);
    res.json({ url });
  } catch (error) {
    console.error("Failed to generate preview URL:", error);
    res.status(500).json({ error: "Failed to generate preview URL" });
  }
});

// Reprocess document
router.post("/:id/reprocess", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const tenantId = authReq.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Verify document belongs to tenant
    const document = await prisma.document.findFirst({
      where: { id, tenantId },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Trigger async processing
    kbService.processDocument(document.id, document.url, document.type);

    res.json({ success: true, message: "Reprocessing started" });
  } catch (error) {
    console.error("Reprocess error:", error);
    res.status(500).json({ error: "Failed to reprocess document" });
  }
});

export default router;
