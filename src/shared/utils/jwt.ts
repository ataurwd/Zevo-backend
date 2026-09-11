import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserRole } from "../types/express";

export interface TokenUserPayload {
  id: string;
  email: string;
  role: UserRole;
  storeId?: string;
  deliveryAgentId?: string;
}

export interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti: string;
  storeId?: string;
  deliveryAgentId?: string;
}

export interface RefreshTokenPayload extends jwt.JwtPayload {
  sub: string;
  jti: string;
}

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

const getAccessSecret = (): string =>
  process.env.JWT_ACCESS_SECRET || "nexora_super_secret_jwt_access_key_dev_mode_32char!";

const getRefreshSecret = (): string =>
  process.env.JWT_REFRESH_SECRET || "nexora_super_secret_jwt_refresh_key_dev_mode_32char!";

export function generateAccessToken(user: TokenUserPayload): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
      ...(user.storeId ? { storeId: user.storeId } : {}),
      ...(user.deliveryAgentId ? { deliveryAgentId: user.deliveryAgentId } : {}),
    },
    getAccessSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
  return { token, jti };
}

export function generateRefreshToken(userId: string): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: userId,
      jti,
    },
    getRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getAccessSecret()) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getRefreshSecret()) as RefreshTokenPayload;
}
