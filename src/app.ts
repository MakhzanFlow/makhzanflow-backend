import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { AppError } from "./shared/errors/app-error.js";
import { upstashRateLimit } from "./middleware/upstash-rate-limit.middleware.js";
import { i18next, i18nMiddleware } from "./config/i18n.js";
import { env } from "./config/env.js";

const app = express();

app.use(cors({ origin: [env.FRONTEND_URL], credentials: false }));
app.use((helmet as any)());
morgan.token("redacted-url", (req: any) => {
  try {
    const url = req.originalUrl || req.url || "";
    return String(url).replace(/(code|token)=[^&]*/gi, "$1=[REDACTED]");
  } catch {
    return String(req?.url ?? "");
  }
});
app.use(morgan(":method :redacted-url :status :res[content-length] - :response-time ms"));
app.use(express.json({ limit: "10mb" }));
app.use(i18nMiddleware.handle(i18next as any));

app.use("/api", upstashRateLimit);
app.use("/api", routes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get(["/", "/web"], (_req, res) => {
  res.redirect(env.FRONTEND_URL);
});

// 404 handler — must come before errorHandler
app.use((_req, _res, next) => {
  next(new AppError(404, "Not Found", "errors.notFound"));
});

app.use(errorHandler);

export default app;
