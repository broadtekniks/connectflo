import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface EmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  from?: string;
  replyTo?: string;
}

export class EmailService {
  private transporter!: Transporter;
  private defaultFrom: string;

  constructor() {
    this.defaultFrom = process.env.SMTP_FROM_EMAIL || "noreply@connectflo.com";

    const emailMode = (process.env.EMAIL_MODE || "").toLowerCase();

    // If in test mode, use Ethereal (fake SMTP for testing)
    if (emailMode === "test") {
      this.initEtherealTransport();
    } else if (emailMode === "smtp") {
      const host = process.env.SMTP_HOST;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASSWORD;
      if (!host || !user || !pass) {
        console.error(
          "[Email] EMAIL_MODE=smtp requires SMTP_HOST, SMTP_USER, and SMTP_PASSWORD. Falling back to console transport."
        );
        this.transporter = nodemailer.createTransport({
          streamTransport: true,
          newline: "unix",
          buffer: true,
        });
        return;
      }

      // Use real SMTP configuration
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user,
          pass,
        },
      });

      // Verify connection configuration
      this.transporter.verify((error) => {
        if (error) {
          console.error("[Email] SMTP connection error:", error);
        } else {
          console.log("[Email] SMTP server is ready to send emails");
        }
      });
    } else {
      // Fallback to console logging (no actual emails sent)
      console.warn(
        "[Email] No SMTP configuration found. Emails will be logged to console only."
      );
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: "unix",
        buffer: true,
      });
    }
  }

  private async initEtherealTransport() {
    try {
      // Create a test account on Ethereal
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      console.log("[Email] Using Ethereal test account:");
      console.log("  User:", testAccount.user);
      console.log("  Pass:", testAccount.pass);
      console.log("  View emails at: https://ethereal.email/messages");
    } catch (error) {
      console.error("[Email] Failed to create Ethereal account:", error);
    }
  }

  /**
   * Send an email using Nodemailer
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
    const from = options.from || this.defaultFrom;

    try {
      const info = await this.transporter.sendMail({
        from: from,
        to: toAddresses.join(", "),
        subject: options.subject,
        text: options.isHtml ? undefined : options.body,
        html: options.isHtml ? options.body : undefined,
        replyTo: options.replyTo,
      });

      console.log(
        `[Email] Email sent successfully. MessageId: ${info.messageId}`
      );

      // If using Ethereal, log preview URL
      if (
        process.env.EMAIL_MODE === "test" &&
        nodemailer.getTestMessageUrl(info)
      ) {
        console.log(
          `[Email] Preview URL: ${nodemailer.getTestMessageUrl(info)}`
        );
      }
    } catch (error) {
      console.error("[Email] Failed to send email:", error);
      throw new Error(
        `Failed to send email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Send a simple text email
   */
  async sendTextEmail(
    to: string | string[],
    subject: string,
    body: string
  ): Promise<void> {
    await this.sendEmail({ to, subject, body, isHtml: false });
  }

  /**
   * Send an HTML email
   */
  async sendHtmlEmail(
    to: string | string[],
    subject: string,
    body: string
  ): Promise<void> {
    await this.sendEmail({ to, subject, body, isHtml: true });
  }

  /**
   * Send a notification email to administrators
   */
  async sendNotificationEmail(subject: string, body: string): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@connectflo.com";
    await this.sendTextEmail(adminEmail, subject, body);
  }
}
