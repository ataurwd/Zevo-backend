import { ObjectId } from "mongodb";

export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready_for_pickup" | "picked_up" | "in_transit" | "cancelled" | "completed";

export type SubOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export interface DeliveryAddressSnapshot {
  recipient_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface OrderItemSnapshot {
  product_id: ObjectId;
  variant_id: ObjectId;
  sku: string;
  product_name: string;
  variant_name: string;
  image_url?: string;
  unit_price: number; // in cents
  quantity: number;
  subtotal: number; // in cents
}

export interface OrderDocument {
  _id: ObjectId;
  order_number: string;
  customer_id: ObjectId;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number; // cents
  discount_amount: number; // cents
  delivery_fee: number; // cents
  platform_fee: number; // cents
  total: number; // cents
  currency: string;
  delivery_address: DeliveryAddressSnapshot;
  stripe_payment_intent_id: string | null;
  coupon_id?: ObjectId | null;
  coupon_code?: string | null;
  notes?: string | null;
  cancelled_at?: Date | null;
  cancelled_by?: ObjectId | null;
  cancellation_reason?: string | null;
  assigned_rider?: any;
  confirmed_at?: Date | null;
  preparing_at?: Date | null;
  ready_at?: Date | null;
  picked_up_at?: Date | null;
  in_transit_at?: Date | null;
  delivered_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubOrderDocument {
  _id: ObjectId;
  order_id: ObjectId;
  order_number: string;
  seller_id: ObjectId;
  store_id: ObjectId;
  customer_id?: ObjectId;
  delivery_address?: DeliveryAddressSnapshot;
  customer_notes?: string | null;
  status: SubOrderStatus;
  items: OrderItemSnapshot[];
  subtotal: number;
  seller_earnings: number;
  platform_commission: number;
  commission_rate: number; // default 10
  delivery_fee: number;
  stripe_transfer_id?: string | null;
  confirmed_at?: Date | null;
  preparing_at?: Date | null;
  ready_at?: Date | null;
  picked_up_at?: Date | null;
  delivered_at?: Date | null;
  in_transit_at?: Date | null;
  assigned_rider?: any;
  cancelled_at?: Date | null;
  cancellation_reason?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrderDTO {
  address_id?: string;
  delivery_address?: DeliveryAddressSnapshot;
  notes?: string;
}

export interface UpdateSubOrderStatusDTO {
  status: "confirmed" | "preparing" | "ready_for_pickup" | "picked_up" | "delivered" | "cancelled";
  reason?: string;
}

export interface CancelOrderDTO {
  reason?: string;
}

export interface OrderResponse {
  assigned_rider?: any;
  confirmed_at?: string | null;
  preparing_at?: string | null;
  ready_at?: string | null;
  picked_up_at?: string | null;
  in_transit_at?: string | null;
  delivered_at?: string | null;
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
  currency: string;
  delivery_address: DeliveryAddressSnapshot;
  stripe_payment_intent_id: string | null;
  coupon_code?: string | null;
  notes?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  sub_orders?: SubOrderResponse[];
}

export interface SubOrderResponse {
  id: string;
  order_id: string;
  order_number: string;
  seller_id: string;
  store_id: string;
  store_name?: string;
  customer_id?: string;
  delivery_address?: DeliveryAddressSnapshot;
  customer_notes?: string | null;
  status: SubOrderStatus;
  items: Array<{
    product_id: string;
    variant_id: string;
    sku: string;
    product_name: string;
    variant_name: string;
    image_url?: string;
    unit_price: number;
    quantity: number;
    subtotal: number;
  }>;
  subtotal: number;
  seller_earnings: number;
  platform_commission: number;
  commission_rate: number;
  delivery_fee: number;
  stripe_transfer_id?: string | null;
  confirmed_at?: string | null;
  preparing_at?: string | null;
  ready_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  in_transit_at?: string | null;
  assigned_rider?: any;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
}
