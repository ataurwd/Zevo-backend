import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { initiateRefundSchema } from "./payment.validator";

const router = Router();

// Public Webhook endpoint (Stripe signature verification done in handler)
router.post("/webhook", PaymentController.handleWebhook);

// Customer Payment History
router.get(
  "/",
  authenticate,
  authorize("CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"),
  PaymentController.listCustomerPayments
);

router.get(
  "/:id",
  authenticate,
  authorize("CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"),
  PaymentController.getPaymentById
);

// Admin Refund Route
router.post(
  "/admin/:id/refund",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  validate({ body: initiateRefundSchema }),
  PaymentController.adminRefund
);

// Admin List All Payments
router.get(
  "/admin/all",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  PaymentController.adminListAllPayments
);

export const paymentRouter = router;
