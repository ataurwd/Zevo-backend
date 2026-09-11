import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { UnauthorizedError } from "../errors/errors";
import { getRedisClient } from "../../infrastructure/redis/client";
import { redisKeys } from "../../infrastructure/redis/keys";

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new UnauthorizedError("Authentication token required"));
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);

    // Check if user has an active force logout flag in Redis
    try {
      const redis = getRedisClient();
      const isForceLoggedOut = await redis.get(redisKeys.userForceLogout(payload.sub));
      if (isForceLoggedOut) {
        next(new UnauthorizedError("Session has been invalidated. Please log in again."));
        return;
      }
    } catch {
      // If redis is momentarily unreachable, proceed with valid signature verification
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      storeId: payload.storeId,
      deliveryAgentId: payload.deliveryAgentId,
    };

    next();
  } catch (error) {
    next(new UnauthorizedError("Invalid or expired access token", error));
  }
};

export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      storeId: payload.storeId,
      deliveryAgentId: payload.deliveryAgentId,
    };
  } catch {
    // Treat invalid or expired token as unauthenticated (guest)
  }

  next();
};
