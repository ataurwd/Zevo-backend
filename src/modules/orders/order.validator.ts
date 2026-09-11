import { z } from "zod";

export const deliveryAddressSchema = z.object({
  recipient_name: z.string().min(2, "Recipient name must be at least 2 characters"),
  phone: z.string().min(5, "Phone number must be at least 5 characters"),
  line1: z.string().min(2, "Address line 1 is required"),
  line2: z.string().optional().nullable(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State/Province is required"),
  postal_code: z.string().min(2, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

export const createOrderSchema = z
  .object({
    address_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid address ID").optional(),
    delivery_address: deliveryAddressSchema.optional(),
    notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
  })
  .refine(
    (data) => !!data.address_id || !!data.delivery_address,
    "Either address_id or delivery_address must be provided"
  );

export const updateSubOrderStatusSchema = z.object({
  status: z.enum(["confirmed", "preparing", "ready_for_pickup"], {
    errorMap: () => ({
      message: "Status must be one of: confirmed, preparing, ready_for_pickup",
    }),
  }),
});

export const cancelOrderSchema = z.object({
  reason: z.string().max(300, "Reason cannot exceed 300 characters").optional(),
});
