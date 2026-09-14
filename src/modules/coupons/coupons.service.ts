import { ObjectId } from "mongodb";
import { couponsRepository, CouponsRepository } from "./coupons.repository";
import {
  Coupon,
  CreateCouponDTO,
  ValidateCouponDTO,
  CouponValidationResult,
} from "./coupons.types";

export class CouponsService {
  constructor(private repo: CouponsRepository = couponsRepository) {}

  async createCoupon(sellerId: string | null, dto: CreateCouponDTO): Promise<Coupon> {
    const code = dto.code.toUpperCase().trim();
    const existing = await this.repo.findByCode(code);
    if (existing) {
      throw new Error(`Coupon with code "${code}" already exists`);
    }

    const sellerObjId = sellerId ? new ObjectId(sellerId) : null;
    const now = new Date();

    const coupon: Omit<Coupon, "_id"> = {
      code,
      seller_id: sellerObjId,
      discount_type: dto.discount_type,
      discount_value: dto.discount_value,
      min_order_value: dto.min_order_value || 0,
      max_discount: dto.max_discount || null,
      usage_limit: dto.usage_limit || 100,
      usage_count: 0,
      is_active: true,
      expires_at: new Date(dto.expires_at),
      created_at: now,
      updated_at: now,
    };

    return this.repo.create(coupon);
  }

  async validateCoupon(dto: ValidateCouponDTO): Promise<CouponValidationResult> {
    const code = dto.code.toUpperCase().trim();
    const coupon = await this.repo.findByCode(code);

    if (!coupon || !coupon.is_active) {
      return { valid: false, code, discount_amount: 0, message: "Invalid or inactive coupon code" };
    }

    if (new Date() > new Date(coupon.expires_at)) {
      return { valid: false, code, discount_amount: 0, message: "Coupon has expired" };
    }

    if (coupon.usage_count >= coupon.usage_limit) {
      return { valid: false, code, discount_amount: 0, message: "Coupon usage limit reached" };
    }

    if (dto.order_amount < coupon.min_order_value) {
      const minDollar = (coupon.min_order_value / 100).toFixed(2);
      return {
        valid: false,
        code,
        discount_amount: 0,
        message: `Order must be at least $${minDollar} to use this coupon`,
      };
    }

    if (coupon.seller_id && dto.seller_id) {
      const couponSellerId = coupon.seller_id.toString();
      if (couponSellerId !== dto.seller_id) {
        return {
          valid: false,
          code,
          discount_amount: 0,
          message: "Coupon is not applicable to items from this seller",
        };
      }
    }

    let discount = 0;
    if (coupon.discount_type === "percentage") {
      discount = Math.round((dto.order_amount * coupon.discount_value) / 100);
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount;
      }
    } else {
      discount = Math.min(dto.order_amount, coupon.discount_value);
    }

    return {
      valid: true,
      code: coupon.code,
      discount_amount: discount,
      message: `Coupon applied: saved $${(discount / 100).toFixed(2)}`,
    };
  }

  async getSellerCoupons(sellerId: string): Promise<Coupon[]> {
    const sellerObjId = new ObjectId(sellerId);
    return this.repo.findBySeller(sellerObjId);
  }

  async toggleStatus(id: string, sellerId: string, isActive: boolean): Promise<Coupon> {
    const couponObjId = new ObjectId(id);
    const sellerObjId = new ObjectId(sellerId);

    const coupon = await this.repo.findById(couponObjId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    if (coupon.seller_id && !coupon.seller_id.equals(sellerObjId)) {
      throw new Error("Unauthorized to modify this coupon");
    }

    const updated = await this.repo.toggleActive(couponObjId, isActive);
    if (!updated) {
      throw new Error("Failed to update coupon status");
    }

    return updated;
  }

  async deleteCoupon(id: string, sellerId: string): Promise<boolean> {
    const couponObjId = new ObjectId(id);
    const sellerObjId = new ObjectId(sellerId);

    const coupon = await this.repo.findById(couponObjId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    if (coupon.seller_id && !coupon.seller_id.equals(sellerObjId)) {
      throw new Error("Unauthorized to delete this coupon");
    }

    return this.repo.delete(couponObjId);
  }
}

export const couponsService = new CouponsService();
