import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { SellersRepository } from "../modules/sellers/sellers.repository";
import { UsersRepository } from "../modules/users/users.repository";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Sellers API Endpoints", () => {
  const sellerUserId = "65f1a2b3c4d5e6f7a8b9c0d1";
  const sellerObjectId = new ObjectId(sellerUserId);
  const adminUserId = "65f1a2b3c4d5e6f7a8b9c0d9";

  let sellerToken: string;
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    sellerToken = generateAccessToken({
      id: sellerUserId,
      email: "seller@nexora.com",
      role: "SELLER",
    }).token;

    adminToken = generateAccessToken({
      id: adminUserId,
      email: "admin@nexora.com",
      role: "ADMIN",
    }).token;
  });

  describe("POST /api/v1/sellers/onboard", () => {
    it("should initialize seller profile and return onboarding URL", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue(null);
      vi.spyOn(UsersRepository, "update").mockResolvedValue({} as any);
      vi.spyOn(SellersRepository, "create").mockResolvedValue({
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0aa"),
        user_id: sellerObjectId,
        stripe_account_id: "acct_mock_12345",
        stripe_onboarding_complete: false,
        status: "pending",
        business_name: "Apex Electronics",
        business_type: "company",
        bank_verified: false,
        total_earnings: 0,
        total_commission_paid: 0,
        pending_balance: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/sellers/onboard")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          business_name: "Apex Electronics",
          business_type: "company",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.onboarding_url).toBeDefined();
      expect(res.body.data.seller.business_name).toBe("Apex Electronics");
      expect(res.body.data.seller.status).toBe("pending");
    });
  });

  describe("Admin Moderation", () => {
    it("should approve a pending seller", async () => {
      const sellerId = "65f1a2b3c4d5e6f7a8b9c0aa";
      vi.spyOn(SellersRepository, "findById").mockResolvedValue({
        _id: new ObjectId(sellerId),
        user_id: sellerObjectId,
        status: "pending",
        business_name: "Apex Electronics",
        stripe_onboarding_complete: true,
      } as any);

      vi.spyOn(SellersRepository, "update").mockResolvedValue({
        _id: new ObjectId(sellerId),
        user_id: sellerObjectId,
        status: "approved",
        business_name: "Apex Electronics",
        stripe_onboarding_complete: true,
        bank_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.spyOn(UsersRepository, "findById").mockResolvedValue({
        email: "seller@nexora.com",
      } as any);

      const res = await request(app)
        .patch(`/api/v1/sellers/admin/${sellerId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("approved");
    });
  });
});
