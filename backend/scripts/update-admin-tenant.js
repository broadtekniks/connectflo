require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "admin@connectflo.com";
  const targetTenantId = "00000000-0000-0000-0000-000000000001";

  const before = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, tenantId: true },
  });

  console.log("BEFORE", before);

  const after = await prisma.user.update({
    where: { email },
    data: { tenantId: targetTenantId },
    select: { id: true, email: true, role: true, tenantId: true },
  });

  console.log("AFTER", after);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
