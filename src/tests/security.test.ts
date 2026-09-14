import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app";
import { generateAccessToken } from "../shared/utils/jwt";
import { StripeService } from "../infrastructure/services/stripe.service";
import { ObjectId } from "mongodb";

// Mock Database & Redis
vi.mock("../infrastructure/db/client", () => {
  return {
    getDb: vi.fn(),
    checkDBHealth: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../infrastructure/redis/client", () => {
  return {
    getRedisClient: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      multi: vi.fn().mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
      }),
    }),
    checkRedisHealth: vi.fn().mockResolvedValue(true),
  };
});

describe("Phase 17 — Security Hardening & Penetration Verification", () => {
  const customerId = new ObjectId().toString();
  const attackerCustomerId = new ObjectId().toString();
  const sellerId = new ObjectId().toString();
  const attackerSellerId = new ObjectId().toString();
  const adminId = new ObjectId().toString();

  const customerToken = generateAccessToken({
    id: customerId,
    email: "customer@example.com",
    role: "CUSTOMER",
  }).token;

  const attackerCustomerToken = generateAccessToken({
    id: attackerCustomerId,
    email: "attacker_customer@example.com",
    role: "CUSTOMER",
  }).token;

  const sellerToken = generateAccessToken({
    id: sellerId,
    email: "legit_seller@example.com",
    role: "SELLER",
  }).token;

  const attackerSellerToken = generateAccessToken({
    id: attackerSellerId,
    email: "attacker_seller@example.com",
    role: "SELLER",
  }).token;

  const adminToken = generateAccessToken({
    id: adminId,
    email: "superadmin@nexora.com",
    role: "ADMIN",
  }).token;

  describe("1. Privilege Escalation Prevention", () => {
    it("should reject CUSTOMER access to ADMIN analytics endpoint with 403", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/admin")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("should reject SELLER access to ADMIN-only withdrawal review with 403", async () => {
      const res = await request(app)
        .patch("/api/v1/withdrawals/admin/65f1a2b3c4d5e6f7a8b9c100/approve")
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("should reject unauthenticated requests to protected endpoints with 401", async () => {
      const res = await request(app).get("/api/v1/users/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject tampered or forged JWT tokens with 401", async () => {
      const forgedToken = customerToken.slice(0, -8) + "badsign8";
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("2. IDOR (Insecure Direct Object Reference) Protection", () => {
    it("should block non-admin users from viewing platform audit logs", async () => {
      const res = await request(app)
        .get("/api/v1/audit/admin/logs")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should block customers from accessing seller coupon creation", async () => {
      const res = await request(app)
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          code: "HACK50",
          discount_type: "percentage",
          discount_value: 50,
          store_id: new ObjectId().toString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should block customers from triggering seller withdrawal payouts", async () => {
      const res = await request(app)
        .post("/api/v1/withdrawals/request")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          amount: 5000,
          notes: "Exploit attempt",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("3. Input Sanitization & NoSQL Injection Prevention", () => {
    it("should reject NoSQL operator injection in login endpoint with 400 validation error", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: { $ne: null },
          password: "password123",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject malformed JSON payload bodies with 400", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .set("Content-Type", "application/json")
        .send('{"email": "test@example.com", malformed}');

      expect(res.status).toBe(400);
    });
  });

  describe("4. Webhook Security", () => {
    it("should reject Stripe webhook calls with invalid or failing signature with 400", async () => {
      vi.spyOn(StripeService, "constructWebhookEvent").mockImplementation(() => {
        throw new Error("No signatures found matching the expected signature for payload");
      });

      const res = await request(app)
        .post("/api/v1/payments/webhook")
        .set("stripe-signature", "t=12345,v1=invalidsignaturestring")
        .send({ id: "evt_fake", type: "payment_intent.succeeded" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("Webhook signature verification failed");
    });
  });
});
