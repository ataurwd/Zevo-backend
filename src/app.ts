import express, { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { requestLogger } from "./shared/middleware/requestLogger";
import { errorHandler } from "./shared/middleware/errorHandler";
import { metricsMiddleware, registry } from "./infrastructure/metrics";
import { apiRouter } from "./routes";
import { NotFoundError } from "./shared/errors/errors";
import { ensureConnected } from "./infrastructure/db/client";

dotenv.config();

export function createApp(): Express {
  const app = express();

  // Metrics middleware for HTTP latency and status tracking
  app.use(metricsMiddleware);

  // Security headers
  app.use(helmet());

  // CORS configuration
  const rawAllowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""));

  const isOriginAllowed = (origin?: string): boolean => {
    if (!origin) return true; // mobile apps, server-to-server, curl
    // Explicit production & development allowed origins
    const defaultAllowed = [
      "https://zevo-frontend.vercel.app",
      "https://zevo-full-stack.onrender.com",
      "https://zevo-backend.onrender.com",
      "http://localhost:3000",
      "http://localhost:5000",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5000",
    ];
    if (defaultAllowed.includes(origin)) return true;
    if (rawAllowedOrigins.includes("*") || rawAllowedOrigins.includes(origin)) return true;
    // Allow any localhost/127.0.0.1 port for local development
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
    // Automatically allow all Vercel deployments (*.vercel.app)
    if (/^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$/.test(origin)) return true;
    // Automatically allow Render deployments (*.onrender.com)
    if (/^https:\/\/([a-zA-Z0-9_-]+\.)*onrender\.com$/.test(origin)) return true;
    return false;
  };

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "x-request-id",
      "X-Guest-Cart-Id",
      "x-guest-cart-id",
      "x-session-token",
      "stripe-signature",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
    exposedHeaders: ["set-cookie"],
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  // Cookie and Body Parsers
  app.use(cookieParser());
  app.use(
    express.json({
      limit: "10mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Root & Direct Health ping for Uptime monitors & Render keep-alive
  app.get(["/", "/health"], (_req, res) => {
    res.status(200).json({
      status: "alive",
      service: "zevo-backend",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Request Tracking & Logging
  app.use(requestLogger);

  // Static uploads directory
  app.use("/uploads", express.static("uploads"));

  // Prometheus direct scraping endpoint
  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  });

  // Auto-connect to DB if not yet connected
  app.use("/api/v1", async (_req, _res, next) => {
    try {
      await ensureConnected();
    } catch {
      // route handlers will catch and report meaningful error via getDb()
    }
    next();
  });

  // Master API Router
  app.use("/api/v1", apiRouter);

  // Catch 404 for unhandled routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
