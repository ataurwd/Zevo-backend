import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { ProductsRepository } from "../modules/products/products.repository";
import { SellersRepository } from "../modules/sellers/sellers.repository";
import { StoresRepository } from "../modules/stores/stores.repository";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Products API Endpoints", () => {
  const sellerUserId = "65f1a2b3c4d5e6f7a8b9c0d1";
  const sellerObjectId = new ObjectId(sellerUserId);
  const sellerProfileId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0aa");
  const storeId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0bb");

  const otherSellerUserId = "65f1a2b3c4d5e6f7a8b9c0d2";
  const otherSellerProfileId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0ab");

  const adminUserId = "65f1a2b3c4d5e6f7a8b9c0d9";

  let sellerToken: string;
  let otherSellerToken: string;
  let adminToken: string;

  const mockProduct = {
    _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0e1"),
    store_id: storeId,
    seller_id: sellerProfileId,
    category_id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0c1"),
    name: "Wireless Noise-Canceling Headphones",
    slug: "wireless-noise-canceling-headphones",
    description: "Premium over-ear wireless headphones with ANC.",
    status: "draft" as const,
    rejection_reason: null,
    images: [{ url: "https://images.nexora.com/headphones.jpg", alt: "Front view", is_primary: true }],
    tags: ["audio", "wireless", "anc"],
    attributes: [{ name: "Color", value: "Matte Black" }],
    variants: [
      {
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0f1"),
        sku: "HP-BLK-001",
        name: "Black Standard",
        attributes: { color: "black" },
        price: 199.99,
        compare_at_price: 249.99,
        weight_grams: 350,
        is_active: true,
      },
    ],
    base_price: 19999,
    rating_avg: 0,
    rating_count: 0,
    total_sold: 0,
    is_deleted: false,
    deleted_at: null,
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

    otherSellerToken = generateAccessToken({
      id: otherSellerUserId,
      email: "other@nexora.com",
      role: "SELLER",
    }).token;

    adminToken = generateAccessToken({
      id: adminUserId,
      email: "admin@nexora.com",
      role: "ADMIN",
    }).token;
  });

  describe("POST /api/v1/products/seller", () => {
    it("should allow a seller to create a product in draft status", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
        _id: sellerProfileId,
        user_id: sellerObjectId,
        status: "approved",
      } as any);

      vi.spyOn(StoresRepository, "findBySellerId").mockResolvedValue({
        _id: storeId,
        seller_id: sellerProfileId,
        name: "Apex Electronics Store",
      } as any);

      vi.spyOn(ProductsRepository, "findBySlug").mockResolvedValue(null);
      vi.spyOn(ProductsRepository, "create").mockResolvedValue(mockProduct);

      const res = await request(app)
        .post("/api/v1/products/seller")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          category_id: "65f1a2b3c4d5e6f7a8b9c0c1",
          name: "Wireless Noise-Canceling Headphones",
          description: "Premium over-ear wireless headphones with ANC.",
          variants: [
            {
              name: "Black Standard",
              price: 19999,
              sku: "HP-BLK-001",
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Wireless Noise-Canceling Headphones");
      expect(res.body.data.status).toBe("draft");
      expect(res.body.data.variants.length).toBe(1);
    });
  });

  describe("Seller Isolation", () => {
    it("should reject updating a product owned by another seller", async () => {
      // Current seller is otherSellerUserId
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
        _id: otherSellerProfileId,
        user_id: new ObjectId(otherSellerUserId),
        status: "approved",
      } as any);

      // Product belongs to sellerProfileId (not otherSellerProfileId)
      vi.spyOn(ProductsRepository, "findById").mockResolvedValue(mockProduct);

      const res = await request(app)
        .patch(`/api/v1/products/seller/${mockProduct._id.toHexString()}`)
        .set("Authorization", `Bearer ${otherSellerToken}`)
        .send({
          name: "Hacked Product Name",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("Access denied. You do not own this product.");
    });
  });

  describe("Status Transitions & Admin Moderation", () => {
    it("should allow a seller to submit draft product for review", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
        _id: sellerProfileId,
        user_id: sellerObjectId,
        status: "approved",
      } as any);

      vi.spyOn(ProductsRepository, "findById").mockResolvedValue(mockProduct);
      vi.spyOn(ProductsRepository, "update").mockResolvedValue({
        ...mockProduct,
        status: "pending_review",
      });

      const res = await request(app)
        .patch(`/api/v1/products/seller/${mockProduct._id.toHexString()}/status`)
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("pending_review");
    });

    it("should allow admin to approve a product", async () => {
      vi.spyOn(ProductsRepository, "findById").mockResolvedValue({
        ...mockProduct,
        status: "pending_review",
      });
      vi.spyOn(ProductsRepository, "update").mockResolvedValue({
        ...mockProduct,
        status: "approved",
      });

      const res = await request(app)
        .patch(`/api/v1/products/admin/${mockProduct._id.toHexString()}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("approved");
    });

    it("should allow admin to reject a product with reason", async () => {
      vi.spyOn(ProductsRepository, "findById").mockResolvedValue({
        ...mockProduct,
        status: "pending_review",
      });
      vi.spyOn(ProductsRepository, "update").mockResolvedValue({
        ...mockProduct,
        status: "rejected",
        rejection_reason: "Violates prohibited items policy.",
      });

      const res = await request(app)
        .patch(`/api/v1/products/admin/${mockProduct._id.toHexString()}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reason: "Violates prohibited items policy.",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("rejected");
      expect(res.body.data.rejection_reason).toBe("Violates prohibited items policy.");
    });
  });

  describe("GET /api/v1/products (Public Browse)", () => {
    it("should return approved products matching filter criteria", async () => {
      vi.spyOn(ProductsRepository, "searchPublic").mockResolvedValue({
        items: [{ ...mockProduct, status: "approved" }],
        total: 1,
      });

      const res = await request(app).get("/api/v1/products?q=headphones&min_price=100");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.pagination.total).toBe(1);
      expect(res.body.data.items[0].status).toBe("approved");
    });
  });
});
