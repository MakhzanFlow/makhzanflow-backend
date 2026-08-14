import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { upstashRateLimit } from "./middleware/upstash-rate-limit.middleware.js";
import { i18next, i18nMiddleware } from "./config/i18n.js";

const REDACTED_KEYS = /token|password|secret|authorization|credit.?card/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        REDACTED_KEYS.test(key) ? "[REDACTED]" : redact(val, depth + 1),
      ]),
    );
  }
  return value;
}

function captureResponseBody(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    (res as Response & { locals: Record<string, unknown> }).locals.responseBody = body;
    return originalJson(body);
  }) as typeof res.json;
  next();
}

const app = express();

app.use(cors());
app.use((helmet as any)());
app.use(captureResponseBody);
app.use(
  morgan((tokens, req, res) => {
    const status = tokens.status?.(req, res);
    const responseTime = tokens["response-time"]?.(req, res);
    const body = (res as Response & { locals: Record<string, unknown> }).locals
      .responseBody;
    const bodyLog =
      body !== undefined ? ` body=${JSON.stringify(redact(body))}` : "";
    return `${tokens.method?.(req, res)} ${tokens.url?.(req, res)} ${status} - ${responseTime} ms${bodyLog}`;
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(i18nMiddleware.handle(i18next as any));

app.use("/api", upstashRateLimit);
app.use("/api", routes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(errorHandler);

export default app;
