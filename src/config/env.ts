import dotenv from "dotenv";

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env",
});

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().optional(),
  APP_NAME: z.string().default("MakhzanFlow"),
  EMAIL_FROM: z.string().min(1).default("Acme <onboarding@vibi.social>"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  CLOUDINARY_COMPANY_LOGOS_FOLDER: z.string().default("company_logos"),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  DISABLE_RATE_LIMIT: z.enum(["0", "1"]).optional().default("0"),
  FRONTEND_URL: z.string().url().default("https://makhzanflow-web.vercel.app"),
}).superRefine((val, ctx) => {
  const hasUrl = !!val.UPSTASH_REDIS_REST_URL;
  const hasToken = !!val.UPSTASH_REDIS_REST_TOKEN;
  if (hasUrl !== hasToken) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together",
      path: ["UPSTASH_REDIS_REST_URL"],
    });
  }
  if (val.NODE_ENV === "production" && !hasUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "UPSTASH_REDIS_REST_URL/TOKEN are required in production (no in-memory cache fallback)",
      path: ["UPSTASH_REDIS_REST_URL"],
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

if (parsed.data.JWT_SECRET === parsed.data.JWT_REFRESH_SECRET) {
  throw new Error('Invalid environment configuration: JWT_SECRET and JWT_REFRESH_SECRET must be different values');
}

export const env = parsed.data;
