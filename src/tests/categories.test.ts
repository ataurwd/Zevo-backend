import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { CategoriesRepository } from "../modules/categories/categories.repository";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Categories API Endpoints", () => {
  const adminUserId = "65f1a2b3c4d5e6f7a8b9c0d9";
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = generateAccessToken({
      id: adminUserId,
      email: "admin@nexora.com",
      role: "ADMIN",
    }).token;
  });

  describe("GET /api/v1/categories", () => {
    it("should return the hierarchical category tree", async () => {
      const rootId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0c1");
      const childId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0c2");

      vi.spyOn(CategoriesRepository, "findAllActive").mockResolvedValue([
        {
          _id: rootId,
          name: "Electronics",
          slug: "electronics",
          parent_id: null,
          is_active: true,
          sort_order: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          _id: childId,
          name: "Smartphones",
          slug: "smartphones",
          parent_id: rootId,
          is_active: true,
          sort_order: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const res = await request(app).get("/api/v1/categories");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe("Electronics");
      expect(res.body.data[0].children.length).toBe(1);
      expect(res.body.data[0].children[0].name).toBe("Smartphones");
    });
  });

  describe("POST /api/v1/categories", () => {
    it("should allow admin to create a category", async () => {
      vi.spyOn(CategoriesRepository, "findBySlug").mockResolvedValue(null);
      vi.spyOn(CategoriesRepository, "create").mockResolvedValue({
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0c3"),
        name: "Fashion",
        slug: "fashion",
        parent_id: null,
        is_active: true,
        sort_order: 2,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/categories")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Fashion",
          sort_order: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Fashion");
    });
  });
});
