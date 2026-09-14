import https from "https";
import dns from "node:dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore in environments where setting DNS servers is not permitted
}

import http from "http";
import { app } from "./app";
import { logger } from "./infrastructure/logger";
import { connectDB, closeDB } from "./infrastructure/db/client";
import { getRedisClient, closeRedis } from "./infrastructure/redis/client";
import { initSocketServer } from "./infrastructure/socket/io";

const PORT = parseInt(process.env.PORT || "5000", 10);

async function bootstrap(): Promise<void> {
  try {
    // 1. Establish database connection before accepting traffic
    try {
      await connectDB(5, 1500);
      logger.info("MongoDB connection successfully established.");
    } catch (err) {
      logger.error({ err }, "Initial MongoDB connection failed. Will retry on demand.");
    }

    const server = http.createServer(app);
    initSocketServer(server);

    // Render Keep-Alive Auto-Ping (Prevents free-tier inactivity sleep)
    const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
    if (externalUrl) {
      const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes (Render sleeps after 15 min)
      const pingUrl = externalUrl.startsWith("http") ? `${externalUrl}/health` : `https://${externalUrl}/health`;
      setInterval(() => {
        const client = pingUrl.startsWith("https") ? https : http;
        client.get(pingUrl, (res) => {
          logger.info(`Keep-alive ping sent to ${pingUrl} - Status: ${res.statusCode}`);
        }).on("error", (err) => {
          logger.warn(`Keep-alive ping failed: ${err.message}`);
        });
      }, PING_INTERVAL);
      logger.info(`Keep-alive auto-ping enabled for ${pingUrl} every 14 minutes`);
    }

    server.listen(PORT, () => {
      logger.info(`🚀 NEXORA API server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
      logger.info(`Health check available at http://localhost:${PORT}/api/v1/health/live`);
    });

    try {
      getRedisClient();
    } catch (err) {
      logger.warn({ err }, "Initial Redis connection failed. Will retry on demand.");
    }

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
