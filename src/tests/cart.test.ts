import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { ProductsRepository } from "../modules/products/products.repository";
import { InventoryRepository } from "../modules/inventory/inventory.repository";
import { CartService } from "../modules/cart/cart.service";
import { generateAccessToken } from "../shared/utils/jwt";

// In-memory Redis simulation for tests
const redisMap = new Map<string, string>();

vi.mock("../infrastructure/redis/client", () => ({
  getRedisClient: () => ({
    status: "ready",
    get: vi.fn(async (key: string) => redisMap.get(key) || null),
    set: vi.fn(async (key: string, val: string) => {
      redisMap.set(key, val);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      redisMap.delete(key);
      return 1;
    }),
  }),
}));

describe("Cart API Endpoints", () => {
  const customerUserId = "65f1a2b3c4d5e6f7a8b9c0c9";
  const storeId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0bb");
  const sellerId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0aa");
  const productId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0e1");
  const variantId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0f1");

  let customerToken: string;

  const mockProduct = {
    _id: productId,
    store_id: storeId,
    seller_id: sellerId,
    category_id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0c1"),
    name: "Wireless ANC Headphones",
    slug: "wireless-anc-headphones",
    status: "approved" as const,
    images: ["https://images.nexora.com/headphones.jpg"],
    variants: [
      {
        _id: variantId,
        sku: "HP-BLK-001",
        name: "Matte Black",
        price: 15000, // $150.00
        is_active: true,
      },
    ],
  };

  const mockInventory = {
    _id: new ObjectId(),
    product_id: productId,
    variant_id: variantId,
    sku: "HP-BLK-001",
    quantity_available: 20,
    quantity_reserved: 0,
    low_stock_threshold: 5,
    is_trackable: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    redisMap.clear();
    CartService.clearInMemoryStore();

    customerToken = generateAccessToken({
      id: customerUserId,
      email: "shopper@nexora.com",
      role: "CUSTOMER",
    }).token;
  });

  describe("GET /api/v1/cart", () => {
    it("should return an empty cart when initialized", async () => {
      const res = await request(app)
        .get("/api/v1/cart")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.subtotal).toBe(0);
      expect(res.body.data.total).toBe(0);
    });
  });

  describe("POST /api/v1/cart/items", () => {
    it("should add an approved product variant to the cart", async () => {
      vi.spyOn(ProductsRepository, "findById").mockResolvedValue(mockProduct as any);
      vi.spyOn(InventoryRepository, "findByVariantId").mockResolvedValue(mockInventory as any);

      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          product_id: productId.toHexString(),
          variant_id: variantId.toHexString(),
          quantity: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].name).toBe("Wireless ANC Headphones");
      expect(res.body.data.items[0].quantity).toBe(2);
      expect(res.body.data.items[0].price).toBe(15000);
      expect(res.body.data.subtotal).toBe(30000); // $300.00
      expect(res.body.data.total).toBe(30000);
    });

    it("should reject adding item when requested quantity exceeds stock", async () => {
      vi.spyOn(ProductsRepository, "findById").mockResolvedValue(mockProduct as any);
      vi.spyOn(InventoryRepository, "findByVariantId").mockResolvedValue({
        ...mockInventory,
        quantity_available: 3,
      } as any);

      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          product_id: productId.toHexString(),
          variant_id: variantId.toHexString(),
          quantity: 5, // Available is only 3
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("Insufficient stock");
    });
  });

  describe("PATCH /api/v1/cart/items/:variantId", () => {
    it("should update quantity of an item in cart", async () => {
      vi.spyOn(ProductsRepository, "findById").mockResolvedValue(mockProduct as any);
      vi.spyOn(InventoryRepository, "findByVariantId").mockResolvedValue(mockInventory as any);

      // Add item first
      await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          product_id: productId.toHexString(),
          variant_id: variantId.toHexString(),
          quantity: 1,
        });

      // Update quantity to 4
      const res = await request(app)
        .patch(`/api/v1/cart/items/${variantId.toHexString()}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          quantity: 4,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].quantity).toBe(4);
      expect(res.body.data.subtotal).toBe(60000);
    });
  });

  describe("POST /api/v1/cart/apply-coupon", () => {
    it("should apply valid discount coupon and reduce total", async () => {
      vi.spyOn(ProductsRepository, "findById").mockResolvedValue(mockProduct as any);
      vi.spyOn(InventoryRepository, "findByVariantId").mockResolvedValue(mockInventory as any);

      // Add item ($150)
      await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          product_id: productId.toHexString(),
          variant_id: variantId.toHexString(),
          quantity: 1,
        });

      // Apply WELCOME10 (10% discount on $150 = $15 discount)
      const res = await request(app)
        .post("/api/v1/cart/apply-coupon")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          code: "WELCOME10",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subtotal).toBe(15000);
      expect(res.body.data.discount).toBe(1500); // 10%
      expect(res.body.data.total).toBe(13500); // $135.00
      expect(res.body.data.coupon.code).toBe("WELCOME10");
    });
  });

  describe("DELETE /api/v1/cart/items/:variantId", () => {
    it("should remove item from cart", async () => {
      vi.spyOn(ProductsRepository, "findById").mockResolvedValue(mockProduct as any);
      vi.spyOn(InventoryRepository, "findByVariantId").mockResolvedValue(mockInventory as any);

      await request(app)
        .post("/api/v1/cart/items")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          product_id: productId.toHexString(),
          variant_id: variantId.toHexString(),
          quantity: 1,
        });

      const res = await request(app)
        .delete(`/api/v1/cart/items/${variantId.toHexString()}`)
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(0);
      expect(res.body.data.subtotal).toBe(0);
    });
  });
});
