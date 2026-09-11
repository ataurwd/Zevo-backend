import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../shared/utils/password";

describe("Password Utility", () => {
  it("should hash a password and verify it correctly", async () => {
    const raw = "SuperSecret123!";
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith("$2")).toBe(true);

    const match = await comparePassword(raw, hash);
    expect(match).toBe(true);

    const wrongMatch = await comparePassword("WrongPassword!", hash);
    expect(wrongMatch).toBe(false);
  });
});
