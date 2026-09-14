import { ObjectId } from "mongodb";

export interface Review {
  _id?: ObjectId | string;
  user_id: ObjectId;
  user_name: string;
  product_id: ObjectId;
  order_id: ObjectId;
  sub_order_id: ObjectId;
  seller_id: ObjectId;
  rating: number; // 1 to 5
  title?: string;
  comment: string;
  images?: string[];
  seller_reply?: {
    text: string;
    replied_at: Date;
    seller_id: ObjectId;
  } | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateReviewDTO {
  product_id: string;
  order_id: string;
  sub_order_id: string;
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
}

export interface ReplyReviewDTO {
  reply: string;
}
