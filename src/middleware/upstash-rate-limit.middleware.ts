import type { NextFunction, Request, Response } from "express";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis as UpstashRedis } from "@upstash/redis";
import { logger } from "../config/logger.js";
import { getRedisConfig } from "../config/redis.js";
import { env } from "../config/env.js";

const { upstashUrl, upstashToken } = getRedisConfig();

let ratelimit: Ratelimit | null = null;

if (upstashUrl && upstashToken) {
  ratelimit = new Ratelimit({
    redis: new UpstashRedis({ url: upstashUrl, token: upstashToken }),
    limiter: Ratelimit.slidingWindow(100, "15 m"),
    analytics: true,
    prefix: "rl:api",
  });
  logger.info("Upstash rate limiter initialized (100 req / 15 min per IP)");
} else {
  logger.warn("Upstash rate limiter disabled (credentials not configured) — global throttle inactive");
}

export async function upstashRateLimit(req: Request, res: Response, next: NextFunction) {
  // Test hook: integration/E2E suites set DISABLE_RATE_LIMIT=1 so a single
  // runner IP is not throttled by the shared 100 req / 15 min window.
  // The flag is honored only outside production — it never disables limits in prod.
  if (env.DISABLE_RATE_LIMIT === "1" && env.NODE_ENV !== "production") {
    next();
    return;
  }
  if (!ratelimit) {
    next();
    return;
  }

  const identifier = req.ip ?? "unknown";
  try {
    const { success, limit, remaining, reset } = await ratelimit.limit(identifier);
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(reset));

    if (!success) {
      res.status(429).json({
        success: false,
        message: "Too many requests, please try again later",
        errors: [],
      });
      return;
    }
  } catch (err) {
    logger.error("Upstash rate limit check failed:", err);
  }
  next();
}
