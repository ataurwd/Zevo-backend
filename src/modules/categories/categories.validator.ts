import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, "Category name must be at least 2 characters").trim(),
    parent_id: z.string().optional().nullable(),
    image_url: z.string().url().optional(),
    sort_order: z.number().int().optional().default(0),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    parent_id: z.string().optional().nullable(),
    image_url: z.string().url().optional().nullable(),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
  }),
});
