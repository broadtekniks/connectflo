const Telnyx = require("telnyx");
const axios = require("axios");

const apiKey = process.env.TELNYX_API_KEY;

// Initialize Telnyx only if API key is present
const telnyx = apiKey ? Telnyx(apiKey) : null;

export class TelnyxService {
  async searchNumbers(
    countryCode: string,
    region?: string,
    features?: string[]
  ) {
    if (!telnyx) throw new Error("Telnyx API key not configured");

    try {
      const params: any = {
        filter: {
          country_code: countryCode,
          features: features,
          limit: 10,
          best_effort: true,
        },
      };

      if (region) {
        // Check if input looks like an area code (3 digits)
        if (/^\d{3}$/.test(region)) {
          params.filter.national_destination_code = region;
        } else {
          // Otherwise treat as locality/city
          params.filter.locality = region;
        }
      }

      const availableNumbers = await telnyx.availablePhoneNumbers.list(params);
      return availableNumbers.data;
    } catch (error) {
      console.error("Telnyx Search Error:", error);
      throw error;
    }
  }

  async purchaseNumber(phoneNumber: string) {
    if (!telnyx) throw new Error("Telnyx API key not configured");

    try {
      // 1. Purchase
      const order = await telnyx.numberOrders.create({
        phone_numbers: [{ phone_number: phoneNumber }],
      });

      // 2. Configure (Best Effort)
      try {
        const app = await this.ensureCallControlApplication();
        if (app) {
          // Wait a moment for provisioning
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Find the number resource to get its ID
          const numbers = await telnyx.phoneNumbers.list({
            filter: { phone_number: phoneNumber },
          });

          if (numbers.data && numbers.data.length > 0) {
            const numId = numbers.data[0].id;
            await telnyx.phoneNumbers.update(numId, {
              connection_id: app.id,
            });
            console.log(
              `Configured ${phoneNumber} with App ${app.application_name}`
            );
          }
        }

        // Configure messaging profile for SMS
        const messagingProfile = await this.ensureMessagingProfile();
        if (messagingProfile && numbers.data && numbers.data.length > 0) {
          try {
            await telnyx.messagingPhoneNumbers.create({
              phone_number: phoneNumber,
              messaging_profile_id: messagingProfile.id,
            });
            console.log(
              `Configured ${phoneNumber} with messaging profile ${messagingProfile.name}`
            );
          } catch (msgError) {
            console.error("Failed to add to messaging profile:", msgError);
          }
        }
      } catch (configError) {
        console.error(
          "Failed to configure number after purchase:",
          configError
        );
        // Don't fail the purchase if config fails
      }

      return order.data;
    } catch (error) {
      console.error("Telnyx Purchase Error:", error);
      throw error;
    }
  }

  async ensureCallControlApplication() {
    if (!telnyx) return null;
    const appName = "ConnectFlo";
    // Use ngrok or configured URL
    const webhookUrl =
      process.env.TELNYX_WEBHOOK_URL || "http://localhost:3002/webhooks/telnyx";

    try {
      const apps = await telnyx.callControlApplications.list({
        filter: { application_name: appName },
      });

      if (apps.data && apps.data.length > 0) {
        const existingApp = apps.data[0];
        // Update webhook URL if it changed
        if (existingApp.webhook_event_url !== webhookUrl) {
          await telnyx.callControlApplications.update(existingApp.id, {
            webhook_event_url: webhookUrl,
            webhook_event_failover_url: webhookUrl,
          });
        }
        return existingApp;
      }

      const newApp = await telnyx.callControlApplications.create({
        application_name: appName,
        webhook_event_url: webhookUrl,
        webhook_event_failover_url: webhookUrl,
        webhook_api_version: "2",
      });
      return newApp.data;
    } catch (error) {
      console.error("Failed to ensure Call Control App:", error);
      return null;
    }
  }

  async ensureMessagingProfile() {
    if (!telnyx) return null;
    const profileName = "ConnectFlo SMS";
    const smsWebhookUrl =
      process.env.TELNYX_SMS_WEBHOOK_URL || 
      "http://localhost:3002/webhooks/telnyx/sms";

    try {
      const profiles = await telnyx.messagingProfiles.list();

      if (profiles.data && profiles.data.length > 0) {
        const existing = profiles.data.find((p: any) => p.name === profileName);
        if (existing) {
          // Update webhook URL if changed
          if (existing.webhook_url !== smsWebhookUrl) {
            await telnyx.messagingProfiles.update(existing.id, {
              webhook_url: smsWebhookUrl,
              webhook_failover_url: smsWebhookUrl,
            });
          }
          return existing;
        }
      }

      const newProfile = await telnyx.messagingProfiles.create({
        name: profileName,
        webhook_url: smsWebhookUrl,
        webhook_failover_url: smsWebhookUrl,
        webhook_api_version: "2",
      });
      return newProfile.data;
    } catch (error) {
      console.error("Failed to ensure Messaging Profile:", error);
      return null;
    }
  }

