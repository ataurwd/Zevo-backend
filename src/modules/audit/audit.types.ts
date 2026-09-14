import { ObjectId } from "mongodb";

export type AuditAction =
  | "auth.login"
  | "auth.register"
  | "order.cancel"
  | "payout.request"
  | "payout.approve"
  | "payout.reject"
  | "moderation.seller_approve"
  | "moderation.seller_reject"
  | "moderation.product_approve"
  | "moderation.product_reject"
  | "moderation.rider_approve"
  | "moderation.rider_suspend";

export interface AuditLogEntry {
  _id?: ObjectId | string;
  actor_id: ObjectId;
  actor_email: string;
  actor_role: string;
  action: AuditAction | string;
  target_resource: string;
  target_id?: string | null;
  details?: Record<string, any>;
  ip_address?: string | null;
  created_at: Date;
}
