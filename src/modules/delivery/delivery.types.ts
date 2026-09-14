import { ObjectId } from "mongodb";
import { DeliveryAddressSnapshot } from "../orders/order.types";

export type VehicleType = "bicycle" | "motorcycle" | "scooter" | "car";

export type RiderStatus = "pending_review" | "approved" | "rejected" | "suspended";

export type DeliveryTaskStatus =
  | "unassigned"
  | "assigned"
  | "en_route_pickup"
  | "picked_up"
  | "en_route_delivery"
  | "delivered"
  | "failed"
  | "cancelled";

export interface GeoLocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface DeliveryAgent {
  _id?: ObjectId | string;
  user_id: ObjectId;
  vehicle_type: VehicleType;
  vehicle_number: string;
  license_number: string;
  status: RiderStatus;
  is_online: boolean;
  current_location: GeoLocation;
  active_task_id: ObjectId | null;
  pending_earnings: number; // in cents
  total_earnings: number; // in cents
  rating: number;
  total_deliveries: number;
  delivery_zones?: string[];
  service_city?: string;
  is_zone_match?: boolean;
  user_name?: string;
  phone?: string;
  email?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryTask {
  _id?: ObjectId | string;
  task_number: string;
  sub_order_id: ObjectId;
  order_id: ObjectId;
  seller_id: ObjectId;
  customer_id: ObjectId;
  delivery_agent_id: ObjectId | null;
  status: DeliveryTaskStatus;
  pickup_address: DeliveryAddressSnapshot & { coordinates?: [number, number] };
  delivery_address: DeliveryAddressSnapshot & { coordinates?: [number, number] };
  estimated_pickup: Date | null;
  estimated_delivery: Date | null;
  actual_pickup: Date | null;
  actual_delivery: Date | null;
  rider_earnings: number; // in cents
  assignment_attempts: number;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RegisterRiderDTO {
  delivery_zones?: string[];
  service_city?: string;
  phone?: string;
  vehicle_type: VehicleType;
  vehicle_number: string;
  license_number: string;
}

export interface UpdateLocationDTO {
  taskId?: string;
  latitude: number;
  longitude: number;
}

export interface UpdateRiderProfileDTO {
  vehicle_type?: VehicleType;
  vehicle_number?: string;
  license_number?: string;
  delivery_zones?: string[];
  service_city?: string;
  phone?: string;
}

export interface AssignRiderDTO {
  sub_order_id: string;
  rider_id: string;
  order_id?: string;
  notes?: string;
}