  async answerCall(callControlId: string) {
    if (!telnyx) return;
    try {
      await telnyx.calls.actions.answer(callControlId);
    } catch (error) {
      console.error("Failed to answer call:", error);
    }
  }

  async speakText(
    callControlId: string,
    text: string,
    voice: string = "female",
    language: string = "en-US"
  ) {
    if (!telnyx) return;
    try {
      await telnyx.calls.actions.speak(callControlId, {
        payload: text,
        voice: voice,
        language: language,
      });
    } catch (error) {
      console.error("Failed to speak text:", error);
    }
  }

  async startTranscription(callControlId: string) {
    if (!telnyx) return;
    try {
      await telnyx.calls.actions.startTranscription(callControlId, {
        transcription_engine: "Telnyx",
        transcription_engine_config: {
          language: "en",
        },
      });
    } catch (error) {
      console.error("Failed to start transcription:", error);
    }
  }

  async stopTranscription(callControlId: string) {
    if (!telnyx) return;
    try {
      await telnyx.calls.actions.stopTranscription(callControlId);
    } catch (error) {
      console.error("Failed to stop transcription:", error);
    }
  }

  async listOwnedNumbers() {
    if (!telnyx) throw new Error("Telnyx API key not configured");

    try {
      const response = await telnyx.phoneNumbers.list();
      return response.data;
    } catch (error) {
      console.error("Failed to list Telnyx numbers:", error);
      throw error;
    }
  }

  async getNumberDetails(phoneNumber: string) {
    if (!telnyx) throw new Error("Telnyx API key not configured");

    try {
      const numbers = await telnyx.phoneNumbers.list({
        filter: { phone_number: phoneNumber },
      });

      if (numbers.data && numbers.data.length > 0) {
        return numbers.data[0];
      }
      return null;
    } catch (error) {
      console.error("Failed to get number details:", error);
      throw error;
    }
  }

  async makeTestCall(fromNumber: string, toNumber: string) {
    if (!apiKey) throw new Error("Telnyx API key not configured");

    try {
      // Use direct REST API call for voice calls
      const response = await axios.post(
        "https://api.telnyx.com/v2/calls",
        {
          connection_id: process.env.TELNYX_CONNECTION_ID,
          to: toNumber,
          from: fromNumber,
          webhook_url:
            process.env.TELNYX_WEBHOOK_URL ||
            "http://localhost:3002/webhooks/telnyx",
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error: any) {
      throw error;
    }
  }

  async sendTestSMS(fromNumber: string, toNumber: string, message: string) {
    if (!apiKey) throw new Error("Telnyx API key not configured");

    try {
      // Use direct REST API call since SDK methods vary
      // Note: Telnyx requires messaging_profile_id for SMS
      const response = await axios.post(
        "https://api.telnyx.com/v2/messages",
        {
          from: fromNumber,
          to: toNumber,
          text: message,
          messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
          webhook_url:
            process.env.TELNYX_WEBHOOK_URL ||
            "http://localhost:3002/webhooks/telnyx",
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Start media streaming for a call
   * This enables real-time audio streaming to a WebSocket endpoint
   */
  async startMediaStreaming(
    callControlId: string,
    streamUrl: string
  ): Promise<void> {
    if (!telnyx) throw new Error("Telnyx API key not configured");

    try {
      await telnyx.calls.actions.startStreaming(callControlId, {
        stream_url: streamUrl,
        stream_track: "both_tracks", // inbound and outbound audio
      });
      console.log(
        `Started media streaming for call ${callControlId} to ${streamUrl}`
      );
    } catch (error) {
      console.error("Failed to start media streaming:", error);
      throw error;
    }
  }

  /**
   * Stop media streaming for a call
   */
  async stopMediaStreaming(callControlId: string): Promise<void> {
    if (!telnyx) throw new Error("Telnyx API key not configured");

    try {
      await telnyx.calls.actions.stopStreaming(callControlId);
      console.log(`Stopped media streaming for call ${callControlId}`);
    } catch (error) {
      console.error("Failed to stop media streaming:", error);
      throw error;
    }
  }

  /**
   * Hangup a call
   */
  async hangupCall(callControlId: string): Promise<void> {
    if (!telnyx) return;
    try {
      await telnyx.calls.actions.hangup(callControlId);
      console.log(`Hung up call ${callControlId}`);
    } catch (error) {
      console.error("Failed to hangup call:", error);
    }
  }
}
