import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../shared/utils/response";
import { checkDBHealth } from "../../infrastructure/db/client";
import { checkRedisHealth } from "../../infrastructure/redis/client";

export class HealthController {
  public static live = (_req: Request, res: Response): void => {
    sendSuccess(res, {
      status: "alive",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  };

  public static ready = async (_req: Request, res: Response): Promise<void> => {
    const [mongodbUp, redisUp] = await Promise.all([
      checkDBHealth(),
      checkRedisHealth(),
    ]);

    const services = {
      mongodb: mongodbUp ? "up" : "down",
      redis: redisUp ? "up" : "down",
    };

    const isReady = mongodbUp && redisUp;

    if (!isReady) {
      res.status(503).json({
        success: false,
        data: {
          status: "degraded",
          services,
          timestamp: new Date().toISOString(),
        },
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "One or more dependent services are down",
        },
      });
      return;
    }

    sendSuccess(res, {
      status: "ready",
      services,
      timestamp: new Date().toISOString(),
    });
  };
}
