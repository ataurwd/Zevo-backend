import Redis, { RedisOptions } from "ioredis";
import { logger } from "../logger";

let redisClient: Redis | null = null;

const DEFAULT_REDIS_URL = "redis://localhost:6379";

export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.REDIS_URL || DEFAULT_REDIS_URL;

  let retryCount = 0;
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (process.env.NODE_ENV === "test" || times > 3) {
        logger.warn(`Redis unavailable at ${url}. Operating without Redis cache in local dev.`);
        return null; // stop retrying
      }
      retryCount = times;
      return Math.min(times * 300, 1500);
    },
    reconnectOnError() {
      return false;
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
    if (retryCount <= 1) {
      logger.warn({ err: (err as any)?.message || err }, "Redis connection notice (running without cache)");
    }
  });

  redisClient.on("close", () => {
    // closed
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
