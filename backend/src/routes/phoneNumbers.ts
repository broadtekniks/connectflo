import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { TelnyxService } from "../services/telnyx";

const router = Router();
const telnyxService = new TelnyxService();

// Get all owned numbers (from local DB)
router.get("/", async (req: Request, res: Response) => {
  try {
    const numbers = await prisma.phoneNumber.findMany();
    res.json(numbers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch phone numbers" });
  }
});

// Search available numbers (from Telnyx)
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { country, region } = req.query;

    const numbers = await telnyxService.searchNumbers(
      (country as string) || "US",
      region as string
    );
    res.json(numbers);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to search numbers" });
  }
});

// Purchase a number
router.post("/purchase", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, friendlyName } = req.body;

    // 1. Purchase from Telnyx
    if (process.env.TELNYX_API_KEY) {
      await telnyxService.purchaseNumber(phoneNumber);
    }

    // 2. Save to local DB
    const newNumber = await prisma.phoneNumber.create({
      data: {
        number: phoneNumber,
        friendlyName: friendlyName || phoneNumber,
        country: "US", // Defaulting for now, ideally parse from number or response
        region: "Unknown",
        type: "local",
        capabilities: { voice: true, sms: true, mms: false },
        monthlyCost: 1.0,
        status: "active",
      },
    });

    res.status(201).json(newNumber);
  } catch (error) {
    console.error("Purchase error:", error);
    res.status(500).json({ error: "Failed to purchase number" });
  }
});

export default router;
