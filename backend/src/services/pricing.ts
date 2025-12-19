import prisma from "../lib/prisma";

export class PricingService {
  /**
   * Calculate retail price using tiered pricing with fallback markup
   * @param wholesaleCost - The cost from Telnyx
   * @param planName - The tenant's plan (STARTER, PRO, ENTERPRISE)
   * @returns Object containing retailPrice and optional pricingTierId
   */
  async calculateRetailPrice(
    wholesaleCost: number,
    planName: string
  ): Promise<{ retailPrice: number; pricingTierId?: string }> {
    // 1. Try to find matching pricing tier
    const tier = await prisma.pricingTier.findFirst({
      where: {
        wholesaleMin: { lte: wholesaleCost },
        wholesaleMax: { gte: wholesaleCost },
        isActive: true,
      },
      orderBy: {
        priority: "desc", // Higher priority first
      },
    });

    // 2. Get plan for discount/markup configuration
    const plan = await prisma.plan.findUnique({
      where: { name: planName },
    });

    if (!plan) {
      // Fallback if plan not found
      return {
        retailPrice: wholesaleCost * 1.5, // 50% default markup
      };
    }

    if (tier) {
      // Use tier price with plan discount
      const basePrice = tier.retailPrice;
      const discountedPrice = basePrice * (1 - plan.pricingDiscount);
      return {
        retailPrice: Number(discountedPrice.toFixed(2)),
        pricingTierId: tier.id,
      };
    }

    // 3. Fallback to markup if no tier matches
    const retailPrice = wholesaleCost * (1 + plan.fallbackMarkup);
    return {
      retailPrice: Number(retailPrice.toFixed(2)),
    };
  }

  /**
   * Get all active pricing tiers
   */
  async getPricingTiers() {
    return prisma.pricingTier.findMany({
      where: { isActive: true },
      orderBy: { priority: "asc" },
    });
  }

  /**
   * Get plan pricing configuration
   */
  async getPlanPricing(planName: string) {
    return prisma.plan.findUnique({
      where: { name: planName },
      select: {
        name: true,
        pricingDiscount: true,
        fallbackMarkup: true,
      },
    });
  }
}
