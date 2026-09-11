import { ObjectId } from "mongodb";

export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export interface WebhookEventRecord {
  event_id: string;
  type: string;
  received_at: Date;
}

export interface PaymentDocument {
  _id: ObjectId;
  order_id: ObjectId;
  customer_id: ObjectId;
  stripe_payment_intent_id: string;
  stripe_charge_id?: string | null;
  amount: number; // cents
  currency: string;
  status: PaymentStatus;
  payment_method_type?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  metadata?: Record<string, any> | null;
  webhook_events: WebhookEventRecord[];
  created_at: Date;
  updated_at: Date;
}

export interface RefundDocument {
  _id: ObjectId;
  payment_id: ObjectId;
  order_id: ObjectId;
  sub_order_id?: ObjectId | null;
  stripe_refund_id: string;
  amount: number; // cents
  reason: string;
  status: "pending" | "succeeded" | "failed";
  initiated_by: ObjectId; // admin user_id
  created_at: Date;
  updated_at: Date;
}

export interface PaymentResponse {
  id: string;
  order_id: string;
  customer_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method_type?: string | null;
  failure_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefundResponse {
  id: string;
  payment_id: string;
  order_id: string;
  stripe_refund_id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

export interface InitiateRefundDTO {
  amount?: number; // cents; full refund if omitted
  reason: "customer_request" | "duplicate" | "fraud" | "defective";
  sub_order_id?: string;
}
