import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").toLowerCase().trim(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit"),
    first_name: z.string().min(1, "First name is required").trim(),
    last_name: z.string().min(1, "Last name is required").trim(),
    role: z
      .enum(["CUSTOMER", "SELLER", "DELIVERY_AGENT"])
      .optional()
      .default("CUSTOMER"),
    phone: z.string().optional(),
    business_name: z.string().optional(),
    delivery_zones: z.array(z.string()).optional(),
    service_city: z.string().optional(),
    vehicle_type: z.enum(["bicycle", "motorcycle", "scooter", "car"]).optional(),
    vehicle_number: z.string().optional(),
    license_number: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").toLowerCase().trim(),
    password: z.string().min(1, "Password is required"),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Verification token is required"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").toLowerCase().trim(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit"),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(8, "New password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit"),
  }),
});
