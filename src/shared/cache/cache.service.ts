import { injectable } from "tsyringe";
import type { RedisClient } from "../../config/redis.js";
import type { ICacheService } from "./cache.interface.js";

@injectable()
export class CacheService implements ICacheService {
  constructor(private redis: RedisClient) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.set(key, serialized, ttlSeconds ? { ex: ttlSeconds } : undefined);
    } catch {
      // silently fail — cache is best-effort
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // silently fail — cache is best-effort
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return;
      await Promise.all(keys.map((k) => this.redis.del(k)));
    } catch {
      // silently fail — cache is best-effort
    }
  }
}
