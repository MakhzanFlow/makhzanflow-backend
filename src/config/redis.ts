import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger.js";

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

function createUpstashClient(url: string, token: string): UpstashRedis {
  const client = new UpstashRedis({ url, token });
  logger.info("Redis client initialized (Upstash REST)");
  return client;
}

function createLocalClient(): RedisClient {
  const client: RedisClientType = createClient({
    url: `redis://${process.env["REDIS_HOST"] ?? "localhost"}:${parseInt(process.env["REDIS_PORT"] ?? "6379", 10)}`,
  });
  client.on("error", (err) => logger.error("Redis connection error:", err));
  client.connect().catch((err) => logger.error("Redis connect failed:", err));
  logger.info("Redis client initialized (local Docker)");

  return {
    async get(key: string): Promise<string | null> {
      const value = await client.get(key);
      return value === null ? null : String(value);
    },
    async set(key: string, value: string, opts?: { ex?: number }): Promise<unknown> {
      return opts?.ex !== undefined
        ? client.set(key, value, { EX: opts.ex })
        : client.set(key, value);
    },
    async del(key: string): Promise<unknown> {
      return client.del(key);
    },
    async keys(pattern: string): Promise<string[]> {
      return client.keys(pattern);
    },
  };
}

const upstashUrl = process.env["UPSTASH_REDIS_REST_URL"];
const upstashToken = process.env["UPSTASH_REDIS_REST_TOKEN"];

export const redis: RedisClient = upstashUrl && upstashToken
  ? createUpstashClient(upstashUrl, upstashToken)
  : createLocalClient();
