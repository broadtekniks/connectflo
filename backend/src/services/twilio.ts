import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Initialize Twilio only if credentials are present
const twilioClient =
  accountSid && authToken ? twilio(accountSid, authToken) : null;

function deriveStatusCallbackUrl(voiceWebhookUrl: string): string {
  const url = (voiceWebhookUrl || "").trim();
  if (!url) return "";

  // Most deployments set voiceUrl to .../webhooks/twilio/voice
  if (url.endsWith("/voice")) return url.replace(/\/voice$/, "/status");

  // If it already looks like a status endpoint, keep it.
  if (url.endsWith("/status")) return url;

  // Otherwise append.
  return url.endsWith("/") ? `${url}status` : `${url}/status`;
}

export class TwilioService {
  /**
   * Search available phone numbers
   */
  async searchNumbers(countryCode: string = "US", region?: string) {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    try {
      const params: any = {
        limit: 10,
      };

      // Check if region looks like an area code (3 digits)
      if (region && /^\d{3}$/.test(region)) {
        params.areaCode = parseInt(region);
      } else if (region) {
        // Otherwise use as city/region name
        params.inLocality = region;
      }

      const numbers = await twilioClient
        .availablePhoneNumbers(countryCode)
        .local.list(params);

      return numbers.map((number) => ({
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        locality: number.locality,
        region: number.region,
        postalCode: number.postalCode,
        isoCountry: number.isoCountry,
        capabilities: number.capabilities,
        monthlyPrice: 1.15, // Twilio US local number pricing
      }));
    } catch (error) {
      console.error("Twilio Search Error:", error);
      throw error;
    }
  }

  /**
   * Purchase a phone number
   */
  async purchaseNumber(
    phoneNumber: string,
    voiceWebhookUrl?: string,
    smsWebhookUrl?: string
  ) {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    try {
      const voiceUrl = voiceWebhookUrl || process.env.TWILIO_WEBHOOK_URL || "";
      const smsUrl = smsWebhookUrl || voiceUrl;
      const statusCallback = deriveStatusCallbackUrl(voiceUrl);
      const purchased = await twilioClient.incomingPhoneNumbers.create({
        phoneNumber: phoneNumber,
        voiceUrl,
        voiceMethod: "POST",
        smsUrl,
        smsMethod: "POST",
        statusCallback,
        statusCallbackMethod: "POST",
      });

      // Optionally add to messaging service for A2P 10DLC
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
        try {
          await twilioClient.messaging.v1
            .services(process.env.TWILIO_MESSAGING_SERVICE_SID)
            .phoneNumbers.create({ phoneNumberSid: purchased.sid });
          console.log(`[Twilio] Added ${phoneNumber} to messaging service`);
        } catch (err) {
          console.error("[Twilio] Failed to add to messaging service:", err);
        }
      }

      return purchased;
    } catch (error) {
      console.error("Twilio Purchase Error:", error);
      throw error;
    }
  }

  /**
   * List owned phone numbers
   */
  async listOwnedNumbers() {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    try {
      const numbers = await twilioClient.incomingPhoneNumbers.list();
      return numbers.map((number) => ({
        sid: number.sid,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        capabilities: number.capabilities,
        voiceUrl: number.voiceUrl,
        smsUrl: number.smsUrl,
      }));
    } catch (error) {
      console.error("Failed to list Twilio numbers:", error);
      throw error;
    }
  }

  /**
   * Get details for a specific phone number
   */
  async getNumberDetails(phoneNumber: string) {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    try {
      const numbers = await twilioClient.incomingPhoneNumbers.list({
        phoneNumber: phoneNumber,
      });

      if (numbers.length > 0) {
        return numbers[0];
      }
      return null;
    } catch (error) {
      console.error("Failed to get Twilio number details:", error);
      throw error;
    }
  }

  /**
   * Update phone number webhook URLs
   */
  async updateNumberWebhook(numberSid: string, webhookUrl: string) {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    try {
      await twilioClient.incomingPhoneNumbers(numberSid).update({
        voiceUrl: webhookUrl,
        voiceMethod: "POST",
        smsUrl: webhookUrl,
        smsMethod: "POST",
        statusCallback: deriveStatusCallbackUrl(webhookUrl),
        statusCallbackMethod: "POST",
      });
      console.log(`Updated webhook for ${numberSid} to ${webhookUrl}`);
    } catch (error) {
      console.error("Failed to update webhook:", error);
      throw error;
    }
  }

  /**
   * Make an outbound call
   */
  async makeCall(from: string, to: string, webhookUrl: string) {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    try {
      const call = await twilioClient.calls.create({
        from: from,
        to: to,
        url: webhookUrl,
        method: "POST",
      });

      return call;
    } catch (error) {
      console.error("Failed to make call:", error);
      throw error;
    }
  }

  /**
   * Send SMS
   * Note: For US numbers, A2P 10DLC registration is required.
   * Use messagingServiceSid if configured to avoid 30034 errors.
   */
  async sendSMS(from: string, to: string, body: string) {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    try {
      const messageParams: any = {
        to: to,
        body: body,
      };

      // Use Messaging Service SID if configured (required for A2P 10DLC)
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
        messageParams.messagingServiceSid =
          process.env.TWILIO_MESSAGING_SERVICE_SID;
      } else {
        messageParams.from = from;
      }

      const message = await twilioClient.messages.create(messageParams);

      return message;
    } catch (error) {
      console.error("Failed to send SMS:", error);
      throw error;
    }
  }

  /**
   * End an active call
   * Best practice: update the Call resource status to "completed".
   */
  async endCall(callSid: string) {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    try {
      await twilioClient.calls(callSid).update({ status: "completed" });
      console.log(`Ended Twilio call ${callSid}`);
    } catch (error) {
      console.error(`Failed to end Twilio call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Update an active call by providing TwiML.
   * This is useful for mid-call actions like transfers.
   */
  async updateCallTwiml(callSid: string, twiml: string) {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    const payload = String(twiml || "").trim();
    if (!payload) throw new Error("Missing TwiML payload");

    try {
      await twilioClient.calls(callSid).update({ twiml: payload });
      console.log(`[Twilio] Updated call ${callSid} with TwiML`);
    } catch (error) {
      console.error(`Failed to update TwiML for call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Release/delete a phone number
   */
  async releaseNumber(numberSid: string) {
    if (!twilioClient) throw new Error("Twilio credentials not configured");

    try {
      await twilioClient.incomingPhoneNumbers(numberSid).remove();
      console.log(`Released Twilio number ${numberSid}`);
    } catch (error) {
      console.error("Failed to release number:", error);
      throw error;
    }
  }
}
