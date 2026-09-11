import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { InventoryRepository } from "../modules/inventory/inventory.repository";
import { SellersRepository } from "../modules/sellers/sellers.repository";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Inventory API Endpoints", () => {
  const sellerUserId = "65f1a2b3c4d5e6f7a8b9c0d1";
  const sellerObjectId = new ObjectId(sellerUserId);
  const sellerProfileId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0aa");
  const storeId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0bb");
  const productId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0cc");
  const variantId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0dd");

  let sellerToken: string;

  const mockInventory = {
    _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0ee"),
    product_id: productId,
    variant_id: variantId,
    sku: "TEST-SKU-001",
    store_id: storeId,
    seller_id: sellerProfileId,
    quantity_available: 50,
    quantity_reserved: 5,
    low_stock_threshold: 10,
    is_trackable: true,
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

    vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
      _id: sellerProfileId,
      user_id: sellerObjectId,
      status: "approved",
    } as any);
  });

  describe("GET /api/v1/inventory/seller/me", () => {
    it("should return seller inventory with pagination", async () => {
      vi.spyOn(InventoryRepository, "findBySellerId").mockResolvedValue({
        items: [mockInventory],
        total: 1,
      });

      const res = await request(app)
        .get("/api/v1/inventory/seller/me")
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].sku).toBe("TEST-SKU-001");
      expect(res.body.data.items[0].quantity_available).toBe(50);
      expect(res.body.data.items[0].is_low_stock).toBe(false);
      expect(res.body.data.pagination.total).toBe(1);
    });
  });

  describe("GET /api/v1/inventory/seller/me/:sku", () => {
    it("should return a single inventory record by SKU", async () => {
      vi.spyOn(InventoryRepository, "findBySku").mockResolvedValue(mockInventory);

      const res = await request(app)
        .get(`/api/v1/inventory/seller/me/${mockInventory.sku}`)
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe("TEST-SKU-001");
      expect(res.body.data.quantity_available).toBe(50);
    });
  });

  describe("PATCH /api/v1/inventory/seller/me/:sku", () => {
    it("should allow seller to restock inventory", async () => {
      vi.spyOn(InventoryRepository, "findBySku").mockResolvedValue(mockInventory);
      vi.spyOn(InventoryRepository, "atomicUpdateStock").mockResolvedValue({
        ...mockInventory,
        quantity_available: 75,
      });
      vi.spyOn(InventoryRepository, "logTransaction").mockResolvedValue({} as any);

      const res = await request(app)
        .patch(`/api/v1/inventory/seller/me/${mockInventory.sku}`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          quantity_change: 25,
          type: "restock",
          note: "Warehouse delivery batch A",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity_available).toBe(75);
    });

    it("should reject decrement exceeding available inventory", async () => {
      vi.spyOn(InventoryRepository, "findBySku").mockResolvedValue(mockInventory);

      const res = await request(app)
        .patch(`/api/v1/inventory/seller/me/${mockInventory.sku}`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          quantity_change: -100, // Available is only 50
          type: "adjustment",
          note: "Damaged goods",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("Insufficient available inventory");
    });
  });

  describe("PATCH /api/v1/inventory/seller/me/:sku/threshold", () => {
    it("should update low stock threshold", async () => {
      vi.spyOn(InventoryRepository, "setThreshold").mockResolvedValue({
        ...mockInventory,
        low_stock_threshold: 15,
      });

      const res = await request(app)
        .patch(`/api/v1/inventory/seller/me/${mockInventory.sku}/threshold`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          low_stock_threshold: 15,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.low_stock_threshold).toBe(15);
    });
  });
});
