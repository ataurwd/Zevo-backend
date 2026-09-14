import { Router } from "express";
import { OrderController } from "./order.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { createOrderSchema, cancelOrderSchema } from "./order.validator";

const router = Router();

// Seller Routes
router.get(
  "/seller/me",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.listSellerSubOrders
);

router.get(
  "/seller/me/:subOrderId",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.getSellerSubOrder
);

router.patch(
  "/seller/me/:subOrderId/confirm",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.confirmSubOrder
);

router.patch(
  "/seller/me/:subOrderId/preparing",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.prepareSubOrder
);

router.patch(
  "/seller/me/:subOrderId/ready",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.readySubOrder
);

router.patch(
  "/seller/me/:subOrderId/ship",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.shipSubOrder
);

router.patch(
  "/seller/me/:subOrderId/deliver",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.deliverSubOrder
);

router.patch(
  "/seller/me/:subOrderId/cancel",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.cancelSubOrder
);

router.patch(
  "/seller/me/:subOrderId/status",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.updateSubOrderStatusGeneric
);

// Admin Routes
router.get(
  "/admin",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "SUPPORT"),
  OrderController.adminListAllOrders
);

router.get(
  "/admin/sub-orders",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "SUPPORT"),
  OrderController.adminListAllSubOrders
);

router.get(
  "/admin/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "SUPPORT"),
  OrderController.adminGetOrder
);

router.post(
  "/admin/:id/cancel",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  OrderController.adminCancelOrder
);

// Customer Routes
router.post(
  "/",
  authenticate,
  authorize("CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"),
  validate({ body: createOrderSchema }),
  OrderController.createOrder
);

router.get(
  "/",
  authenticate,
  authorize("CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"),
  OrderController.listCustomerOrders
);

router.get(
  "/:id",
  authenticate,
  authorize("CUSTOMER", "SELLER", "DELIVERY_AGENT", "ADMIN", "SUPER_ADMIN"),
  OrderController.getCustomerOrder
);

router.post(
  "/:id/cancel",
  authenticate,
  authorize("CUSTOMER", "SELLER", "ADMIN", "SUPER_ADMIN"),
  validate({ body: cancelOrderSchema }),
  OrderController.cancelOrder
);

export const ordersRouter = router;
