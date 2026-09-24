import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger.js";
import { env } from "./env.js";

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

export function getRedisConfig() {
  return {
    upstashUrl: env.UPSTASH_REDIS_REST_URL,
    upstashToken: env.UPSTASH_REDIS_REST_TOKEN,
    redisHost: env.REDIS_HOST,
    redisPort: env.REDIS_PORT,
    nodeEnv: env.NODE_ENV,
  };
}

function createUpstashClient(url: string, token: string): RedisClient {
  const client = new UpstashRedis({ url, token });
  logger.info("Redis client initialized (Upstash REST)");
  const upstash = client as unknown as RedisClient;
  return {
    get: (key) => upstash.get(key),
    set: (key, value, opts) => upstash.set(key, value, opts),
    del: (key) => upstash.del(key),
    keys: (pattern) => upstash.keys(pattern),
  };
}

let localClient: RedisClientType | null = null;

function createLocalClient(): RedisClient {
  const client: RedisClientType = createClient({
    url: `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`,
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
      if (pattern === "*") {
        return client.keys(pattern);
      }
      // Prefer SCAN over KEYS to avoid blocking the server.
      const matched = new Set<string>();
      let cursor = "0";
      do {
        const result = await (client as any).scan(cursor, { MATCH: pattern, COUNT: 200 });
        const nextCursor = Array.isArray(result) ? String(result[0]) : String((result as any)?.cursor ?? "0");
        const batch: string[] = Array.isArray(result) ? result[1] ?? [] : (result as any)?.keys ?? [];
        for (const key of batch) matched.add(key);
        cursor = nextCursor;
      } while (cursor !== "0");
      return [...matched];
    },
  };
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

export function createMemoryClient(): RedisClient {
  if (env.NODE_ENV === "production") {
    throw new Error("In-memory cache is not allowed in production. Configure UPSTASH_REDIS_REST_URL/TOKEN.");
  }
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
      const re = globToRegExp(pattern);
      const validKeys: string[] = [];
      for (const [key, item] of store.entries()) {
        if (item.expiresAt && now > item.expiresAt) {
          store.delete(key);
          continue;
        }
        if (re.test(key)) {
          validKeys.push(key);
        }
      }
      return validKeys;
    },
  };
}

const upstashUrl = env.UPSTASH_REDIS_REST_URL;
const upstashToken = env.UPSTASH_REDIS_REST_TOKEN;

if (env.NODE_ENV === "production" && (!upstashUrl || !upstashToken)) {
  throw new Error("UPSTASH_REDIS_REST_URL/TOKEN are required in production (no in-memory cache fallback).");
}

export const redis: RedisClient = upstashUrl && upstashToken
  ? createUpstashClient(upstashUrl, upstashToken)
  : createLocalClient();

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
