import { z } from "zod";

export const onboardSellerSchema = z.object({
  body: z.object({
    business_name: z.string().min(2, "Business name must be at least 2 characters").trim(),
    business_type: z.enum(["individual", "company"]).default("individual"),
    tax_id: z.string().optional(),
  }),
});

export const rejectSellerSchema = z.object({
  body: z.object({
    reason: z.string().min(5, "Rejection reason must be at least 5 characters"),
  }),
});
