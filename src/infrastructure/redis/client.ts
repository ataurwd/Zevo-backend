import Redis, { RedisOptions } from "ioredis";
import { logger } from "../logger";

let redisClient: Redis | null = null;
let loggedNotice = false;

const DEFAULT_REDIS_URL = "redis://localhost:6379";

export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS);
  const url = process.env.REDIS_URL || DEFAULT_REDIS_URL;
  const hasConfiguredUrl = Boolean(process.env.REDIS_URL);

  let retryCount = 0;
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: hasConfiguredUrl,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (!hasConfiguredUrl && (isServerless || process.env.NODE_ENV === "production")) {
        if (!loggedNotice) {
          logger.info("REDIS_URL not configured. Operating without Redis cache in serverless/production.");
          loggedNotice = true;
        }
        return null; // do not retry
      }
      if (process.env.NODE_ENV === "test" || times > 3) {
        if (!loggedNotice) {
          logger.warn(`Redis unavailable at ${url}. Operating without Redis cache.`);
          loggedNotice = true;
        }
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
    if (retryCount <= 1 && !loggedNotice) {
      logger.warn({ err: (err as any)?.message || err }, "Redis connection notice (running with in-memory fallback)");
      loggedNotice = true;
    }
  });

  redisClient.on("close", () => {
    // closed
  });

  return redisClient;
}

export async function checkRedisHealth(): Promise<boolean> {
  // If Redis is not configured in environment, treat as healthy (optional service)
  if (!process.env.REDIS_URL) {
    return true;
  }

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
    try {
      await redisClient.quit();
    } catch {
      // ignore on shutdown
    }
    redisClient = null;
    logger.info("Redis connection closed");
  }
}


