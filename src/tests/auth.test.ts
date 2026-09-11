import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { UsersRepository } from "../modules/users/users.repository";
import { AuthRepository } from "../modules/auth/auth.repository";
import { hashPassword } from "../shared/utils/password";
import { generateRefreshToken } from "../shared/utils/jwt";
import { emailQueue } from "../infrastructure/queue/queues";

vi.mock("../infrastructure/queue/queues", () => ({
  emailQueue: {
    add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
  },
  notificationQueue: {
    add: vi.fn().mockResolvedValue({ id: "mock-notification-id" }),
  },
}));

vi.mock("../infrastructure/services/audit.service", () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Authentication API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should successfully register a new user", async () => {
      vi.spyOn(UsersRepository, "findByEmail").mockResolvedValue(null);
      vi.spyOn(UsersRepository, "create").mockResolvedValue({
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0d1"),
        email: "alice@example.com",
        password_hash: "hashed",
        role: "CUSTOMER",
        first_name: "Alice",
        last_name: "Smith",
        is_email_verified: false,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app).post("/api/v1/auth/register").send({
        email: "alice@example.com",
        password: "Password123!",
        first_name: "Alice",
        last_name: "Smith",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe("alice@example.com");
      expect(res.body.data.first_name).toBe("Alice");
      expect(emailQueue.add).toHaveBeenCalledWith(
        "email.verify",
        expect.objectContaining({ to: "alice@example.com" })
      );
    });

    it("should return 409 Conflict if email is already in use", async () => {
      vi.spyOn(UsersRepository, "findByEmail").mockResolvedValue({
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0d1"),
        email: "alice@example.com",
      } as any);

      const res = await request(app).post("/api/v1/auth/register").send({
        email: "alice@example.com",
        password: "Password123!",
        first_name: "Alice",
        last_name: "Smith",
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should login user with correct password and set refresh cookie", async () => {
      const passwordHash = await hashPassword("ValidPassword123!");
      vi.spyOn(UsersRepository, "findByEmail").mockResolvedValue({
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0d1"),
        email: "bob@example.com",
        password_hash: passwordHash,
        role: "SELLER",
        first_name: "Bob",
        last_name: "Jones",
        is_active: true,
        is_email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      vi.spyOn(UsersRepository, "update").mockResolvedValue({} as any);

      const res = await request(app).post("/api/v1/auth/login").send({
        email: "bob@example.com",
        password: "ValidPassword123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.access_token).toBeDefined();
      expect(res.body.data.user.email).toBe("bob@example.com");

      // Check cookie
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain("refresh_token=");
      expect(cookies[0]).toContain("HttpOnly");
    });

    it("should return 401 Unauthorized with incorrect password", async () => {
      const passwordHash = await hashPassword("RealPassword123!");
      vi.spyOn(UsersRepository, "findByEmail").mockResolvedValue({
        _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c0d1"),
        email: "bob@example.com",
        password_hash: passwordHash,
        is_active: true,
      } as any);

      const res = await request(app).post("/api/v1/auth/login").send({
        email: "bob@example.com",
        password: "WrongPassword123!",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should refresh tokens using valid refresh cookie", async () => {
      const userId = "65f1a2b3c4d5e6f7a8b9c0d1";
      const { token: refreshToken } = generateRefreshToken(userId);

      vi.spyOn(AuthRepository, "isTokenBlacklisted").mockResolvedValue(false);
      vi.spyOn(AuthRepository, "blacklistToken").mockResolvedValue(undefined);
      vi.spyOn(UsersRepository, "findById").mockResolvedValue({
        _id: new ObjectId(userId),
        email: "refresh@example.com",
        role: "CUSTOMER",
        first_name: "Ref",
        last_name: "Fresh",
        is_active: true,
        is_email_verified: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refresh_token=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.access_token).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should clear refresh cookie and blacklist token", async () => {
      const userId = "65f1a2b3c4d5e6f7a8b9c0d1";
      const { token: refreshToken } = generateRefreshToken(userId);
      vi.spyOn(AuthRepository, "blacklistToken").mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", [`refresh_token=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const cookies = res.headers["set-cookie"];
      expect(cookies[0]).toContain("refresh_token=;");
    });
  });
});
