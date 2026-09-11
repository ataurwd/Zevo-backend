import { ObjectId } from "mongodb";

export interface InventoryDocument {
  _id: ObjectId;
  product_id: ObjectId;
  variant_id: ObjectId;
  sku: string;
  store_id: ObjectId;
  seller_id: ObjectId;
  quantity_available: number;
  quantity_reserved: number;
  low_stock_threshold: number;
  is_trackable: boolean;
  created_at: Date;
  updated_at: Date;
}

export type InventoryTransactionType =
  | "restock"
  | "adjustment"
  | "reserve"
  | "release"
  | "deduct";

export interface InventoryTransactionDocument {
  _id: ObjectId;
  inventory_id: ObjectId;
  product_id: ObjectId;
  variant_id: ObjectId;
  sku: string;
  type: InventoryTransactionType;
  quantity_change: number;
  balance_after: number;
  reference_id?: string | null;
  reason?: string | null;
  created_by?: ObjectId | null;
  created_at: Date;
}

export interface InventoryResponse {
  id: string;
  product_id: string;
  variant_id: string;
  sku: string;
  store_id: string;
  seller_id: string;
  quantity_available: number;
  quantity_reserved: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  is_trackable: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransactionResponse {
  id: string;
  inventory_id: string;
  sku: string;
  type: InventoryTransactionType;
  quantity_change: number;
  balance_after: number;
  reference_id?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface UpdateStockDTO {
  quantity_change: number;
  type: "restock" | "adjustment";
  note?: string;
}

export interface SetThresholdDTO {
  low_stock_threshold: number;
}

export interface InventoryFilterQuery {
  search?: string;
  low_stock_only?: boolean;
  page?: number;
  limit?: number;
}
