import { Router } from "express";
import { withdrawalsController } from "./withdrawals.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";

const router = Router();

router.use(authenticate);

// Seller withdrawal endpoints
router.post("/request", authorize("SELLER", "ADMIN", "SUPER_ADMIN"), withdrawalsController.requestWithdrawal);
router.get("/seller", authorize("SELLER", "ADMIN", "SUPER_ADMIN"), withdrawalsController.getMyWithdrawals);

// Admin withdrawal moderation endpoints
router.get("/admin", authorize("ADMIN", "SUPER_ADMIN"), withdrawalsController.adminList);
router.patch("/admin/:id/approve", authorize("ADMIN", "SUPER_ADMIN"), withdrawalsController.adminApprove);
router.patch("/admin/:id/reject", authorize("ADMIN", "SUPER_ADMIN"), withdrawalsController.adminReject);

export const withdrawalsRouter = router;
