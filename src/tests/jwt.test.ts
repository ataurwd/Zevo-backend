import { describe, it, expect } from "vitest";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../shared/utils/jwt";

describe("JWT Utility", () => {
  it("should generate and verify an access token with custom claims", () => {
    const user = {
      id: "user_12345",
      email: "test@nexora.com",
      role: "CUSTOMER" as const,
    };

    const { token, jti } = generateAccessToken(user);
    expect(token).toBeDefined();
    expect(jti).toBeDefined();

    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user_12345");
    expect(payload.email).toBe("test@nexora.com");
    expect(payload.role).toBe("CUSTOMER");
    expect(payload.jti).toBe(jti);
  });

  it("should generate and verify a refresh token", () => {
    const userId = "user_67890";
    const { token, jti } = generateRefreshToken(userId);
    expect(token).toBeDefined();

    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe(userId);
    expect(payload.jti).toBe(jti);
  });

  it("should throw error for an invalid token signature", () => {
    expect(() => verifyAccessToken("invalid.jwt.token")).toThrow();
    expect(() => verifyRefreshToken("invalid.jwt.token")).toThrow();
  });
});
