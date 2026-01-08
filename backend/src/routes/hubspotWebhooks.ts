import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";

const router = Router();

/**
 * Verify HubSpot webhook signature
 * https://developers.hubspot.com/docs/api/webhooks/validating-requests
 */
function verifyHubSpotSignature(
  requestBody: string,
  signature: string,
  clientSecret: string
): boolean {
  const hash = crypto
    .createHmac("sha256", clientSecret)
    .update(requestBody)
    .digest("hex");
  return hash === signature;
}

/**
 * Get client secret from CRM connection credentials
 */
async function getClientSecret(portalId: string): Promise<string | null> {
  try {
    // Find the HubSpot connection for this portal
    const connection = await prisma.crmConnection.findFirst({
      where: {
        crmType: "hubspot",
        config: {
          path: ["portalId"],
          equals: portalId,
        },
      },
      select: {
        credentials: true,
      },
    });

    if (!connection) {
      return null;
    }

    // In a real implementation, decrypt the credentials
    // For now, we'll extract the client secret from the stored credentials
    const credentials = JSON.parse(connection.credentials);
    return credentials.clientSecret || null;
  } catch (error) {
    console.error("Error fetching client secret:", error);
    return null;
  }
}

/**
 * Process HubSpot webhook events
 */
async function processHubSpotEvent(event: any): Promise<void> {
  const {
    objectId,
    propertyName,
    propertyValue,
    changeSource,
    eventId,
    subscriptionId,
    portalId,
    appId,
    occurredAt,
    subscriptionType,
    attemptNumber,
  } = event;

  console.log(
    `[HubSpot Webhook] Processing ${subscriptionType} for object ${objectId} in portal ${portalId}`
  );

  // Find the CRM connection for this portal
  const connection = await prisma.crmConnection.findFirst({
    where: {
      crmType: "hubspot",
      config: {
        path: ["portalId"],
        equals: portalId.toString(),
      },
    },
    include: {
      tenant: true,
    },
  });

  if (!connection) {
    console.log(`[HubSpot Webhook] No connection found for portal ${portalId}`);
    return;
  }

  // Parse subscription type (e.g., "contact.creation", "deal.propertyChange")
  const [objectType, eventType] = subscriptionType.split(".");

  // Create a sync job to process this webhook event
  await prisma.crmSyncJob.create({
    data: {
      connectionId: connection.id,
      jobType: "webhook",
      objectType: objectType,
      status: "pending",
      payload: {
        eventType,
        objectId,
        propertyName,
        propertyValue,
        changeSource,
        eventId,
        subscriptionId,
        occurredAt,
        attemptNumber,
      },
    },
  });

  // Process the event based on type
  switch (subscriptionType) {
    case "contact.creation":
    case "contact.propertyChange":
      await handleContactEvent(connection.id, objectId, eventType);
      break;

    case "company.creation":
    case "company.propertyChange":
      await handleCompanyEvent(connection.id, objectId, eventType);
      break;

    case "deal.creation":
    case "deal.propertyChange":
      await handleDealEvent(connection.id, objectId, eventType);
      break;

    case "contact.deletion":
    case "company.deletion":
    case "deal.deletion":
      await handleDeletion(connection.id, objectType, objectId);
      break;

    case "contact.merge":
    case "company.merge":
    case "deal.merge":
      await handleMerge(connection.id, objectType, event);
      break;

    case "contact.associationChange":
    case "company.associationChange":
    case "deal.associationChange":
      await handleAssociationChange(connection.id, event);
      break;

    default:
      console.log(
        `[HubSpot Webhook] Unhandled subscription type: ${subscriptionType}`
      );
  }
}

/**
 * Handle contact creation/update events
 */
async function handleContactEvent(
  connectionId: string,
  contactId: string,
  eventType: string
): Promise<void> {
  console.log(
    `[HubSpot Webhook] Processing contact ${eventType} for ID: ${contactId}`
  );

  // Check if we already have a sync record
  const existingSync = await prisma.crmSyncRecord.findUnique({
    where: {
      connectionId_objectType_crmId: {
        connectionId,
        objectType: "contact",
        crmId: contactId,
      },
    },
  });

  if (existingSync) {
    // Update existing sync record
    await prisma.crmSyncRecord.update({
      where: { id: existingSync.id },
      data: {
        lastSyncedAt: new Date(),
      },
    });
    console.log(
      `[HubSpot Webhook] Updated sync record for contact ${contactId}`
    );
  } else if (eventType === "creation") {
    // Create new sync record placeholder (actual data sync happens in background job)
    await prisma.crmSyncRecord.create({
      data: {
        connectionId,
        objectType: "contact",
        crmId: contactId,
        internalId: "", // Will be filled by sync job
        lastSyncedAt: new Date(),
      },
    });
    console.log(
      `[HubSpot Webhook] Created sync record for new contact ${contactId}`
    );
  }

  // TODO: Trigger background job to fetch full contact data from HubSpot API
  // and update/create the corresponding User record in our database
}

/**
 * Handle company creation/update events
 */
