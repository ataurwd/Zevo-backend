import { z } from "zod";

export const updateProfileSchema = z.object({
  body: z.object({
    first_name: z.string().min(1, "First name is required").optional(),
    last_name: z.string().min(1, "Last name is required").optional(),
    phone: z.string().optional(),
  }),
});

export const changeUserPasswordSchema = z.object({
  body: z.object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit"),
  }),
});

export const createAddressSchema = z.object({
  body: z.object({
    label: z.string().optional(),
    recipient_name: z.string().min(1, "Recipient name is required"),
    phone: z.string().min(1, "Phone number is required"),
    line1: z.string().min(1, "Address line 1 is required"),
    line2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State or Province is required"),
    postal_code: z.string().min(1, "Postal code is required"),
    country: z.string().min(1, "Country is required"),
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      })
      .optional(),
    is_default: z.boolean().optional().default(false),
  }),
});

export const updateAddressSchema = z.object({
  body: z.object({
    label: z.string().optional(),
    recipient_name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    line1: z.string().min(1).optional(),
    line2: z.string().optional(),
    city: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    postal_code: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      })
      .optional(),
    is_default: z.boolean().optional(),
  }),
});


export const adminCreateUserSchema = z.object({
  body: z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    role: z.enum(["CUSTOMER", "SELLER", "RIDER", "DELIVERY_AGENT", "ADMIN", "SUPER_ADMIN", "SUPPORT"]),
    phone: z.string().optional(),
    password: z.string().min(6).optional(),
    service_city: z.string().optional(),
    delivery_zones: z.array(z.string()).optional(),
  }),
});

export const adminUpdateUserSchema = z.object({
  body: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    role: z.enum(["CUSTOMER", "SELLER", "RIDER", "DELIVERY_AGENT", "ADMIN", "SUPER_ADMIN", "SUPPORT"]).optional(),
    phone: z.string().optional(),
    is_active: z.boolean().optional(),
  }),
});
