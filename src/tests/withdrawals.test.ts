import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { withdrawalsRepository } from "../modules/withdrawals/withdrawals.repository";
import { SellersRepository } from "../modules/sellers/sellers.repository";
import { auditRepository } from "../modules/audit/audit.repository";
import { generateAccessToken } from "../shared/utils/jwt";
import { Withdrawal } from "../modules/withdrawals/withdrawals.types";

describe("Phase 15: Withdrawals & Audit Trail API Endpoints", () => {
  const sellerUserId = "65f1a2b3c4d5e6f7a8b9c601";
  const sellerId = new ObjectId("65f1a2b3c4d5e6f7a8b9c602");
  const adminUserId = "65f1a2b3c4d5e6f7a8b9c603";
  const withdrawalId = new ObjectId("65f1a2b3c4d5e6f7a8b9c604");

  let sellerToken: string;
  let adminToken: string;

  const mockSeller = {
    _id: sellerId,
    user_id: new ObjectId(sellerUserId),
    business_name: "Apex Electronics",
    total_earnings: 15000, // $150.00
  };

  const mockWithdrawal: Withdrawal = {
    _id: withdrawalId,
    seller_id: sellerId,
    seller_name: "Apex Electronics",
    amount: 5000, // $50.00
    status: "pending",
    notes: "Regular payout request",
    admin_notes: null,
    processed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

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

  describe("POST /api/v1/withdrawals/request", () => {
    it("should allow seller to request a payout if balance is sufficient", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue(mockSeller as any);
      vi.spyOn(SellersRepository, "findById").mockResolvedValue(mockSeller as any);
      vi.spyOn(SellersRepository, "update").mockResolvedValue({} as any);
      vi.spyOn(withdrawalsRepository, "create").mockResolvedValue(mockWithdrawal);
      vi.spyOn(auditRepository, "create").mockResolvedValue({} as any);

      const res = await request(app)
        .post("/api/v1/withdrawals/request")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          amount: 5000,
          notes: "Regular payout request",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(5000);
      expect(SellersRepository.update).toHaveBeenCalledWith(
        sellerId,
        expect.objectContaining({ total_earnings: 10000 })
      );
    });

    it("should reject payout request if amount is below minimum ($20.00)", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue(mockSeller as any);

      const res = await request(app)
        .post("/api/v1/withdrawals/request")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          amount: 1000, // $10.00
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it("should reject payout request if balance is insufficient", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
        ...mockSeller,
        total_earnings: 2500, // $25.00
      } as any);
      vi.spyOn(SellersRepository, "findById").mockResolvedValue({
        ...mockSeller,
        total_earnings: 2500,
      } as any);

      const res = await request(app)
        .post("/api/v1/withdrawals/request")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          amount: 5000, // $50.00
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/withdrawals/admin/:id/approve", () => {
    it("should allow admin to approve a pending withdrawal", async () => {
      vi.spyOn(withdrawalsRepository, "findById").mockResolvedValue(mockWithdrawal);
      vi.spyOn(withdrawalsRepository, "updateStatus").mockResolvedValue({
        ...mockWithdrawal,
        status: "approved",
      });
      vi.spyOn(auditRepository, "create").mockResolvedValue({} as any);

      const res = await request(app)
        .patch(`/api/v1/withdrawals/admin/${withdrawalId.toString()}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("approved");
    });
  });

  describe("PATCH /api/v1/withdrawals/admin/:id/reject", () => {
    it("should allow admin to reject withdrawal and refund funds to seller wallet", async () => {
      vi.spyOn(withdrawalsRepository, "findById").mockResolvedValue(mockWithdrawal);
      vi.spyOn(SellersRepository, "findById").mockResolvedValue(mockSeller as any);
      vi.spyOn(SellersRepository, "update").mockResolvedValue({} as any);
      vi.spyOn(withdrawalsRepository, "updateStatus").mockResolvedValue({
        ...mockWithdrawal,
        status: "rejected",
      });
      vi.spyOn(auditRepository, "create").mockResolvedValue({} as any);

      const res = await request(app)
        .patch(`/api/v1/withdrawals/admin/${withdrawalId.toString()}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reason: "Tax document mismatch on bank profile",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("rejected");
      expect(SellersRepository.update).toHaveBeenCalledWith(
        sellerId,
        expect.objectContaining({ total_earnings: 20000 })
      );
    });
  });

  describe("GET /api/v1/audit/admin/logs", () => {
    it("should allow admin to retrieve audit logs", async () => {
      vi.spyOn(auditRepository, "queryLogs").mockResolvedValue({
        logs: [
          {
            _id: new ObjectId(),
            actor_id: new ObjectId(adminUserId),
            actor_email: "admin@nexora.com",
            actor_role: "ADMIN",
            action: "payout.approve",
            target_resource: "withdrawal",
            target_id: withdrawalId.toString(),
            created_at: new Date(),
          },
        ],
        total: 1,
      });

      const res = await request(app)
        .get("/api/v1/audit/admin/logs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toHaveLength(1);
    });
  });
});
