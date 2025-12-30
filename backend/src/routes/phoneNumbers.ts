import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { TelnyxService } from "../services/telnyx";
import { TwilioService } from "../services/twilio";
import { PricingService } from "../services/pricing";
import { AuthRequest } from "../middleware/auth";

const router = Router();
const telnyxService = new TelnyxService();
const twilioService = new TwilioService();
const pricingService = new PricingService();

// Get all owned numbers (from local DB)
router.get("/", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;
    const role = authReq.user?.role;
    const userId = authReq.user?.userId;

    if (!tenantId && role !== "SUPER_ADMIN") {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Build where clause based on role
    let whereClause: any = {};

    if (role === "SUPER_ADMIN") {
      // Super admins see all numbers
      whereClause = {};
    } else if (role === "AGENT") {
      // Agents see only their assigned numbers + unassigned numbers in their tenant
      whereClause = {
        tenantId,
        OR: [{ assignedToId: userId }, { assignedToId: null }],
      };
    } else {
      // TENANT_ADMIN and others see all tenant numbers
      whereClause = { tenantId };
    }

    const numbers = await prisma.phoneNumber.findMany({
      where: whereClause,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pricingTier: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json(numbers);
  } catch (error) {
    console.error("Failed to fetch phone numbers:", error);
    res.status(500).json({ error: "Failed to fetch phone numbers" });
  }
});

// Search available numbers (from Telnyx or Twilio)
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { country, region, provider } = req.query;
    const selectedProvider = (provider as string) || "TELNYX";

    let numbers;
    if (selectedProvider === "TWILIO") {
      const twilioNumbers = await twilioService.searchNumbers(
        (country as string) || "US",
        region as string
      );
      // Map Twilio format to common format
      numbers = twilioNumbers.map((n: any) => ({
        phone_number: n.phoneNumber,
        cost_information: { monthly_cost: "1.15" },
        region_information: [
          { region_type: "location", region_name: n.locality },
          { region_type: "state", region_name: n.region },
        ],
        features: Object.entries(n.capabilities)
          .filter(([_, enabled]) => enabled)
          .map(([feature]) => ({ name: feature })),
      }));
    } else {
      numbers = await telnyxService.searchNumbers(
        (country as string) || "US",
        region as string
      );
    }

    res.json(numbers);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to search numbers" });
  }
});

// Purchase a number
router.post("/purchase", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { phoneNumber, friendlyName, provider } = req.body;
    const tenantId = authReq.user?.tenantId;
    const selectedProvider = provider || "TELNYX";

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    // Get tenant to determine plan
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(400).json({ error: "Tenant not found" });
    }

    // 1. Purchase from selected provider
    let wholesaleCost = 1.0; // Default
    let region = "Unknown";
    let country = "US";

    if (selectedProvider === "TWILIO") {
      // Purchase from Twilio
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return res
          .status(400)
          .json({ error: "Twilio credentials not configured" });
      }

      const webhookUrl = process.env.TWILIO_WEBHOOK_URL || "";
      await twilioService.purchaseNumber(phoneNumber, webhookUrl);

      // Wait for provisioning
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get number details
      try {
        const numberDetails = await twilioService.getNumberDetails(phoneNumber);
        if (numberDetails) {
          wholesaleCost = 1.15; // Twilio US local pricing
          region = numberDetails.friendlyName || "Unknown";
        }
      } catch (err) {
        console.error("Failed to fetch Twilio number details:", err);
      }
    } else {
      // Purchase from Telnyx
      if (!process.env.TELNYX_API_KEY) {
        return res.status(400).json({ error: "Telnyx API key not configured" });
      }

      await telnyxService.purchaseNumber(phoneNumber);

      // Wait a moment for Telnyx to provision the number
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Fetch the number details to get region info
      try {
        const numberDetails = await telnyxService.getNumberDetails(phoneNumber);
        if (numberDetails) {
          wholesaleCost = parseFloat(
            numberDetails.monthly_recurring_cost || "1.0"
          );

          // Parse region from number details
          if (
            numberDetails.region_information &&
            Array.isArray(numberDetails.region_information)
          ) {
            const city = numberDetails.region_information.find(
              (i: any) => i.region_type === "location"
            )?.region_name;
            const state = numberDetails.region_information.find(
              (i: any) => i.region_type === "state"
            )?.region_name;

            if (city && state) region = `${city}, ${state}`;
            else if (city) region = city;
            else if (state) region = state;
          } else if (numberDetails.regulatory_requirements) {
            const reqs = numberDetails.regulatory_requirements;
            if (reqs.locality) region = reqs.locality;
            else if (reqs.administrative_area)
              region = reqs.administrative_area;
          }

          // Fallback: Parse from phone number (area code)
          if (region === "Unknown") {
            const match = phoneNumber.match(/^\+1(\d{3})/);
            if (match) {
              region = `Area Code ${match[1]}`;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch number details:", err);
      }
    }

    // 2. Calculate retail price using pricing tiers
    const pricing = await pricingService.calculateRetailPrice(
      wholesaleCost,
      tenant.plan
    );

    // 3. Save to local DB
    const newNumber = await prisma.phoneNumber.create({
      data: {
        number: phoneNumber,
        friendlyName: friendlyName || phoneNumber,
        country: country,
        region: region,
        type: "local",
        capabilities: { voice: true, sms: true, mms: false },
        provider: selectedProvider,
        wholesaleCost,
        retailPrice: pricing.retailPrice,
        pricingTierId: pricing.pricingTierId,
        monthlyCost: pricing.retailPrice, // Legacy field
        setupCost: 0,
        status: "active",
        tenantId,
      },
    });

    res.status(201).json(newNumber);
  } catch (error) {
    console.error("Purchase error:", error);
    res.status(500).json({ error: "Failed to purchase number" });
  }
});

