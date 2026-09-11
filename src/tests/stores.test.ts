import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { StoresRepository } from "../modules/stores/stores.repository";
import { SellersRepository } from "../modules/sellers/sellers.repository";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Stores API Endpoints", () => {
  const sellerUserId = "65f1a2b3c4d5e6f7a8b9c0d1";
  const sellerObjectId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0aa");
  let sellerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    sellerToken = generateAccessToken({
      id: sellerUserId,
      email: "seller@nexora.com",
      role: "SELLER",
    }).token;
  });

  describe("POST /api/v1/stores", () => {
    it("should allow an approved seller to create a storefront", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
        _id: sellerObjectId,
        user_id: new ObjectId(sellerUserId),
        status: "approved",
      } as any);

      vi.spyOn(StoresRepository, "findBySellerId").mockResolvedValue(null);
      vi.spyOn(StoresRepository, "findBySlug").mockResolvedValue(null);
      vi.spyOn(StoresRepository, "create").mockResolvedValue({
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0bb"),
        seller_id: sellerObjectId,
        name: "Apex Store",
        slug: "apex-store",
        description: "Best tech gadgets",
        address: {
          line1: "123 Tech Blvd",
          city: "Austin",
          state: "TX",
          postal_code: "78701",
          country: "US",
        },
        rating_avg: 0,
        rating_count: 0,
        is_open: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/stores")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          name: "Apex Store",
          description: "Best tech gadgets",
          address: {
            line1: "123 Tech Blvd",
            city: "Austin",
            state: "TX",
            postal_code: "78701",
            country: "US",
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe("apex-store");
    });

    it("should reject store creation if seller is not yet approved", async () => {
      vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
        _id: sellerObjectId,
        user_id: new ObjectId(sellerUserId),
        status: "pending",
      } as any);

      const res = await request(app)
        .post("/api/v1/stores")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({
          name: "Apex Store",
          address: {
            line1: "123 Tech Blvd",
            city: "Austin",
            state: "TX",
            postal_code: "78701",
            country: "US",
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/stores/:slug", () => {
    it("should return store details publicly", async () => {
      vi.spyOn(StoresRepository, "findBySlug").mockResolvedValue({
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0bb"),
        seller_id: sellerObjectId,
        name: "Apex Store",
        slug: "apex-store",
        address: {
          line1: "123 Tech Blvd",
          city: "Austin",
          state: "TX",
          postal_code: "78701",
          country: "US",
        },
        rating_avg: 4.8,
        rating_count: 15,
        is_open: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app).get("/api/v1/stores/apex-store");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe("apex-store");
      expect(res.body.data.rating_avg).toBe(4.8);
    });
  });
});
