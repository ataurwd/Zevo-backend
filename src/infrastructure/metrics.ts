import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";
import { Request, Response, NextFunction } from "express";

export const registry = new Registry();
registry.setDefaultLabels({ service: "nexora-api" });

// Collect standard node.js runtime metrics (event loop lag, memory, CPU, GC)
collectDefaultMetrics({ register: registry });

// HTTP request duration
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

// Active orders
export const activeOrdersGauge = new Gauge({
  name: "nexora_active_orders_total",
  help: "Number of orders in non-terminal states",
  registers: [registry],
});

// Payment success/failure
export const paymentCounter = new Counter({
  name: "nexora_payments_total",
  help: "Total payment events",
  labelNames: ["status"], // succeeded | failed | refunded
  registers: [registry],
});

// BullMQ job metrics
export const jobDuration = new Histogram({
  name: "bullmq_job_duration_seconds",
  help: "BullMQ job processing duration in seconds",
  labelNames: ["queue", "name"],
  buckets: [0.01, 0.1, 0.5, 1, 5, 30],
  registers: [registry],
});

export const jobFailureCounter = new Counter({
  name: "bullmq_job_failures_total",
  help: "Total failed BullMQ jobs",
  labelNames: ["queue", "name"],
  registers: [registry],
});

// Redis cache metrics
export const cacheHitCounter = new Counter({
  name: "nexora_cache_hits_total",
  help: "Redis cache hits",
  labelNames: ["resource"],
  registers: [registry],
});

export const cacheMissCounter = new Counter({
  name: "nexora_cache_misses_total",
  help: "Redis cache misses",
  labelNames: ["resource"],
  registers: [registry],
});

/**
 * Express Middleware to track request duration and route metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics collection for metrics endpoint itself to avoid poll skew
  if (req.path.endsWith("/metrics")) {
    return next();
  }

  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route?.path || req.baseUrl + (req.route?.path || "") || req.path || "unknown";

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode.toString(),
      },
      durationInSeconds
    );
  });

  next();
}
