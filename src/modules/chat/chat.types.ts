import { ObjectId } from "mongodb";

export type ParticipantRole = "customer" | "seller" | "delivery_agent" | "admin" | "support";

export interface ChatParticipant {
  user_id: ObjectId;
  role: ParticipantRole;
  name: string;
  avatar_url?: string | null;
}

export interface Conversation {
  _id?: ObjectId | string;
  order_id?: ObjectId | null;
  sub_order_id?: ObjectId | null;
  is_support?: boolean;
  participants: ChatParticipant[];
  participant_ids: ObjectId[];
  last_message?: string | null;
  last_message_at?: Date | null;
  last_message_sender_id?: ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMessage {
  _id?: ObjectId | string;
  conversation_id: ObjectId;
  sender_id: ObjectId;
  sender_name: string;
  sender_role: ParticipantRole;
  text: string;
  attachments?: string[];
  read_by: ObjectId[];
  created_at: Date;
}

export interface SendMessageDTO {
  text: string;
  attachments?: string[];
}

export interface StartConversationDTO {
  recipient_id: string;
  order_id?: string;
  sub_order_id?: string;
  initial_message?: string;
  seller_id?: string;
}
