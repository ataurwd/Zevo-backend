import { ObjectId } from "mongodb";

export interface GeoLocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface AddressDocument {
  _id: ObjectId;
  user_id: ObjectId;
  label?: string | null;
  recipient_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  location?: GeoLocation | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AddressResponse {
  id: string;
  label?: string | null;
  recipient_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  location?: GeoLocation | null;
  is_default: boolean;
  created_at: string;
}

export interface CreateAddressDTO {
  label?: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  location?: {
    lat: number;
    lon: number;
  };
  is_default?: boolean;
}

export interface UpdateAddressDTO extends Partial<CreateAddressDTO> {}

export interface UpdateProfileDTO {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface ChangePasswordDTO {
  current_password: string;
  new_password: string;
}
