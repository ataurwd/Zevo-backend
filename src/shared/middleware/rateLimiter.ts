import { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../../infrastructure/redis/client";
import { TooManyRequestsError } from "../errors/errors";
import { logger } from "../../infrastructure/logger";

export interface RateLimitOptions {
  limit: number;
  windowSec: number;
  action: string;
  byUser?: boolean;
}

export const rateLimiter = (options: RateLimitOptions) => {
  const { limit, windowSec, action, byUser = false } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient();
      const identifier = byUser && req.user?.id
        ? `user:${req.user.id}`
        : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;

      const key = `ratelimit:${identifier}:${action}`;
      const now = Date.now();
      const windowStart = now - windowSec * 1000;

      // Sliding window using Redis multi transaction
      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zadd(key, now, `${now}-${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, windowSec);

      const results = await multi.exec();
      if (!results) {
        next();
        return;
      }

      // results[2] is zcard output: [err, count]
      const count = (results[2][1] as number) || 1;

      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - count));

      if (count > limit) {
        res.setHeader("Retry-After", windowSec);
        next(
          new TooManyRequestsError(
            `Rate limit exceeded for action '${action}'. Please retry in ${windowSec} seconds.`
          )
        );
        return;
      }

      next();
    } catch (error) {
      // Fail-open strategy: log warning, allow request if Redis throws
      logger.warn({ err: error, action }, "Rate limiting bypassed due to Redis error");
      next();
    }
  };
};

export const authRateLimiter = rateLimiter({
  limit: 10,
  windowSec: 15 * 60, // 15 minutes
  action: "auth",
  byUser: false,
});
