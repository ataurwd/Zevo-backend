import { z } from "zod";

export const addItemSchema = z.object({
  body: z.object({
    product_id: z.string().min(1, "Product ID is required"),
    variant_id: z.string().min(1, "Variant ID is required"),
    quantity: z
      .number()
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1"),
  }),
});

export const updateQuantitySchema = z.object({
  body: z.object({
    quantity: z
      .number()
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1"),
  }),
});

export const applyCouponSchema = z.object({
  body: z.object({
    code: z.string().min(1, "Coupon code is required").trim().toUpperCase(),
  }),
});

export const mergeCartSchema = z.object({
  body: z.object({
    guest_session_token: z.string().min(1, "Guest session token is required"),
  }),
});
