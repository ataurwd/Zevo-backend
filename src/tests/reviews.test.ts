import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { reviewsRepository } from "../modules/reviews/reviews.repository";
import { couponsRepository } from "../modules/coupons/coupons.repository";
import { OrderRepository } from "../modules/orders/order.repository";
import { ProductsRepository } from "../modules/products/products.repository";
import { SellersRepository } from "../modules/sellers/sellers.repository";
import { generateAccessToken } from "../shared/utils/jwt";
import { Review } from "../modules/reviews/reviews.types";
import { Coupon } from "../modules/coupons/coupons.types";

describe("Phase 13: Reviews & Coupons API Endpoints", () => {
  const userId = "65f1a2b3c4d5e6f7a8b9c401";
  const sellerUserId = "65f1a2b3c4d5e6f7a8b9c402";
  const sellerId = new ObjectId("65f1a2b3c4d5e6f7a8b9c403");
  const productId = new ObjectId("65f1a2b3c4d5e6f7a8b9c404");
  const orderId = new ObjectId("65f1a2b3c4d5e6f7a8b9c405");
  const subOrderId = new ObjectId("65f1a2b3c4d5e6f7a8b9c406");
  const reviewId = new ObjectId("65f1a2b3c4d5e6f7a8b9c407");
  const couponId = new ObjectId("65f1a2b3c4d5e6f7a8b9c408");

  let customerToken: string;
  let sellerToken: string;

  const mockReview: Review = {
    _id: reviewId,
    user_id: new ObjectId(userId),
    user_name: "Happy Customer",
    product_id: productId,
    order_id: orderId,
    sub_order_id: subOrderId,
    seller_id: sellerId,
    rating: 5,
    title: "Awesome product!",
    comment: "Exceeded my expectations, fast shipping!",
    images: [],
    seller_reply: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockCoupon: Coupon = {
    _id: couponId,
    code: "SAVE20",
    seller_id: sellerId,
    discount_type: "percentage",
    discount_value: 20,
    min_order_value: 5000, // $50
    max_discount: 2000, // $20
    usage_limit: 100,
    usage_count: 5,
    is_active: true,
    expires_at: new Date(Date.now() + 86400000 * 30),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    customerToken = generateAccessToken({
      id: userId,
      email: "customer@nexora.com",
      role: "CUSTOMER",
    }).token;

    sellerToken = generateAccessToken({
      id: sellerUserId,
      email: "seller@nexora.com",
      role: "SELLER",
    }).token;
  });

  describe("POST /api/v1/reviews", () => {
    it("should allow customer to create a review on a delivered product", async () => {
      vi.spyOn(reviewsRepository, "findExistingUserReview").mockResolvedValue(null);
      vi.spyOn(reviewsRepository, "findDeliveredSubOrder").mockResolvedValue({
        _id: subOrderId,
        order_id: orderId,
        seller_id: sellerId,
        status: "delivered",
        items: [{ product_id: productId.toString() }],
      } as any);

      vi.spyOn(reviewsRepository, "create").mockResolvedValue(mockReview);
      vi.spyOn(reviewsRepository, "calculateProductRatingStats").mockResolvedValue({
        averageRating: 4.8,
        totalCount: 10,
      });
      vi.spyOn(ProductsRepository, "update").mockResolvedValue({} as any);

      const res = await request(app)
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          product_id: productId.toString(),
          order_id: orderId.toString(),
          sub_order_id: subOrderId.toString(),
          rating: 5,
          comment: "Exceeded my expectations, fast shipping!",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(5);
    });

    it("should reject review if sub-order is not delivered", async () => {
      vi.spyOn(reviewsRepository, "findExistingUserReview").mockResolvedValue(null);
      vi.spyOn(reviewsRepository, "findDeliveredSubOrder").mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          product_id: productId.toString(),
          order_id: orderId.toString(),
          sub_order_id: subOrderId.toString(),
          rating: 5,
          comment: "Testing undelivered",
        });

      expect(res.status).toBe(500); // Or 400 error caught by next(err)
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/reviews/products/:productId", () => {
    it("should return product reviews publicly", async () => {
      vi.spyOn(reviewsRepository, "findByProduct").mockResolvedValue({
        reviews: [mockReview],
        total: 1,
      });

      const res = await request(app).get(`/api/v1/reviews/products/${productId.toString()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reviews).toHaveLength(1);
    });
  });

  describe("POST /api/v1/coupons/validate", () => {
    it("should validate and compute coupon discount correctly", async () => {
      vi.spyOn(couponsRepository, "findByCode").mockResolvedValue(mockCoupon);

      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .send({
          code: "SAVE20",
          order_amount: 8000, // $80 -> 20% is $16 (1600 cents)
          seller_id: sellerId.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.discount_amount).toBe(1600);
    });

    it("should reject coupon if order is below minimum order value", async () => {
      vi.spyOn(couponsRepository, "findByCode").mockResolvedValue(mockCoupon);

      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .send({
          code: "SAVE20",
          order_amount: 3000, // $30 < $50 min
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.message).toContain("Order must be at least");
    });
  });

  describe("POST /api/v1/coupons", () => {
    it("should allow seller to create a coupon code", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
        _id: sellerId,
        user_id: new ObjectId(sellerUserId),
      } as any);
      vi.spyOn(couponsRepository, "findByCode").mockResolvedValue(null);
      vi.spyOn(couponsRepository, "create").mockResolvedValue(mockCoupon);

      const res = await request(app)
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          code: "SAVE20",
          discount_type: "percentage",
          discount_value: 20,
          min_order_value: 5000,
          max_discount: 2000,
          usage_limit: 100,
          expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe("SAVE20");
    });
  });
});
