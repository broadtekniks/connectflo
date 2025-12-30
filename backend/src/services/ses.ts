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

export class SESService {
  private transporter!: Transporter;
  private defaultFrom: string;

  constructor() {
    this.defaultFrom = process.env.SMTP_FROM_EMAIL || "noreply@connectflo.com";

    // If in test mode, use Ethereal (fake SMTP for testing)
    if (process.env.EMAIL_MODE === "test") {
      this.initEtherealTransport();
    } else if (process.env.SMTP_HOST) {
      // Use real SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          console.error("[Nodemailer] SMTP connection error:", error);
        } else {
          console.log("[Nodemailer] SMTP server is ready to send emails");
        }
      });
    } else {
      // Fallback to console logging (no actual emails sent)
      console.warn(
        "[Nodemailer] No SMTP configuration found. Emails will be logged to console only."
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

      console.log("[Nodemailer] Using Ethereal test account:");
      console.log("  User:", testAccount.user);
      console.log("  Pass:", testAccount.pass);
      console.log("  View emails at: https://ethereal.email/messages");
    } catch (error) {
      console.error("[Nodemailer] Failed to create Ethereal account:", error);
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
        `[Nodemailer] Email sent successfully. MessageId: ${info.messageId}`
      );

      // If using Ethereal, log preview URL
      if (
        process.env.EMAIL_MODE === "test" &&
        nodemailer.getTestMessageUrl(info)
      ) {
        console.log(
          `[Nodemailer] Preview URL: ${nodemailer.getTestMessageUrl(info)}`
        );
      }
    } catch (error) {
      console.error("[Nodemailer] Failed to send email:", error);
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
