import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validate } from "../../shared/middleware/validate";
import { authenticate } from "../../shared/middleware/authenticate";
import { authRateLimiter } from "../../shared/middleware/rateLimiter";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validator";

const router = Router();

router.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  asyncHandler(AuthController.register)
);

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  asyncHandler(AuthController.verifyEmail)
);

router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(AuthController.login)
);

router.post("/refresh", asyncHandler(AuthController.refresh));

router.post("/logout", asyncHandler(AuthController.logout));

router.post(
  "/forgot-password",
  authRateLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword)
);

router.post(
  "/reset-password",
  authRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword)
);

router.get("/me", authenticate, asyncHandler(AuthController.me));

export const authRouter = router;
