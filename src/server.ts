import app from "./app.js";
import { env } from "./config/env.js";
import { disconnect, testConnection } from "./database/prisma.js";
import { logger } from "./config/logger.js";

const PORT = env.PORT || 3000;

async function bootstrap() {
  const connected = await testConnection();
  if (connected) {
    logger.info("Database connection successful");
  } else {
    logger.error("Database connection failed");
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  process.on("SIGINT", async () => {
    logger.info("\nShutting down gracefully...");
    await disconnect();
    server.close(() => process.exit(0));
  });
}

bootstrap();
