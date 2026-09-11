import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";
import { logger } from "../../infrastructure/logger";
import { sendError } from "../utils/response";

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // Handle Zod Validation Error
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    logger.warn({ path: req.path, details }, "Validation error caught");
    sendError(res, "VALIDATION_ERROR", "Validation failed", 400, details);
    return;
  }

  // Handle Custom Operational AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, "Operational server error");
    } else {
      logger.warn({ code: err.code, message: err.message, path: req.path }, "Operational client error");
    }
    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // Handle MongoDB Duplicate Key Error (E11000)
  if ("code" in err && (err as { code: number }).code === 11000) {
    logger.warn({ err, path: req.path }, "MongoDB duplicate key conflict");
    sendError(res, "CONFLICT", "A resource with these details already exists", 409);
    return;
  }

  // Handle Invalid JSON Body
  if (err instanceof SyntaxError && "body" in err) {
    logger.warn({ path: req.path }, "Malformed JSON in request body");
    sendError(res, "BAD_REQUEST", "Malformed JSON payload", 400);
    return;
  }

  // Unhandled / Unexpected Errors
  logger.error({ err, path: req.path, stack: err.stack }, "Unhandled application exception");
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected internal server error occurred"
      : err.message || "Internal Server Error";

  sendError(res, "INTERNAL_SERVER_ERROR", message, 500);
};
