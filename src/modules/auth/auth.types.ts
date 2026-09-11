import { ObjectId } from "mongodb";
import { UserRole } from "../../shared/types/express";

export interface UserDocument {
  _id: ObjectId;
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  is_email_verified: boolean;
  email_verification_token?: string | null;
  email_verification_expires?: Date | null;
  password_reset_token?: string | null;
  password_reset_expires?: Date | null;
  is_active: boolean;
  last_login_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  is_email_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: UserRole;
  phone?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
}

export interface LoginResponse {
  user: UserResponse;
  access_token: string;
}
