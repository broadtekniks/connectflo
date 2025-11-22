import {
  PrismaClient,
  Role,
  ChannelType,
  ConversationStatus,
  MessageSender,
  Sentiment,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding ...");

  // 1. Create Users
  const admin = await prisma.user.upsert({
    where: { email: "admin@connectflo.com" },
    update: {},
    create: {
      email: "admin@connectflo.com",
      name: "Alice Admin",
      role: Role.ADMIN,
      avatar: "https://i.pravatar.cc/150?u=admin",
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@connectflo.com" },
    update: {},
    create: {
      email: "agent@connectflo.com",
      name: "Bob Agent",
      role: Role.AGENT,
      avatar: "https://i.pravatar.cc/150?u=agent",
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      name: "Charlie Customer",
      role: Role.CUSTOMER,
      avatar: "https://i.pravatar.cc/150?u=customer",
    },
  });

  console.log("Created users:", { admin, agent, customer });

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