async function handleCompanyEvent(
  connectionId: string,
  companyId: string,
  eventType: string
): Promise<void> {
  console.log(
    `[HubSpot Webhook] Processing company ${eventType} for ID: ${companyId}`
  );

  const existingSync = await prisma.crmSyncRecord.findUnique({
    where: {
      connectionId_objectType_crmId: {
        connectionId,
        objectType: "company",
        crmId: companyId,
      },
    },
  });

  if (existingSync) {
    await prisma.crmSyncRecord.update({
      where: { id: existingSync.id },
      data: { lastSyncedAt: new Date() },
    });
  } else if (eventType === "creation") {
    await prisma.crmSyncRecord.create({
      data: {
        connectionId,
        objectType: "company",
        crmId: companyId,
        internalId: "",
        lastSyncedAt: new Date(),
      },
    });
  }

  // TODO: Fetch and sync company data
}

/**
 * Handle deal creation/update events
 */
async function handleDealEvent(
  connectionId: string,
  dealId: string,
  eventType: string
): Promise<void> {
  console.log(
    `[HubSpot Webhook] Processing deal ${eventType} for ID: ${dealId}`
  );

  const existingSync = await prisma.crmSyncRecord.findUnique({
    where: {
      connectionId_objectType_crmId: {
        connectionId,
        objectType: "deal",
        crmId: dealId,
      },
    },
  });

  if (existingSync) {
    await prisma.crmSyncRecord.update({
      where: { id: existingSync.id },
      data: { lastSyncedAt: new Date() },
    });
  } else if (eventType === "creation") {
    await prisma.crmSyncRecord.create({
      data: {
        connectionId,
        objectType: "deal",
        crmId: dealId,
        internalId: "",
        lastSyncedAt: new Date(),
      },
    });
  }

  // TODO: Fetch and sync deal data
}

/**
 * Handle deletion events
 */
async function handleDeletion(
  connectionId: string,
  objectType: string,
  objectId: string
): Promise<void> {
  console.log(
    `[HubSpot Webhook] Processing deletion for ${objectType} ID: ${objectId}`
  );

  // Delete the sync record
  await prisma.crmSyncRecord.deleteMany({
    where: {
      connectionId,
      objectType,
      crmId: objectId,
    },
  });

  console.log(
    `[HubSpot Webhook] Deleted sync record for ${objectType} ${objectId}`
  );

  // TODO: Optionally soft-delete or archive the corresponding internal record
}

/**
 * Handle merge events
 */
async function handleMerge(
  connectionId: string,
  objectType: string,
  event: any
): Promise<void> {
  const { primaryObjectId, mergedObjectIds, newObjectId } = event;

  console.log(
    `[HubSpot Webhook] Processing merge for ${objectType}: ${mergedObjectIds} -> ${primaryObjectId}`
  );

  // Update sync records to point to the winning record
  if (mergedObjectIds && Array.isArray(mergedObjectIds)) {
    for (const mergedId of mergedObjectIds) {
      await prisma.crmSyncRecord.deleteMany({
        where: {
          connectionId,
          objectType,
          crmId: mergedId,
        },
      });
    }
  }

  // Ensure we have a record for the primary/new object
  const finalId = newObjectId || primaryObjectId;
  const existingSync = await prisma.crmSyncRecord.findUnique({
    where: {
      connectionId_objectType_crmId: {
        connectionId,
        objectType,
        crmId: finalId,
      },
    },
  });

  if (!existingSync) {
    await prisma.crmSyncRecord.create({
      data: {
        connectionId,
        objectType,
        crmId: finalId,
        internalId: "",
        lastSyncedAt: new Date(),
      },
    });
  }

  // TODO: Merge corresponding internal records
}

/**
 * Handle association change events
 */
async function handleAssociationChange(
  connectionId: string,
  event: any
): Promise<void> {
  const {
    associationType,
    fromObjectId,
    toObjectId,
    associationRemoved,
    isPrimaryAssociation,
  } = event;

  console.log(
    `[HubSpot Webhook] Processing association change: ${associationType} ${fromObjectId} -> ${toObjectId} (removed: ${associationRemoved})`
  );

  // TODO: Update relationship records in database
  // For example: Link contact to company, deal to contact, etc.
}

/**
 * Main webhook endpoint
 */
router.post("/hubspot", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-hubspot-signature"] as string;
    const rawBody = JSON.stringify(req.body);

    // HubSpot sends events as an array
    const events = Array.isArray(req.body) ? req.body : [req.body];

    if (events.length === 0) {
      console.log("[HubSpot Webhook] Received empty payload");
      return res.status(200).json({ received: true });
    }

    // Get portal ID from first event
    const portalId = events[0]?.portalId;

    if (!portalId) {
      console.log("[HubSpot Webhook] No portalId in webhook payload");
      return res.status(400).json({ error: "Missing portalId" });
    }

    // Verify signature if provided
    if (signature) {
      const clientSecret = await getClientSecret(portalId);

      if (!clientSecret) {
        console.log(
          `[HubSpot Webhook] No client secret found for portal ${portalId}`
        );
        return res.status(403).json({ error: "Invalid signature" });
      }

      const isValid = verifyHubSpotSignature(rawBody, signature, clientSecret);

      if (!isValid) {
        console.log(
          `[HubSpot Webhook] Invalid signature for portal ${portalId}`
        );
        return res.status(403).json({ error: "Invalid signature" });
      }
    }

    // Process each event
    const processingPromises = events.map((event) =>
      processHubSpotEvent(event).catch((error) => {
        console.error(
          `[HubSpot Webhook] Error processing event ${event.eventId}:`,
          error
        );
      })
    );

    await Promise.all(processingPromises);

    // Always respond quickly to HubSpot (within 5 seconds)
    res.status(200).json({
      received: true,
      processedEvents: events.length,
    });
  } catch (error) {
    console.error("[HubSpot Webhook] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
