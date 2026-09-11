import { z } from "zod";

const variantSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, "Variant name is required"),
  attributes: z.record(z.string()).optional().default({}),
  price: z.number().int().positive("Price must be a positive integer in cents"),
  compare_at_price: z.number().int().positive().optional().nullable(),
  weight_grams: z.number().positive().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const createProductSchema = z.object({
  body: z.object({
    category_id: z.string().min(1, "Category ID is required"),
    name: z.string().min(2, "Product name must be at least 2 characters").trim(),
    description: z.string().min(10, "Description must be at least 10 characters"),
    images: z.array(z.string().url()).optional().default([]),
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
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    category_id: z.string().optional(),
    name: z.string().min(2).optional(),
    description: z.string().min(10).optional(),
    tags: z.array(z.string()).optional(),
    attributes: z
      .array(
        z.object({
          name: z.string().min(1),
          value: z.string().min(1),
        })
      )
      .optional(),
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
