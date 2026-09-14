import { ObjectId } from "mongodb";

export type CouponDiscountType = "percentage" | "fixed";

export interface Coupon {
  _id?: ObjectId | string;
  code: string;
  seller_id?: ObjectId | null; // null for platform-wide coupon
  discount_type: CouponDiscountType;
  discount_value: number; // percentage (e.g. 15 for 15%) or cents (e.g. 1000 for $10)
  min_order_value: number; // cents
  max_discount?: number | null; // cents (for percentage discounts)
  usage_limit: number;
  usage_count: number;
  is_active: boolean;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCouponDTO {
  code: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_value?: number;
  max_discount?: number;
  usage_limit?: number;
  expires_at: string;
}

export interface ValidateCouponDTO {
  code: string;
  order_amount: number; // cents
  seller_id?: string;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discount_amount: number; // cents
  message?: string;
}
