import { z } from "zod";

export const initiateRefundSchema = z.object({
  amount: z.number().int().positive("Refund amount must be a positive integer in cents").optional(),
  reason: z.enum(["customer_request", "duplicate", "fraud", "defective"], {
    errorMap: () => ({
      message: "Reason must be one of: customer_request, duplicate, fraud, defective",
    }),
  }),
  sub_order_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid sub_order_id").optional(),
});
