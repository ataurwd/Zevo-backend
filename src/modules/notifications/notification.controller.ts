import { Request, Response, NextFunction } from "express";
import { notificationService, NotificationService } from "./notification.service";

export class NotificationController {
  constructor(private service: NotificationService = notificationService) {}

  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const is_read =
        req.query.is_read !== undefined ? req.query.is_read === "true" : undefined;
      const type = req.query.type as any;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;

      const result = await this.service.getUserNotifications(userId, {
        is_read,
        type,
        limit,
        skip,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const unreadCount = await this.service.getUnreadCount(userId);

      return res.status(200).json({
        success: true,
        data: { unreadCount },
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { id } = req.params;

      const success = await this.service.markAsRead(id, userId);

      return res.status(200).json({
        success,
        message: success ? "Notification marked as read" : "Notification not found",
      });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const count = await this.service.markAllAsRead(userId);

      return res.status(200).json({
        success: true,
        data: { markedCount: count },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user._id || (req as any).user.id;
      const { id } = req.params;

      const success = await this.service.deleteNotification(id, userId);

      return res.status(200).json({
        success,
        message: success ? "Notification deleted" : "Notification not found",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const notificationController = new NotificationController();
