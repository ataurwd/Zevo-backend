import { ObjectId } from "mongodb";

export type SellerStatus = "pending" | "approved" | "rejected" | "suspended";

export interface SellerDocument {
  _id: ObjectId;
  user_id: ObjectId;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  status: SellerStatus;
  rejection_reason?: string | null;
  approved_by?: ObjectId | null;
  approved_at?: Date | null;
  business_name: string;
  business_type: "individual" | "company";
  tax_id?: string | null;
  bank_verified: boolean;
  total_earnings: number; // in cents
  total_commission_paid: number; // in cents
  pending_balance: number; // in cents
  created_at: Date;
  updated_at: Date;
}

export interface SellerResponse {
  id: string;
  user_id: string;
  stripe_account_id?: string | null;
  stripe_onboarding_complete: boolean;
  status: SellerStatus;
  rejection_reason?: string | null;
  approved_at?: string | null;
  business_name: string;
  business_type: "individual" | "company";
  tax_id?: string | null;
  bank_verified: boolean;
  total_earnings: number;
  total_commission_paid: number;
  pending_balance: number;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  created_at: string;
}

export interface OnboardSellerDTO {
  business_name: string;
  business_type: "individual" | "company";
  tax_id?: string;
}

export interface RejectSellerDTO {
  reason: string;
}
