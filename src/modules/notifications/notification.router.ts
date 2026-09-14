import { Router } from "express";
import { notificationController } from "./notification.controller";
import { authenticate } from "../../shared/middleware/authenticate";

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.get("/", notificationController.getNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);

export const notificationRouter = router;
