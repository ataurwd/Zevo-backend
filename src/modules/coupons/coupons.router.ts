import { Router } from "express";
import { couponsController } from "./coupons.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";

const router = Router();

// Public / customer coupon validation (used at cart & checkout)
router.post("/validate", couponsController.validateCoupon);

// Protected seller / admin coupon routes
router.post("/", authenticate, authorize("SELLER", "ADMIN", "SUPER_ADMIN"), couponsController.createCoupon);
router.get("/seller", authenticate, authorize("SELLER", "ADMIN", "SUPER_ADMIN"), couponsController.getMyCoupons);
router.patch("/:id/status", authenticate, authorize("SELLER", "ADMIN", "SUPER_ADMIN"), couponsController.toggleStatus);
router.delete("/:id", authenticate, authorize("SELLER", "ADMIN", "SUPER_ADMIN"), couponsController.deleteCoupon);

export const couponsRouter = router;
