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
    console.log("Telnyx Available Numbers:", JSON.stringify(availableNumbers.data, null, 2));
      return availableNumbers.data;
    } catch (error) {
      console.error("Telnyx Search Error:", error);
      throw error;
    }
  }

  async purchaseNumber(phoneNumber: string) {
    if (!telnyx) throw new Error("Telnyx API key not configured");

    try {
      const order = await telnyx.numberOrders.create({
        phone_numbers: [{ phone_number: phoneNumber }],
      });
      return order.data;
    } catch (error) {
      console.error("Telnyx Purchase Error:", error);
      throw error;
    }
  }
}
