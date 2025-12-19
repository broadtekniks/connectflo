import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";

import {
  PrismaClient,
  Role,
  ChannelType,
  ConversationStatus,
  MessageSender,
  Sentiment,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Start seeding ...");
  const password = await bcrypt.hash("password123", 10);

  // -1. Create Plans
  await prisma.plan.upsert({
    where: { name: "STARTER" },
    update: {
      documentLimit: 5,
      docSizeLimitMB: 5,
      pricingDiscount: 0.0, // No discount
      fallbackMarkup: 0.5, // 50% markup
    },
    create: {
      name: "STARTER",
      documentLimit: 5,
      docSizeLimitMB: 5,
      pricingDiscount: 0.0,
      fallbackMarkup: 0.5,
    },
  });
  await prisma.plan.upsert({
    where: { name: "PRO" },
    update: {
      documentLimit: 20,
      docSizeLimitMB: 20,
      pricingDiscount: 0.1, // 10% off tiers
      fallbackMarkup: 0.3, // 30% markup
    },
    create: {
      name: "PRO",
      documentLimit: 20,
      docSizeLimitMB: 20,
      pricingDiscount: 0.1,
      fallbackMarkup: 0.3,
    },
  });
  await prisma.plan.upsert({
    where: { name: "ENTERPRISE" },
    update: {
      documentLimit: 100,
      docSizeLimitMB: 50,
      pricingDiscount: 0.2, // 20% off tiers
      fallbackMarkup: 0.2, // 20% markup
    },
    create: {
      name: "ENTERPRISE",
      documentLimit: 100,
      docSizeLimitMB: 50,
      pricingDiscount: 0.2,
      fallbackMarkup: 0.2,
    },
  });

  // -0.5 Create Pricing Tiers
  await prisma.pricingTier.upsert({
    where: { id: "basic-local-tier" },
    update: {
      name: "Basic Local",
      description: "Standard local numbers",
      wholesaleMin: 0.5,
      wholesaleMax: 1.5,
      retailPrice: 2.5,
      priority: 1,
    },
    create: {
      id: "basic-local-tier",
      name: "Basic Local",
      description: "Standard local numbers",
      wholesaleMin: 0.5,
      wholesaleMax: 1.5,
      retailPrice: 2.5,
      priority: 1,
    },
  });

  await prisma.pricingTier.upsert({
    where: { id: "premium-local-tier" },
    update: {
      name: "Premium Local",
      description: "Premium local numbers with better availability",
      wholesaleMin: 1.51,
      wholesaleMax: 3.0,
      retailPrice: 5.0,
      priority: 2,
    },
    create: {
      id: "premium-local-tier",
      name: "Premium Local",
      description: "Premium local numbers with better availability",
      wholesaleMin: 1.51,
      wholesaleMax: 3.0,
      retailPrice: 5.0,
      priority: 2,
    },
  });

  await prisma.pricingTier.upsert({
    where: { id: "toll-free-tier" },
    update: {
      name: "Toll-Free",
      description: "Toll-free numbers (800, 888, etc.)",
      wholesaleMin: 2.0,
      wholesaleMax: 5.0,
      retailPrice: 7.5,
      priority: 3,
    },
    create: {
      id: "toll-free-tier",
      name: "Toll-Free",
      description: "Toll-free numbers (800, 888, etc.)",
      wholesaleMin: 2.0,
      wholesaleMax: 5.0,
      retailPrice: 7.5,
      priority: 3,
    },
  });

  await prisma.pricingTier.upsert({
    where: { id: "international-tier" },
    update: {
      name: "International",
      description: "International numbers",
      wholesaleMin: 3.0,
      wholesaleMax: 10.0,
      retailPrice: 12.0,
      priority: 4,
    },
    create: {
      id: "international-tier",
      name: "International",
      description: "International numbers",
      wholesaleMin: 3.0,
      wholesaleMax: 10.0,
      retailPrice: 12.0,
      priority: 4,
    },
  });

  console.log("Created pricing tiers");

  // 0. Create Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "acme-corp" },
    update: {},
    create: {
      name: "Acme Corp",
      slug: "acme-corp",
      plan: "ENTERPRISE",
      status: "ACTIVE",
    },
  });

  // 1. Create Users
  const admin = await prisma.user.upsert({
    where: { email: "admin@connectflo.com" },
    update: {
      password,
    },
    create: {
      email: "admin@connectflo.com",
      password,
      name: "Alice Admin",
      role: Role.SUPER_ADMIN,
      avatar: "https://i.pravatar.cc/150?u=admin",
      tenantId: tenant.id,
    },
  });

  const tenantAdmin = await prisma.user.upsert({
    where: { email: "manager@connectflo.com" },
    update: { password },
    create: {
      email: "manager@connectflo.com",
      password,
      name: "Tom Tenant Admin",
      role: Role.TENANT_ADMIN,
      avatar: "https://i.pravatar.cc/150?u=manager",
      tenantId: tenant.id,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@connectflo.com" },
    update: { password },
    create: {
      email: "agent@connectflo.com",
      password,
      name: "Bob Agent",
      role: Role.AGENT,
      avatar: "https://i.pravatar.cc/150?u=agent",
      tenantId: tenant.id,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: { password },
    create: {
      email: "customer@example.com",
      password,
      name: "Charlie Customer",
      role: Role.CUSTOMER,
      avatar: "https://i.pravatar.cc/150?u=customer",
      tenantId: tenant.id,
    },
  });

  console.log("Created users:", { admin, tenantAdmin, agent, customer });

  // 2. Create Conversations
  const conversation1 = await prisma.conversation.create({
    data: {
      channel: ChannelType.CHAT,
      status: ConversationStatus.OPEN,
      subject: "Issue with billing",
      priority: "HIGH",
      sentiment: Sentiment.NEGATIVE,
      tags: ["billing", "urgent"],
      customerId: customer.id,
      assigneeId: agent.id,
      messages: {
        create: [
          {
            content: "Hi, I was charged twice for my subscription.",
            sender: MessageSender.CUSTOMER,
          },
          {
            content:
              "I apologize for the inconvenience. Let me check that for you.",
            sender: MessageSender.AGENT,
          },
        ],
      },
    },
  });

  const conversation2 = await prisma.conversation.create({
    data: {
      channel: ChannelType.EMAIL,
      status: ConversationStatus.PENDING,
      subject: "Feature request",
      priority: "LOW",
      sentiment: Sentiment.NEUTRAL,
      tags: ["feature-request"],
      customerId: customer.id,
      messages: {
        create: [
          {
            content: "It would be great if you had a dark mode.",
            sender: MessageSender.CUSTOMER,
          },
        ],
      },
    },
  });

  console.log("Created conversations:", { conversation1, conversation2 });

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
