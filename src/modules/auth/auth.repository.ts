import { getRedisClient } from "../../infrastructure/redis/client";
import { redisKeys } from "../../infrastructure/redis/keys";
import { logger } from "../../infrastructure/logger";

export class AuthRepository {
  public static async blacklistToken(jti: string, ttlSeconds = 60 * 60 * 24 * 7): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.set(redisKeys.refreshTokenBlacklist(jti), "true", "EX", ttlSeconds);
    } catch (err) {
      logger.error({ err, jti }, "Failed to blacklist token in Redis");
    }
  }

  public static async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const val = await redis.get(redisKeys.refreshTokenBlacklist(jti));
      return val !== null;
    } catch (err) {
      logger.error({ err, jti }, "Error querying token blacklist in Redis");
      return false;
    }
  }

  public static async forceUserLogout(userId: string, ttlSeconds = 60 * 60 * 24 * 7): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.set(redisKeys.userForceLogout(userId), "true", "EX", ttlSeconds);
    } catch (err) {
      logger.error({ err, userId }, "Failed setting user force logout flag");
    }
  }
}
