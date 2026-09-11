import { Router } from "express";
import { SellersController } from "./sellers.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { onboardSellerSchema, rejectSellerSchema } from "./sellers.validator";

const router = Router();

// Seller Routes (Protected)
router.post(
  "/onboard",
  authenticate,
  validate(onboardSellerSchema),
  asyncHandler(SellersController.onboard)
);

router.get("/me", authenticate, asyncHandler(SellersController.getMe));
router.get("/me/stripe-status", authenticate, asyncHandler(SellersController.getStripeStatus));
router.post("/me/stripe-refresh", authenticate, asyncHandler(SellersController.refreshStripe));
router.post("/me/simulate-onboarding", authenticate, asyncHandler(SellersController.simulateOnboard));

// Admin Moderation Routes
router.get(
  "/admin",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(SellersController.adminList)
);

router.patch(
  "/admin/:id/approve",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(SellersController.adminApprove)
);

router.patch(
  "/admin/:id/reject",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(rejectSellerSchema),
  asyncHandler(SellersController.adminReject)
);

export const sellersRouter = router;
