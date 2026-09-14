import { ObjectId } from "mongodb";

export type NotificationType =
  | "order_created"
  | "order_confirmed"
  | "order_preparing"
  | "order_ready"
  | "order_cancelled"
  | "delivery_assigned"
  | "delivery_picked_up"
  | "delivery_completed"
  | "delivery_failed"
  | "payment_success"
  | "system";

export type ReferenceType = "order" | "sub_order" | "delivery" | "user" | "payment";

export interface Notification {
  _id?: ObjectId | string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  reference_id?: string;
  reference_type?: ReferenceType;
  is_read: boolean;
  created_at: Date;
  read_at?: Date | null;
}

export interface CreateNotificationDTO {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  reference_id?: string;
  reference_type?: ReferenceType;
}

export interface NotificationFilter {
  is_read?: boolean;
  type?: NotificationType;
  limit?: number;
  skip?: number;
}
