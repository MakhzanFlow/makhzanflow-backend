import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../config/env.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
// Production runs behind a pooled connection string (PgBouncer/Neon pool);
// keep per-instance connections small but >1 so concurrent transactions
// and FOR UPDATE locks don't serialize behind a single connection.
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === "production" ? 5 : 10,
  connectionTimeoutMillis: 5000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function testConnection() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function disconnect() {
  await prisma.$disconnect();
}
