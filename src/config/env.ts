import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().optional(),
  APP_NAME: z.string().default("MakhzanFlow"),
  BREVO_SMTP_HOST: z.string().default("smtp-relay.brevo.com"),
  BREVO_SMTP_PORT: z.coerce.number().int().positive().default(587),
  BREVO_SMTP_USER: z.string().min(1),
  BREVO_SMTP_PASS: z.string().min(1),
  EMAIL_FROM: z.string().email().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  CLOUDINARY_COMPANY_LOGOS_FOLDER: z.string().default("company_logos"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;
