import { google } from "googleapis";
import { GoogleAuthService } from "./auth";

const authService = new GoogleAuthService();

export class GoogleGmailService {
  /**
   * Send an email via Gmail
   */
  async sendEmail(
    tenantId: string,
    emailData: {
      to: string | string[];
      subject: string;
      body: string;
      isHtml?: boolean;
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: Array<{
        filename: string;
        content: string; // Base64 encoded
        mimeType: string;
      }>;
    }
  ) {
    const auth = await authService.getAuthenticatedClient(tenantId, "gmail");
    const gmail = google.gmail({ version: "v1", auth });

    // Build email message
    const to = Array.isArray(emailData.to)
      ? emailData.to.join(", ")
      : emailData.to;
    const cc = emailData.cc
      ? Array.isArray(emailData.cc)
        ? emailData.cc.join(", ")
        : emailData.cc
      : "";
    const bcc = emailData.bcc
      ? Array.isArray(emailData.bcc)
        ? emailData.bcc.join(", ")
        : emailData.bcc
      : "";

    let message = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : "",
      bcc ? `Bcc: ${bcc}` : "",
      `Subject: ${emailData.subject}`,
      `Content-Type: ${
        emailData.isHtml ? "text/html" : "text/plain"
      }; charset=utf-8`,
      "",
      emailData.body,
    ]
      .filter(Boolean)
      .join("\n");

    // Base64 encode the message
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      success: true,
      messageId: response.data.id,
    };
  }

  /**
   * Get user's Gmail profile info
   */
  async getProfile(tenantId: string) {
    const auth = await authService.getAuthenticatedClient(tenantId, "gmail");
    const gmail = google.gmail({ version: "v1", auth });

    const response = await gmail.users.getProfile({
      userId: "me",
    });

    return {
      success: true,
      email: response.data.emailAddress,
      messagesTotal: response.data.messagesTotal,
      threadsTotal: response.data.threadsTotal,
    };
  }
}
