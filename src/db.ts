import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

async function testConnection() {
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
    console.log("Database connected successfully at:", (result as { current_time: Date }[])[0]!.current_time);
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

async function disconnect() {
  await prisma.$disconnect();
}

export { prisma, testConnection, disconnect };
