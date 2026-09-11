import { z } from "zod";

export const updateStockSchema = z.object({
  body: z.object({
    quantity_change: z
      .number()
      .int("Quantity change must be an integer")
      .refine((val) => val !== 0, "Quantity change cannot be zero"),
    type: z.enum(["restock", "adjustment"]),
    note: z.string().max(255).optional(),
  }),
});

export const setThresholdSchema = z.object({
  body: z.object({
    low_stock_threshold: z
      .number()
      .int("Threshold must be an integer")
      .min(0, "Threshold cannot be negative"),
  }),
});
