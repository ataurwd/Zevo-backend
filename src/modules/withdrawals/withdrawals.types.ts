import { ObjectId } from "mongodb";

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "processed";

export interface Withdrawal {
  _id?: ObjectId | string;
  seller_id: ObjectId;
  seller_name: string;
  amount: number; // in cents
  bank_account_last4?: string | null;
  status: WithdrawalStatus;
  notes?: string | null;
  admin_notes?: string | null;
  processed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface RequestWithdrawalDTO {
  amount: number; // in cents
  notes?: string;
}

export interface RejectWithdrawalDTO {
  reason: string;
}
