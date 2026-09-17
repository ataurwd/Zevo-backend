import { z } from "zod";

const variantSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, "Variant name is required"),
  attributes: z.record(z.string()).optional().default({}),
  price: z.number().int().positive("Price must be a positive integer in cents"),
  compare_at_price: z.number().int().positive().optional().nullable(),
  weight_grams: z.number().positive().optional().nullable(),
  quantity: z.number().int().nonnegative().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const createProductSchema = z.object({
  body: z.object({
    category_id: z.string().min(1, "Category ID is required"),
    name: z.string().min(2, "Product name must be at least 2 characters").trim(),
    description: z.string().min(5, "Description must be at least 5 characters"),
    images: z.array(z.string()).max(5, "A product can have a maximum of 5 images").optional().default([]),
    tags: z.array(z.string()).optional().default([]),
    attributes: z
      .array(
        z.object({
          name: z.string().min(1),
          value: z.string().min(1),
        })
      )
      .optional()
      .default([]),
    variants: z.array(variantSchema).min(1, "At least one product variant is required"),
    shipping: z.any().optional().nullable(),
    selling_type: z.enum(["in_store", "online", "both"]).optional().nullable(),
    inventory_quantity: z.number().int().nonnegative().optional().nullable(),
    sku: z.string().optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    category_id: z.string().optional(),
    name: z.string().min(2).optional(),
    description: z.string().min(5).optional(),
    images: z.array(z.string()).max(5, "A product can have a maximum of 5 images").optional(),
    tags: z.array(z.string()).optional(),
    attributes: z
      .array(
        z.object({
          name: z.string().min(1),
          value: z.string().min(1),
        })
      )
      .optional(),
    variants: z.array(variantSchema).optional(),
    shipping: z.any().optional().nullable(),
    selling_type: z.enum(["in_store", "online", "both"]).optional().nullable(),
    inventory_quantity: z.number().int().nonnegative().optional().nullable(),
    sku: z.string().optional(),
    base_price: z.number().optional().nullable(),
    compare_at_price: z.number().optional().nullable(),
    status: z.enum(["draft", "pending_review", "approved", "rejected", "suspended"]).optional(),
  }),
});

export const addVariantSchema = z.object({
  body: variantSchema,
});

export const updateVariantSchema = z.object({
  body: variantSchema.partial(),
});

export const rejectProductSchema = z.object({
  body: z.object({
    reason: z.string().min(5, "Rejection reason is required"),
  }),
});
