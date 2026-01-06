import prisma from "../lib/prisma";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

interface SendSmsOptions {
  tenantId: string;
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string[];
}

/**
 * Check if a phone number has opted out of SMS
 */
export async function checkOptOut(
  tenantId: string,
  phoneNumber: string
): Promise<boolean> {
  const optOut = await (prisma as any).smsOptOut.findUnique({
    where: {
      tenantId_phoneNumber: {
        tenantId,
        phoneNumber,
      },
    },
  });

  return !!optOut;
}

/**
 * Send an SMS message
 */
export async function sendSms(options: SendSmsOptions): Promise<any> {
  const { tenantId, to, body, from, mediaUrl } = options;

  // Check opt-out status
  const hasOptedOut = await checkOptOut(tenantId, to);
  if (hasOptedOut) {
    throw new Error(`Phone number ${to} has opted out of SMS`);
  }

  // Get tenant settings
  const tenant: any = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Determine sending number
  let fromNumber = from;
  if (!fromNumber) {
    // Find a phone number owned by this tenant
    const phoneNumber: any = await prisma.phoneNumber.findFirst({
      where: {
        tenantId,
        capabilities: { path: ["sms"], equals: true } as any,
      },
    });

    if (!phoneNumber) {
      throw new Error("No SMS-capable phone number found for tenant");
    }

    fromNumber = phoneNumber.number;
  }

  // Get phone number details to determine provider
  const phoneNumberRecord: any = await prisma.phoneNumber.findUnique({
    where: { number: fromNumber },
  });

  if (!phoneNumberRecord) {
    throw new Error(`Phone number ${fromNumber} not found`);
  }

  // Send via appropriate provider
  let messageSid: string;

  if (phoneNumberRecord.provider === "twilio") {
    const message = await twilioClient.messages.create({
      body,
      from: fromNumber,
      to,
      mediaUrl,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    });

    messageSid = message.sid;
    console.log("[SMS] Sent via Twilio:", messageSid);
  } else if (phoneNumberRecord.provider === "telnyx") {
    const Telnyx = require("telnyx");
    const telnyxClient = Telnyx(process.env.TELNYX_API_KEY);
    
    const message = await telnyxClient.messages.create({
      from: fromNumber,
      to,
      text: body,
      media_urls: mediaUrl,
      messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
    });

    messageSid = message.data.id;
    console.log("[SMS] Sent via Telnyx:", messageSid);
  } else {
    throw new Error(`Unsupported provider: ${phoneNumberRecord.provider}`);
  }

  return { messageSid, from: fromNumber, to, body };
}

/**
 * Send appointment confirmation SMS
 */
export async function sendAppointmentConfirmation(
  tenantId: string,
  phoneNumber: string,
  appointmentDetails: {
    date: string;
    time: string;
    service: string;
    location?: string;
  }
): Promise<any> {
  const { date, time, service, location } = appointmentDetails;

  let body = `Your appointment is confirmed!\n\n`;
  body += `Service: ${service}\n`;
  body += `Date: ${date}\n`;
  body += `Time: ${time}\n`;
  if (location) {
    body += `Location: ${location}\n`;
  }
  body += `\nReply STOP to unsubscribe.`;

  return sendSms({
    tenantId,
    to: phoneNumber,
    body,
  });
}

/**
 * Send order update SMS
 */
export async function sendOrderUpdate(
  tenantId: string,
  phoneNumber: string,
  orderDetails: {
    orderNumber: string;
    status: string;
    trackingUrl?: string;
  }
): Promise<any> {
  const { orderNumber, status, trackingUrl } = orderDetails;

  let body = `Order Update - #${orderNumber}\n\n`;
  body += `Status: ${status}\n`;
  if (trackingUrl) {
    body += `Track: ${trackingUrl}\n`;
  }
  body += `\nReply STOP to unsubscribe.`;

  return sendSms({
    tenantId,
    to: phoneNumber,
    body,
  });
}

/**
 * Send support response SMS
 */
export async function sendSupportResponse(
  tenantId: string,
  phoneNumber: string,
  message: string
): Promise<any> {
  return sendSms({
    tenantId,
    to: phoneNumber,
    body: message,
  });
}