// Sync numbers from Telnyx to database
router.post("/sync", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;
    const role = authReq.user?.role;

    // Only super admin or tenant admin can sync
    if (role !== "SUPER_ADMIN" && role !== "TENANT_ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID not found in token" });
    }

    if (!process.env.TELNYX_API_KEY) {
      return res.status(400).json({ error: "Telnyx API key not configured" });
    }

    // Fetch numbers from Telnyx
    const telnyxNumbers = await telnyxService.listOwnedNumbers();

    const syncedNumbers = [];
    const skippedNumbers = [];

    for (const telnyxNum of telnyxNumbers) {
      // Check if number already exists in DB
      const existing = await prisma.phoneNumber.findUnique({
        where: { number: telnyxNum.phone_number },
      });

      if (existing) {
        skippedNumbers.push(telnyxNum.phone_number);
        continue;
      }

      // Parse region info
      let region = "Unknown";
      let country = "US";

      // Try multiple sources for region data
      if (
        telnyxNum.region_information &&
        Array.isArray(telnyxNum.region_information)
      ) {
        const city = telnyxNum.region_information.find(
          (i: any) => i.region_type === "location"
        )?.region_name;
        const state = telnyxNum.region_information.find(
          (i: any) => i.region_type === "state"
        )?.region_name;
        const countryInfo = telnyxNum.region_information.find(
          (i: any) => i.region_type === "country_code"
        )?.region_name;

        if (city && state) region = `${city}, ${state}`;
        else if (city) region = city;
        else if (state) region = state;

        if (countryInfo) country = countryInfo;
      } else if (telnyxNum.regulatory_requirements) {
        const reqs = telnyxNum.regulatory_requirements;
        if (reqs.locality) region = reqs.locality;
        else if (reqs.administrative_area) region = reqs.administrative_area;
      }

      // Fallback: Parse from phone number (area code)
      if (region === "Unknown" && telnyxNum.phone_number) {
        const match = telnyxNum.phone_number.match(/^\+1(\d{3})/);
        if (match) {
          region = `Area Code ${match[1]}`;
        }
      }

      // Get tenant to determine plan
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      const wholesaleCost = parseFloat(
        telnyxNum.monthly_recurring_cost || "1.0"
      );

      // Calculate retail price
      const pricing = await pricingService.calculateRetailPrice(
        wholesaleCost,
        tenant?.plan || "STARTER"
      );

      // Create in database
      const newNumber = await prisma.phoneNumber.create({
        data: {
          number: telnyxNum.phone_number,
          friendlyName: telnyxNum.phone_number,
          country: country,
          region: region,
          type: telnyxNum.phone_number_type || "local",
          capabilities: {
            voice: telnyxNum.features?.voice || true,
            sms: telnyxNum.features?.sms || true,
            mms: telnyxNum.features?.mms || false,
          },
          wholesaleCost,
          retailPrice: pricing.retailPrice,
          pricingTierId: pricing.pricingTierId,
          monthlyCost: pricing.retailPrice, // Legacy field
          status: telnyxNum.status || "active",
          tenantId,
        },
      });

      syncedNumbers.push(newNumber);
    }

    res.json({
      message: "Sync completed",
      synced: syncedNumbers.length,
      skipped: skippedNumbers.length,
      numbers: syncedNumbers,
    });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ error: "Failed to sync numbers from Telnyx" });
  }
});

