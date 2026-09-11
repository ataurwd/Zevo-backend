import { ObjectId } from "mongodb";

export type ProductStatus = "draft" | "pending_review" | "approved" | "rejected" | "suspended";

export interface ProductVariant {
  _id: ObjectId;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: number; // in cents
  compare_at_price?: number | null;
  weight_grams?: number | null;
  is_active: boolean;
}

export interface ProductDocument {
  _id: ObjectId;
  store_id: ObjectId;
  seller_id: ObjectId;
  category_id: ObjectId;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  rejection_reason?: string | null;
  images: string[];
  tags: string[];
  attributes: Array<{ name: string; value: string }>;
  variants: ProductVariant[];
  base_price: number;
  rating_avg: number;
  rating_count: number;
  total_sold: number;
  is_deleted: boolean;
  deleted_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProductVariantResponse {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  compare_at_price?: number | null;
  weight_grams?: number | null;
  is_active: boolean;
}

export interface ProductResponse {
  id: string;
  store_id: string;
  seller_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  rejection_reason?: string | null;
  images: string[];
  tags: string[];
  attributes: Array<{ name: string; value: string }>;
  variants: ProductVariantResponse[];
  base_price: number;
  rating_avg: number;
  rating_count: number;
  total_sold: number;
  created_at: string;
}

export interface CreateVariantDTO {
  sku?: string;
  name: string;
  attributes?: Record<string, string>;
  price: number; // in cents
  compare_at_price?: number;
  weight_grams?: number;
  is_active?: boolean;
}

export interface CreateProductDTO {
  category_id: string;
  name: string;
  description: string;
  images?: string[];
  tags?: string[];
  attributes?: Array<{ name: string; value: string }>;
  variants: CreateVariantDTO[];
}

export interface UpdateProductDTO {
  category_id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  attributes?: Array<{ name: string; value: string }>;
}

export interface ProductFilterQuery {
  q?: string;
  category?: string;
  store?: string;
  min_price?: number;
  max_price?: number;
  rating?: number;
  sort?: "price_asc" | "price_desc" | "rating" | "newest";
  page?: number;
  limit?: number;
}
