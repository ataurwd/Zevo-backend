import http from "http";
import { app } from "./app";
import { logger } from "./infrastructure/logger";
import { connectDB, closeDB } from "./infrastructure/db/client";
import { getRedisClient, closeRedis } from "./infrastructure/redis/client";

const PORT = parseInt(process.env.PORT || "5000", 10);

async function bootstrap(): Promise<void> {
  try {
    // Attempt connections to infrastructure dependencies
    // (If running outside Docker for tests or dev, connection failure logs a warning without crashing if desired)
    try {
      await connectDB(3, 1000);
    } catch (err) {
      logger.warn({ err }, "Initial MongoDB connection failed. Will retry on demand.");
    }

    try {
      getRedisClient();
    } catch (err) {
      logger.warn({ err }, "Initial Redis connection failed. Will retry on demand.");
    }

    const server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`🚀 NEXORA API server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
      logger.info(`Health check available at http://localhost:${PORT}/api/v1/health/live`);
    });

    // Graceful Shutdown Management
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      // 1. Stop receiving new requests
      server.close(async () => {
        logger.info("HTTP server closed.");

        // 2. Disconnect database & cache
        try {
          await closeDB();
          await closeRedis();
          logger.info("Database and Redis connections closed successfully.");
          process.exit(0);
        } catch (error) {
          logger.error({ err: error }, "Error during cleanup shutdown");
          process.exit(1);
        }
      });

      // Force exit after 10s if hanging
      setTimeout(() => {
        logger.error("Graceful shutdown timed out. Forcing termination.");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("unhandledRejection", (reason: unknown) => {
      logger.error({ reason }, "Unhandled Promise Rejection");
    });

    process.on("uncaughtException", (error: Error) => {
      logger.fatal({ err: error }, "Uncaught Exception! Process will terminate.");
      process.exit(1);
    });
  } catch (error) {
    logger.fatal({ err: error }, "Bootstrap sequence failed to initialize server");
    process.exit(1);
  }
}

bootstrap();