// Update regions for existing numbers from Telnyx
router.post("/update-regions", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.user?.tenantId;
    const role = authReq.user?.role;

    if (!tenantId && role !== "SUPER_ADMIN") {
      return res.status(400).json({ error: "Tenant ID not found" });
    }

    // Get all numbers that need region update
    const whereClause = role === "SUPER_ADMIN" ? {} : { tenantId };
    const localNumbers = await prisma.phoneNumber.findMany({
      where: {
        ...whereClause,
        region: {
          in: ["Unknown", "US"],
        },
      },
    });

    if (!process.env.TELNYX_API_KEY) {
      return res.status(400).json({ error: "Telnyx API key not configured" });
    }

    const updated: any[] = [];
    const failed: any[] = [];

    for (const localNum of localNumbers) {
      try {
        const telnyxDetails = await telnyxService.getNumberDetails(
          localNum.number
        );

        if (!telnyxDetails) {
          failed.push({
            number: localNum.number,
            reason: "Not found in Telnyx",
          });
          continue;
        }

        let region = "Unknown";
        let country = "US";

        // Parse region info
        if (
          telnyxDetails.region_information &&
          Array.isArray(telnyxDetails.region_information)
        ) {
          const city = telnyxDetails.region_information.find(
            (i: any) => i.region_type === "location"
          )?.region_name;
          const state = telnyxDetails.region_information.find(
            (i: any) => i.region_type === "state"
          )?.region_name;
          const countryInfo = telnyxDetails.region_information.find(
            (i: any) => i.region_type === "country_code"
          )?.region_name;

          if (city && state) region = `${city}, ${state}`;
          else if (city) region = city;
          else if (state) region = state;

          if (countryInfo) country = countryInfo;
        } else if (telnyxDetails.regulatory_requirements) {
          const reqs = telnyxDetails.regulatory_requirements;
          if (reqs.locality) region = reqs.locality;
          else if (reqs.administrative_area) region = reqs.administrative_area;
        }

        // Fallback: Parse from phone number (area code)
        if (region === "Unknown") {
          const match = localNum.number.match(/^\+1(\d{3})/);
          if (match) {
            region = `Area Code ${match[1]}`;
          }
        }

        // Update the number
        const updatedNum = await prisma.phoneNumber.update({
          where: { id: localNum.id },
          data: {
            region,
            country,
          },
        });

        updated.push(updatedNum);
      } catch (err) {
        console.error(`Failed to update ${localNum.number}:`, err);
        failed.push({ number: localNum.number, reason: "Update failed" });
      }
    }

    res.json({
      message: "Region update completed",
      updated: updated.length,
      failed: failed.length,
      updatedNumbers: updated,
      failedNumbers: failed,
    });
  } catch (error) {
    console.error("Region update error:", error);
    res.status(500).json({ error: "Failed to update regions" });
  }
});

// Assign number to user
router.post("/:id/assign", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const role = authReq.user?.role;
    const tenantId = authReq.user?.tenantId;

    // Only TENANT_ADMIN and SUPER_ADMIN can assign numbers
    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Verify phone number exists and belongs to tenant (unless super admin)
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { id },
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: "Phone number not found" });
    }

    if (role !== "SUPER_ADMIN" && phoneNumber.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Verify user exists and belongs to same tenant
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.tenantId !== phoneNumber.tenantId) {
      return res.status(400).json({ error: "User must belong to same tenant" });
    }

    // Update assignment
    const updatedNumber = await prisma.phoneNumber.update({
      where: { id },
      data: { assignedToId: userId },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(updatedNumber);
  } catch (error) {
    console.error("Assignment error:", error);
    res.status(500).json({ error: "Failed to assign phone number" });
  }
});

