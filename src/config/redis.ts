// Redis client placeholder config
import { logger } from "./logger.js";

export const redisConfig = {
  host: process.env["REDIS_HOST"] ?? "localhost",
  port: parseInt(process.env["REDIS_PORT"] ?? "6379", 10),
};

logger.info("Redis configuration loaded", { redisConfig });
