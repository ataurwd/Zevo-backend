import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { analyticsService } from "../modules/analytics/analytics.service";
import { SellersRepository } from "../modules/sellers/sellers.repository";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Phase 14: Analytics API Endpoints", () => {
  const sellerUserId = "65f1a2b3c4d5e6f7a8b9c501";
  const sellerId = new ObjectId("65f1a2b3c4d5e6f7a8b9c502");
  const adminUserId = "65f1a2b3c4d5e6f7a8b9c503";

  let sellerToken: string;
  let adminToken: string;

  const mockSellerAnalytics = {
    total_revenue: 125000,
    net_earnings: 112500,
    total_commission: 12500,
    total_orders: 45,
    delivered_orders: 40,
    pending_orders: 5,
    revenue_chart: [
      { date: "2026-09-01", revenue: 25000, orders: 10 },
      { date: "2026-09-02", revenue: 35000, orders: 15 },
    ],
    top_products: [
      {
        product_id: "prod-1",
        product_name: "Aura Wireless Headphones",
        total_quantity: 25,
        total_revenue: 75000,
      },
    ],
  };

  const mockAdminAnalytics = {
    platform_gmv: 500000,
    total_platform_fees: 50000,
    total_orders: 120,
    total_sellers: 15,
    total_riders: 8,
    active_riders_online: 5,
    revenue_chart: [
      { date: "2026-09-01", revenue: 100000, orders: 25 },
      { date: "2026-09-02", revenue: 150000, orders: 35 },
    ],
    top_stores: [
      {
        store_id: sellerId.toString(),
        store_name: "Apex Electronics",
        total_gmv: 250000,
        orders_count: 65,
      },
    ],
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

  describe("GET /api/v1/analytics/seller", () => {
    it("should return seller analytics for authenticated merchant", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
        _id: sellerId,
        user_id: new ObjectId(sellerUserId),
      } as any);

      vi.spyOn(analyticsService, "getSellerAnalytics").mockResolvedValue(mockSellerAnalytics);

      const res = await request(app)
        .get("/api/v1/analytics/seller?days=30")
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_revenue).toBe(125000);
      expect(res.body.data.top_products).toHaveLength(1);
    });

    it("should deny access to regular customer", async () => {
      const customerToken = generateAccessToken({
        id: "cust-1",
        email: "customer@nexora.com",
        role: "CUSTOMER",
      }).token;

      const res = await request(app)
        .get("/api/v1/analytics/seller")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/analytics/admin", () => {
    it("should return platform overview metrics for admin", async () => {
      vi.spyOn(analyticsService, "getAdminAnalytics").mockResolvedValue(mockAdminAnalytics);

      const res = await request(app)
        .get("/api/v1/analytics/admin?days=30")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.platform_gmv).toBe(500000);
      expect(res.body.data.active_riders_online).toBe(5);
    });

    it("should deny access to non-admin user", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/admin")
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