// Unassign number from user
router.post("/:id/unassign", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const role = authReq.user?.role;
    const tenantId = authReq.user?.tenantId;

    // Only TENANT_ADMIN and SUPER_ADMIN can unassign numbers
    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Verify phone number exists and belongs to tenant (unless super admin)
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { id },
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: "Phone number not found" });
    }

    if (role !== "SUPER_ADMIN" && phoneNumber.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Remove assignment
    const updatedNumber = await prisma.phoneNumber.update({
      where: { id },
      data: { assignedToId: null },
    });

    res.json(updatedNumber);
  } catch (error) {
    console.error("Unassignment error:", error);
    res.status(500).json({ error: "Failed to unassign phone number" });
  }
});

// Assign number to tenant (SUPER_ADMIN only)
router.post("/:id/assign-tenant", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const { tenantId } = req.body;
    const role = authReq.user?.role;

    // Only SUPER_ADMIN can assign numbers to tenants
    if (role !== "SUPER_ADMIN") {
      return res
        .status(403)
        .json({ error: "Only super admins can assign numbers to tenants" });
    }

    // Verify phone number exists
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { id },
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: "Phone number not found" });
    }

    // Verify target tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Update tenant assignment and clear user assignment
    const updatedNumber = await prisma.phoneNumber.update({
      where: { id },
      data: {
        tenantId: tenantId,
        assignedToId: null, // Clear user assignment when changing tenant
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pricingTier: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    res.json(updatedNumber);
  } catch (error) {
    console.error("Tenant assignment error:", error);
    res.status(500).json({ error: "Failed to assign phone number to tenant" });
  }
});

// Make a test call from a phone number
router.post("/:id/test-call", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const { toNumber } = req.body;
    const role = authReq.user?.role;
    const tenantId = authReq.user?.tenantId;

    if (!toNumber) {
      return res.status(400).json({ error: "Destination number is required" });
    }

    // Verify phone number exists and user has access
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { id },
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: "Phone number not found" });
    }

    // Check permissions
    if (role !== "SUPER_ADMIN" && phoneNumber.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if number has voice capability
    const capabilities = phoneNumber.capabilities as any;
    if (!capabilities?.voice) {
      return res
        .status(400)
        .json({ error: "This number does not support voice calls" });
    }

    // Make the test call
    const call = await telnyxService.makeTestCall(phoneNumber.number, toNumber);

    res.json({
      success: true,
      message: "Test call initiated",
      callId: call.data?.call_control_id,
      from: phoneNumber.number,
      to: toNumber,
    });
  } catch (error) {
    console.error("Test call error:", error);
    res.status(500).json({ error: "Failed to initiate test call" });
  }
});

// Send a test SMS from a phone number
router.post("/:id/test-sms", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { id } = req.params;
    const { toNumber, message } = req.body;
    const role = authReq.user?.role;
    const tenantId = authReq.user?.tenantId;

    if (!toNumber) {
      return res.status(400).json({ error: "Destination number is required" });
    }

    if (!message) {
      return res.status(400).json({ error: "Message text is required" });
    }

    // Verify phone number exists and user has access
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { id },
    });

    if (!phoneNumber) {
      return res.status(404).json({ error: "Phone number not found" });
    }

    // Check permissions
    if (role !== "SUPER_ADMIN" && phoneNumber.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if number has SMS capability
    const capabilities = phoneNumber.capabilities as any;
    if (!capabilities?.sms) {
      return res
        .status(400)
        .json({ error: "This number does not support SMS" });
    }

    // Send the test SMS
    const sms = await telnyxService.sendTestSMS(
      phoneNumber.number,
      toNumber,
      message
    );

    res.json({
      success: true,
      message: "Test SMS sent",
      messageId: sms.data?.id,
      from: phoneNumber.number,
      to: toNumber,
    });
  } catch (error) {
    console.error("Test SMS error:", error);
    res.status(500).json({ error: "Failed to send test SMS" });
  }
});

export default router;
