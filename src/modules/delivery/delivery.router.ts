import { Router } from "express";
import { deliveryController } from "./delivery.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";

const router = Router();

// 1. Public / Customer Tracking (Authenticated user or guest token)
router.get("/track/:taskId", authenticate, deliveryController.getTracking);

// 2. Rider Routes (Role: DELIVERY_AGENT or ADMIN)
router.get(
  "/rider/me/profile",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN"),
  deliveryController.getRiderProfile
);

router.patch(
  "/rider/me/status",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN"),
  deliveryController.toggleOnlineStatus
);

router.get(
  "/rider/me/tasks",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN"),
  deliveryController.getMyTasks
);

router.post(
  "/rider/me/location",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN"),
  deliveryController.updateLocation
);

router.patch(
  "/rider/me/tasks/:taskId/pickup",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN"),
  deliveryController.startPickup
);

router.patch(
  "/rider/me/tasks/:taskId/picked-up",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN"),
  deliveryController.confirmPickup
);

router.patch(
  "/rider/me/tasks/:taskId/start-delivery",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN"),
  deliveryController.startDelivery
);

router.patch(
  "/rider/me/tasks/:taskId/deliver",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN"),
  deliveryController.completeDelivery
);

router.patch(
  "/rider/me/tasks/:taskId/fail",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN"),
  deliveryController.failDelivery
);

// 3. Admin Delivery Management
router.get(
  "/admin/riders",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "SUPPORT"),
  deliveryController.adminListRiders
);

router.patch(
  "/admin/riders/:id/status",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  deliveryController.adminUpdateRiderStatus
);

router.get(
  "/admin/tasks",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  deliveryController.adminListTasks
);


// 4. Rider Allocation & Assignment (Admin & Merchant)
router.get(
  "/available-riders",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "SUPPORT"),
  deliveryController.getAvailableRiders
);

router.post(
  "/assign-rider",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "SUPPORT"),
  deliveryController.assignRider
);

router.patch(
  "/rider/me/profile",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN", "SUPER_ADMIN"),
  deliveryController.updateRiderProfile
);


router.post(
  "/rider/me/cashout",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN", "SUPER_ADMIN"),
  deliveryController.requestCashout
);

router.get(
  "/rider/me/payouts",
  authenticate,
  authorize("DELIVERY_AGENT", "ADMIN", "SUPER_ADMIN"),
  deliveryController.getMyPayouts
);

export const deliveryRouter = router;
