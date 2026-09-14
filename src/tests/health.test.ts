import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import * as dbClient from "../infrastructure/db/client";
import * as redisClient from "../infrastructure/redis/client";

describe("Health & System Endpoints", () => {
  describe("GET /api/v1/health/live", () => {
    it("should return 200 OK with alive status", async () => {
      const response = await request(app).get("/api/v1/health/live");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("alive");
      expect(typeof response.body.data.uptime).toBe("number");
      expect(response.body.data.timestamp).toBeDefined();
    });
  });

  describe("GET /api/v1/health/ready", () => {
    it("should return 200 with status ready when dependencies are healthy", async () => {
      vi.spyOn(dbClient, "checkDBHealth").mockResolvedValue(true);
      vi.spyOn(redisClient, "checkRedisHealth").mockResolvedValue(true);

      const response = await request(app).get("/api/v1/health/ready");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("ready");
      expect(response.body.data.services).toEqual({
        mongodb: "up",
        redis: "up",
      });
    });

    it("should return 503 with status degraded when any dependency is down", async () => {
      vi.spyOn(dbClient, "checkDBHealth").mockResolvedValue(false);
      vi.spyOn(redisClient, "checkRedisHealth").mockResolvedValue(true);

      const response = await request(app).get("/api/v1/health/ready");

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe("degraded");
      expect(response.body.data.services).toEqual({
        mongodb: "down",
        redis: "up",
      });
      expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
    });
  });

  describe("GET /api/v1/health/metrics & /metrics", () => {
    it("should return Prometheus exposition format from /api/v1/health/metrics", async () => {
      const response = await request(app).get("/api/v1/health/metrics");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/plain");
      expect(response.text).toContain("http_request_duration_seconds");
      expect(response.text).toContain("service=\"nexora-api\"");
    });

    it("should return Prometheus metrics from direct /metrics endpoint", async () => {
      const response = await request(app).get("/metrics");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/plain");
      expect(response.text).toContain("nexora_active_orders_total");
    });
  });

  describe("404 Error Handler", () => {
    it("should return 404 with structured error response for unmapped routes", async () => {
      const response = await request(app).get("/api/v1/unknown-route-endpoint");

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });
});
