import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { testConnection, disconnect } from "./db.js";

const app = express();
const PORT = process.env["PORT"] || 3000;

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/db-test", async (_req, res) => {
  const connected = await testConnection();
  if (connected) {
    res.json({ status: "ok", message: "Database connection successful" });
  } else {
    res.status(500).json({ status: "error", message: "Database connection failed" });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await disconnect();
  server.close(() => process.exit(0));
});
