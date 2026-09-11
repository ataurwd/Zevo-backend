import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { UsersRepository } from "../modules/users/users.repository";
import { AddressesRepository } from "../modules/users/addresses.repository";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Users & Addresses API Endpoints", () => {
  const userId = "65f1a2b3c4d5e6f7a8b9c0d1";
  const userObjectId = new ObjectId(userId);
  let authToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    const tokenResult = generateAccessToken({
      id: userId,
      email: "user@nexora.com",
      role: "CUSTOMER",
    });
    authToken = tokenResult.token;
  });

  describe("GET /api/v1/users/me", () => {
    it("should return 401 Unauthorized without token", async () => {
      const res = await request(app).get("/api/v1/users/me");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return authenticated user profile", async () => {
      vi.spyOn(UsersRepository, "findById").mockResolvedValue({
        _id: userObjectId,
        email: "user@nexora.com",
        role: "CUSTOMER",
        first_name: "John",
        last_name: "Doe",
        is_active: true,
        is_email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe("user@nexora.com");
      expect(res.body.data.first_name).toBe("John");
    });
  });

  describe("PATCH /api/v1/users/me", () => {
    it("should update user profile details", async () => {
      vi.spyOn(UsersRepository, "update").mockResolvedValue({
        _id: userObjectId,
        email: "user@nexora.com",
        role: "CUSTOMER",
        first_name: "Johnny",
        last_name: "Updated",
        phone: "+1234567890",
        is_active: true,
        is_email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          first_name: "Johnny",
          last_name: "Updated",
          phone: "+1234567890",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe("Johnny");
      expect(res.body.data.phone).toBe("+1234567890");
    });
  });

  describe("Address Book Endpoints", () => {
    it("should create a new address", async () => {
      const addressId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0d2");
      vi.spyOn(AddressesRepository, "create").mockResolvedValue({
        _id: addressId,
        user_id: userObjectId,
        label: "Home",
        recipient_name: "John Doe",
        phone: "+1234567890",
        line1: "123 Market Street",
        city: "San Francisco",
        state: "CA",
        postal_code: "94105",
        country: "USA",
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/users/me/addresses")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          label: "Home",
          recipient_name: "John Doe",
          phone: "+1234567890",
          line1: "123 Market Street",
          city: "San Francisco",
          state: "CA",
          postal_code: "94105",
          country: "USA",
          is_default: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.line1).toBe("123 Market Street");
      expect(res.body.data.is_default).toBe(true);
    });

    it("should list user addresses", async () => {
      const addressId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0d2");
      vi.spyOn(AddressesRepository, "findByUserId").mockResolvedValue([
        {
          _id: addressId,
          user_id: userObjectId,
          label: "Work",
          recipient_name: "John Doe",
          phone: "+1234567890",
          line1: "500 Howard Street",
          city: "San Francisco",
          state: "CA",
          postal_code: "94105",
          country: "USA",
          is_default: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const res = await request(app)
        .get("/api/v1/users/me/addresses")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].label).toBe("Work");
    });

    it("should delete an address", async () => {
      vi.spyOn(AddressesRepository, "delete").mockResolvedValue(true);

      const res = await request(app)
        .delete("/api/v1/users/me/addresses/65f1a2b3c4d5e6f7a8b9c0d2")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
    });
  });
});
