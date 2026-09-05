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

let localClient: RedisClientType | null = null;

function createLocalClient(): RedisClient {
  const client: RedisClientType = createClient({
    url: `redis://${process.env["REDIS_HOST"] ?? "localhost"}:${parseInt(process.env["REDIS_PORT"] ?? "6379", 10)}`,
  });
  localClient = client;
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

function createMemoryClient(): RedisClient {
  const store = new Map<string, { value: string; expiresAt?: number | undefined }>();
  logger.warn("Redis client falling back to in-memory store (Upstash credentials not configured)");

  return {
    async get(key: string): Promise<string | null> {
      const item = store.get(key);
      if (!item) return null;
      if (item.expiresAt !== undefined && Date.now() > item.expiresAt) {
        store.delete(key);
        return null;
      }
      return item.value;
    },
    async set(key: string, value: string, opts?: { ex?: number }): Promise<unknown> {
      const expiresAt = opts?.ex !== undefined ? Date.now() + opts.ex * 1000 : undefined;
      store.set(key, { value, expiresAt });
      return "OK";
    },
    async del(key: string): Promise<unknown> {
      return store.delete(key) ? 1 : 0;
    },
    async keys(pattern: string): Promise<string[]> {
      const now = Date.now();
      const validKeys: string[] = [];
      for (const [key, item] of store.entries()) {
        if (item.expiresAt && now > item.expiresAt) {
          store.delete(key);
          continue;
        }
        if (pattern === "*" || key.startsWith(pattern.replace("*", ""))) {
          validKeys.push(key);
        }
      }
      return validKeys;
    },
  };
}

const upstashUrl = process.env["UPSTASH_REDIS_REST_URL"];
const upstashToken = process.env["UPSTASH_REDIS_REST_TOKEN"];

export const redis: RedisClient = upstashUrl && upstashToken
  ? createUpstashClient(upstashUrl, upstashToken)
  : (process.env["NODE_ENV"] === "production" ? createMemoryClient() : createLocalClient());

/**
 * Closes the underlying local node-redis connection when one exists.
 * No-op for Upstash REST and in-memory clients. Intended for test teardown
 * so an idle reconnect loop never keeps the process alive.
 */
export async function disconnectRedis(): Promise<void> {
  if (localClient) {
    try {
      await localClient.quit();
    } catch {
      // ignore — shutting down anyway
    } finally {
      localClient = null;
    }
  }
}
