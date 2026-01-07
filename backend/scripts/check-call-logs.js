const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkCallLogs() {
  try {
    const count = await prisma.callLog.count();
    console.log(`Total call logs in database: ${count}`);

    if (count > 0) {
      const recentLogs = await prisma.callLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: { id: true, name: true, email: true, phoneNumber: true },
          },
          phoneNumber: {
            select: { id: true, number: true },
          },
        },
      });

      console.log("\nRecent call logs:");
      recentLogs.forEach((log) => {
        console.log(
          `- ${log.direction} call: ${log.from} -> ${log.to} (${log.status})`
        );
      });
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCallLogs();
