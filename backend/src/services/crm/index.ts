import prisma from "../../lib/prisma";
import crypto from "crypto";
import { CRMProvider, CRMCredentials } from "./types";
import { HubSpotProvider } from "./providers/hubspot";

function getEncryptionKey(): Buffer {
  const raw = String(process.env.CRM_ENCRYPTION_KEY || "").trim();

  // Must be a stable, 32-byte (64 hex chars) key. Do NOT fall back to random,
  // otherwise stored CRM credentials become undecryptable after restarts.
  if (!raw) {
    throw new Error(
      "CRM_ENCRYPTION_KEY is not set. Set it to a stable 64-hex-character key so CRM credentials can be decrypted across restarts."
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "CRM_ENCRYPTION_KEY must be 64 hex characters (32 bytes) for aes-256-gcm."
    );
  }

  return Buffer.from(raw, "hex");
}

export class CRMService {
  /**
   * Encrypt credentials before storing in database
   */
  static encryptCredentials(credentials: CRMCredentials): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(JSON.stringify(credentials), "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString("hex"),
      encrypted,
      authTag: authTag.toString("hex"),
    });
  }

  /**
   * Decrypt credentials when loading from database
   */
  static decryptCredentials(encryptedData: string): CRMCredentials {
    const key = getEncryptionKey();
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  }

  /**
   * Get CRM provider instance for a connection
   */
  static async getProvider(connectionId: string): Promise<CRMProvider> {
    const connection = await prisma.crmConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error("CRM connection not found");
    }

    if (connection.status !== "active") {
      throw new Error(`CRM connection is ${connection.status}`);
    }

    let credentials: CRMCredentials;
    try {
      credentials = this.decryptCredentials(connection.credentials);
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      // Node's AES-GCM will often throw: "Unsupported state or unable to authenticate data"
      // when the authTag doesn't match (most commonly: wrong/missing encryption key).
      throw new Error(
        `Failed to decrypt stored CRM credentials. This usually means CRM_ENCRYPTION_KEY is missing or different from when the connection was created. ` +
          `Set a stable CRM_ENCRYPTION_KEY (64 hex chars) and reconnect the CRM connection to re-encrypt credentials. Underlying error: ${msg}`
      );
    }

    let provider: CRMProvider;

    switch (connection.crmType) {
      case "hubspot":
        provider = new HubSpotProvider(connectionId);
        break;
      // Add more providers here
      // case 'salesforce':
      //   provider = new SalesforceProvider(connectionId);
      //   break;
      default:
        throw new Error(`Unsupported CRM type: ${connection.crmType}`);
    }

    await provider.authenticate(credentials);
    return provider;
  }

  /**
   * Discover and store fields from CRM
   */
  static async discoverAndStoreFields(
    connectionId: string,
    objectType: "contact" | "company" | "deal" | "activity"
  ): Promise<void> {
    const provider = await this.getProvider(connectionId);
    const fields = await provider.discoverFields(objectType);

    // Delete old discovered fields for this object type
    await prisma.crmDiscoveredField.deleteMany({
      where: {
        connectionId,
        objectType,
      },
    });

    // Insert new discovered fields
    await prisma.crmDiscoveredField.createMany({
      data: fields.map((field) => ({
        connectionId,
        objectType,
        fieldName: field.name,
        fieldLabel: field.label,
        fieldType: field.type,
        isRequired: field.isRequired,
        isCustom: field.isCustom,
        isReadOnly: field.isReadOnly,
        picklistValues: field.picklistValues || undefined,
        description: field.description || null,
      })),
    });
  }

  /**
   * Get discovered fields for use in workflows
   */
  static async getDiscoveredFields(
    connectionId: string,
    objectType?: "contact" | "company" | "deal" | "activity"
  ) {
    return await prisma.crmDiscoveredField.findMany({
      where: {
        connectionId,
        ...(objectType && { objectType }),
      },
      orderBy: [{ isCustom: "asc" }, { fieldLabel: "asc" }],
    });
  }

  /**
   * Test connection and update status
   */
  static async testConnection(connectionId: string): Promise<boolean> {
    try {
      const provider = await this.getProvider(connectionId);
      // Try to fetch one contact to test
      await provider.searchContacts({ email: "test@test.com" });

      await prisma.crmConnection.update({
        where: { id: connectionId },
        data: {
          status: "active",
          errorMessage: null,
        },
      });

      return true;
    } catch (error: any) {
      await prisma.crmConnection.update({
        where: { id: connectionId },
        data: {
          status: "error",
          errorMessage: error.message,
        },
      });

      return false;
    }
  }

  /**
   * Refresh authentication for a connection
   */
  static async refreshConnection(connectionId: string): Promise<void> {
    const provider = await this.getProvider(connectionId);
    await provider.refreshAuthentication();

    // Get updated credentials from provider
    const connection = await prisma.crmConnection.findUnique({
      where: { id: connectionId },
    });

    if (connection) {
      const credentials = this.decryptCredentials(connection.credentials);
      // Update with new credentials
      await prisma.crmConnection.update({
        where: { id: connectionId },
        data: {
          credentials: this.encryptCredentials(credentials),
        },
      });
    }
  }
}
