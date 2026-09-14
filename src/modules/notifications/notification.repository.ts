import { ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { Notification, CreateNotificationDTO, NotificationFilter } from "./notification.types";

export class NotificationRepository {
  private get collection() {
    return getDb().collection<Notification>("notifications");
  }

  async initIndexes(): Promise<void> {
    try {
      await this.collection.createIndex(
        { user_id: 1, is_read: 1, created_at: -1 },
        { name: "user_inbox_idx" }
      );
      await this.collection.createIndex(
        { created_at: 1 },
        { expireAfterSeconds: 90 * 24 * 60 * 60, name: "notification_ttl_idx" }
      );
    } catch {
      // Index might already exist
    }
  }

  async create(data: CreateNotificationDTO): Promise<Notification> {
    const doc: Notification = {
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      body: data.body,
      reference_id: data.reference_id,
      reference_type: data.reference_type,
      is_read: false,
      created_at: new Date(),
      read_at: null,
    };

    const res = await this.collection.insertOne(doc);
    return { ...doc, _id: res.insertedId };
  }

  async findByUser(
    userId: string,
    filter: NotificationFilter = {}
  ): Promise<{ notifications: Notification[]; total: number }> {
    const query: any = { user_id: userId };
    if (typeof filter.is_read === "boolean") {
      query.is_read = filter.is_read;
    }
    if (filter.type) {
      query.type = filter.type;
    }

    const limit = Math.min(filter.limit || 20, 100);
    const skip = filter.skip || 0;

    const [notifications, total] = await Promise.all([
      this.collection
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(query),
    ]);

    return { notifications, total };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.collection.countDocuments({ user_id: userId, is_read: false });
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const res = await this.collection.updateOne(
      {
        _id: ObjectId.isValid(notificationId) ? new ObjectId(notificationId) : (notificationId as any),
        user_id: userId,
      },
      {
        $set: {
          is_read: true,
          read_at: new Date(),
        },
      }
    );
    return res.modifiedCount > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const res = await this.collection.updateMany(
      { user_id: userId, is_read: false },
      {
        $set: {
          is_read: true,
          read_at: new Date(),
        },
      }
    );
    return res.modifiedCount;
  }

  async delete(notificationId: string, userId: string): Promise<boolean> {
    const res = await this.collection.deleteOne({
      _id: ObjectId.isValid(notificationId) ? new ObjectId(notificationId) : (notificationId as any),
      user_id: userId,
    });
    return res.deletedCount > 0;
  }
}

export const notificationRepository = new NotificationRepository();
