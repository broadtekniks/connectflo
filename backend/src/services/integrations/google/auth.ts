import { google } from "googleapis";
import prisma from "../../../lib/prisma";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

export class GoogleAuthService {
  private getOAuth2Client() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ||
        "http://localhost:3001/api/integrations/google/callback"
    );
  }

  /**
   * Generate OAuth authorization URL for tenant to connect Google account
   */
  generateAuthUrl(tenantId: string, integrationType: string): string {
    const oauth2Client = this.getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      state: JSON.stringify({ tenantId, integrationType }), // Pass context through OAuth flow
      prompt: "consent", // Force consent screen to get refresh token
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens and store them
   */
  async handleCallback(code: string, state: string) {
    const oauth2Client = this.getOAuth2Client();

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const { tenantId, integrationType } = JSON.parse(state);

    // Store credentials in database (encrypted in production)
    await prisma.integration.upsert({
      where: {
        tenantId_provider_type: {
          tenantId,
          provider: "google",
          type: integrationType,
        },
      },
      update: {
        connected: true,
        credentials: JSON.parse(JSON.stringify(tokens)) as any, // TODO: Encrypt in production
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        provider: "google",
        type: integrationType,
        name: `Google ${
          integrationType.charAt(0).toUpperCase() + integrationType.slice(1)
        }`,
        connected: true,
        credentials: JSON.parse(JSON.stringify(tokens)) as any, // TODO: Encrypt in production
      },
    });

    return { success: true, tenantId };
  }

  /**
   * Get authenticated OAuth2 client for a tenant
   */
  async getAuthenticatedClient(tenantId: string, integrationType: string) {
    const integration = await prisma.integration.findUnique({
      where: {
        tenantId_provider_type: {
          tenantId,
          provider: "google",
          type: integrationType,
        },
      },
    });

    if (!integration || !integration.connected || !integration.credentials) {
      throw new Error(
        `Google ${integrationType} not connected for this tenant`
      );
    }

    const oauth2Client = this.getOAuth2Client();
    const credentials = integration.credentials as any;

    oauth2Client.setCredentials(credentials);

    // Check if token needs refresh
    if (credentials.expiry_date && credentials.expiry_date < Date.now()) {
      const { credentials: newCredentials } =
        await oauth2Client.refreshAccessToken();

      // Update stored credentials
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          credentials: JSON.parse(JSON.stringify(newCredentials)) as any,
        },
      });

      oauth2Client.setCredentials(newCredentials);
    }

    return oauth2Client;
  }

  /**
   * Disconnect Google integration for a tenant
   */
  async disconnect(tenantId: string, integrationType: string) {
    const integration = await prisma.integration.findUnique({
      where: {
        tenantId_provider_type: {
          tenantId,
          provider: "google",
          type: integrationType,
        },
      },
    });

    if (integration) {
      // Revoke token with Google
      try {
        const oauth2Client = this.getOAuth2Client();
        const credentials = integration.credentials as any;
        if (credentials?.access_token) {
          await oauth2Client.revokeToken(credentials.access_token);
        }
      } catch (error) {
        console.error("Error revoking Google token:", error);
      }

      // Delete from database
      await prisma.integration.delete({
        where: { id: integration.id },
      });
    }

    return { success: true };
  }
}
