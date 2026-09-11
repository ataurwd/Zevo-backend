import { z } from "zod";

const storeAddressSchema = z.object({
  line1: z.string().min(1, "Street address is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postal_code: z.string().min(1, "Postal code is required"),
  country: z.string().min(2, "Country code is required"),
});

export const createStoreSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Store name must be at least 2 characters").trim(),
    description: z.string().optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().optional(),
    address: storeAddressSchema,
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      })
      .optional(),
  }),
});

export const updateStoreSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().optional(),
    address: storeAddressSchema.optional(),
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      })
      .optional(),
    is_open: z.boolean().optional(),
  }),
});
