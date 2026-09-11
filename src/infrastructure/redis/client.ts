import Redis, { RedisOptions } from "ioredis";
import { logger } from "../logger";

let redisClient: Redis | null = null;

const DEFAULT_REDIS_URL = "redis://localhost:6379";

export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.REDIS_URL || DEFAULT_REDIS_URL;

  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (process.env.NODE_ENV === "test") {
        return null; // do not retry in unit test mode
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis connection retry attempt ${times}, delaying ${delay}ms`);
      return delay;
    },
    reconnectOnError(err) {
      logger.warn({ err }, "Redis reconnect on error");
      return true;
    },
  };

  redisClient = new Redis(url, options);

  redisClient.on("connect", () => {
    logger.info("Connected to Redis");
  });

  redisClient.on("ready", () => {
    logger.info("Redis client ready");
  });

  redisClient.on("error", (err) => {
    logger.error({ err }, "Redis connection error");
  });

  redisClient.on("close", () => {
    logger.warn("Redis connection closed");
  });

  return redisClient;
}

export async function checkRedisHealth(): Promise<boolean> {
  if (!redisClient) {
    try {
      getRedisClient();
    } catch {
      return false;
    }
  }
  try {
    const res = await redisClient?.ping();
    return res === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis connection closed");
  }
}
