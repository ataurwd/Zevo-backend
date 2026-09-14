import { notificationRepository, NotificationRepository } from "./notification.repository";
import { CreateNotificationDTO, Notification, NotificationFilter } from "./notification.types";
import { isSocketInitialized, getIO } from "../../infrastructure/socket/io";
import { logger } from "../../infrastructure/logger";

export class NotificationService {
  constructor(private repo: NotificationRepository = notificationRepository) {}

  async createNotification(data: CreateNotificationDTO): Promise<Notification> {
    const notification = await this.repo.create(data);

    // Broadcast via Socket.IO if active
    try {
      if (isSocketInitialized()) {
        const io = getIO();
        io.to(`user:${data.user_id}`).emit("notification:new", notification);
        logger.debug(
          { userId: data.user_id, type: data.type },
          "Dispatched real-time notification to user room"
        );
      }
    } catch (err) {
      logger.warn({ err }, "Could not emit socket notification (socket server not ready)");
    }

    return notification;
  }

  async getUserNotifications(
    userId: string,
    filter: NotificationFilter = {}
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const [result, unreadCount] = await Promise.all([
      this.repo.findByUser(userId, filter),
      this.repo.getUnreadCount(userId),
    ]);

    return {
      notifications: result.notifications,
      total: result.total,
      unreadCount,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.getUnreadCount(userId);
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const success = await this.repo.markAsRead(notificationId, userId);
    if (success && isSocketInitialized()) {
      try {
        getIO().to(`user:${userId}`).emit("notification:read", { notificationId });
      } catch {}
    }
    return success;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const count = await this.repo.markAllAsRead(userId);
    if (count > 0 && isSocketInitialized()) {
      try {
        getIO().to(`user:${userId}`).emit("notification:all_read", { count });
      } catch {}
    }
    return count;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    return this.repo.delete(notificationId, userId);
  }
}

export const notificationService = new NotificationService();
