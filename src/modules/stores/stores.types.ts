import { ObjectId } from "mongodb";
import { GeoLocation } from "../users/users.types";

export interface StoreAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface StoreDocument {
  _id: ObjectId;
  seller_id: ObjectId;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address: StoreAddress;
  location?: GeoLocation | null;
  rating_avg: number;
  rating_count: number;
  is_open: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StoreResponse {
  id: string;
  seller_id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address: StoreAddress;
  location?: GeoLocation | null;
  rating_avg: number;
  rating_count: number;
  is_open: boolean;
  created_at: string;
}

export interface CreateStoreDTO {
  name: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  address: StoreAddress;
  location?: {
    lat: number;
    lon: number;
  };
}

export interface UpdateStoreDTO extends Partial<CreateStoreDTO> {
  is_open?: boolean;
}
