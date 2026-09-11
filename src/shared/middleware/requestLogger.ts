import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../../infrastructure/logger";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  req.requestId = requestId;
  req.startTime = Date.now();
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const logData = {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error(logData, "HTTP Request Failed");
    } else if (res.statusCode >= 400) {
      logger.warn(logData, "HTTP Client Error");
    } else {
      logger.info(logData, "HTTP Request Completed");
    }
  });

  next();
};
