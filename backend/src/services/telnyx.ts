const Telnyx = require("telnyx");

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
      console.log(
        "Telnyx Available Numbers:",
        JSON.stringify(availableNumbers.data, null, 2)
      );
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
          console.log(`Updated Telnyx App Webhook URL to: ${webhookUrl}`);
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

  async answerCall(callControlId: string) {
    if (!telnyx) return;
    try {
      await telnyx.calls.actions.answer(callControlId);
    } catch (error) {
      console.error("Failed to answer call:", error);
    }
  }

  async speakText(callControlId: string, text: string) {
    if (!telnyx) return;
    try {
      await telnyx.calls.actions.speak(callControlId, {
        payload: text,
        voice: "female",
        language: "en-US",
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
      console.log(`Started transcription for call ${callControlId}`);
    } catch (error) {
      console.error("Failed to start transcription:", error);
    }
  }

  async stopTranscription(callControlId: string) {
    if (!telnyx) return;
    try {
      await telnyx.calls.actions.stopTranscription(callControlId);
      console.log(`Stopped transcription for call ${callControlId}`);
    } catch (error) {
      console.error("Failed to stop transcription:", error);
    }
  }
}
