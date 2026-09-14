import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";

const router = Router();

router.use(authenticate);

// Seller analytics (seller, admin, super_admin)
router.get("/seller", authorize("SELLER", "ADMIN", "SUPER_ADMIN"), analyticsController.getSellerAnalytics);

// Admin analytics (admin, super_admin)
router.get("/admin", authorize("ADMIN", "SUPER_ADMIN"), analyticsController.getAdminAnalytics);

export const analyticsRouter = router;
