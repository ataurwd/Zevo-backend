import { ObjectId } from "mongodb";
import { chatRepository, ChatRepository } from "./chat.repository";
import { UsersRepository } from "../users/users.repository";
import { getDb } from "../../infrastructure/db/client";
import {
  Conversation,
  ChatMessage,
  SendMessageDTO,
  StartConversationDTO,
  ParticipantRole,
  ChatParticipant,
} from "./chat.types";
import { isSocketInitialized, getIO } from "../../infrastructure/socket/io";
import { logger } from "../../infrastructure/logger";

export class ChatService {
  async startOrGetSupportConversation(
    userId: string,
    userRole: string,
    userName: string,
    initialMessage?: string
  ): Promise<Conversation> {
    const userObjId = new ObjectId(userId);

    let conversation = await this.repo.findExistingSupportConversation(userObjId);

    if (!conversation) {
      const usersCol = getDb().collection("users");
      const adminUser = await usersCol.findOne({
        $or: [{ role: "ADMIN" }, { role: "SUPER_ADMIN" }, { email: "admin@nexora.com" }],
      });

      const adminObjId = adminUser ? adminUser._id : new ObjectId();
      const adminName = adminUser
        ? `${adminUser.first_name || ""} ${adminUser.last_name || ""}`.trim() || "Zevo Support Team"
        : "Zevo Support Team";

      const participants: ChatParticipant[] = [
        {
          user_id: userObjId,
          role: (userRole.toLowerCase() as ParticipantRole) || "customer",
          name: userName || "User",
        },
        {
          user_id: adminObjId,
          role: "admin",
          name: adminName,
        },
      ];

      conversation = await this.repo.createConversation({
        participants,
        initial_message: initialMessage,
        is_support: true,
      });
    }

    if (initialMessage && conversation._id) {
      await this.sendMessage(
        conversation._id.toString(),
        userId,
        userName,
        (userRole.toLowerCase() as ParticipantRole) || "customer",
        { text: initialMessage }
      );
    }

    return conversation;
  }

  constructor(private repo: ChatRepository = chatRepository) {}

  async startOrGetConversation(
    userId: string,
    userRole: string,
    userName: string,
    dto: StartConversationDTO
  ): Promise<Conversation> {
    const senderObjId = new ObjectId(userId);
    let resolvedRecipientId = dto.recipient_id;
    if (!resolvedRecipientId && dto.seller_id) {
      const sellersCol = getDb().collection("sellers");
      const seller = await sellersCol.findOne({ _id: new ObjectId(dto.seller_id) });
      if (seller && seller.user_id) {
        resolvedRecipientId = seller.user_id.toString();
      }
    }
    if (!resolvedRecipientId) {
      throw new Error("Recipient ID or Seller ID is required to start a conversation");
    }
    let recipientObjId = new ObjectId(resolvedRecipientId);

    if (senderObjId.equals(recipientObjId)) {
      throw new Error("Cannot start a conversation with yourself");
    }

    let recipient = await UsersRepository.findById(recipientObjId);
    if (!recipient) {
      // Check if recipientObjId is a seller_id in the sellers collection
      const sellersCol = getDb().collection("sellers");
      const seller = await sellersCol.findOne({ _id: recipientObjId });
      if (seller && seller.user_id) {
        recipientObjId = seller.user_id;
        recipient = await UsersRepository.findById(recipientObjId);
      }
    }
    if (!recipient) {
      throw new Error("Recipient user not found");
    }

    const orderObjId = dto.order_id ? new ObjectId(dto.order_id) : null;
    const subOrderObjId = dto.sub_order_id ? new ObjectId(dto.sub_order_id) : null;

    // Check if conversation already exists
    let conversation = await this.repo.findExistingConversation(
      senderObjId,
      recipientObjId,
      orderObjId
    );

    if (!conversation) {
      const recipientName = `${recipient.first_name || ""} ${recipient.last_name || ""}`.trim() || recipient.email;
      const participants = [
        {
          user_id: senderObjId,
          role: (userRole.toLowerCase() as ParticipantRole) || "customer",
          name: userName || "User",
        },
        {
          user_id: recipientObjId,
          role: (recipient.role?.toLowerCase() as ParticipantRole) || "seller",
          name: recipientName,
        },
      ];

      conversation = await this.repo.createConversation({
        participants,
        order_id: orderObjId,
        sub_order_id: subOrderObjId,
        initial_message: dto.initial_message,
      });
    }

    // Send initial message if provided
    if (dto.initial_message && conversation._id) {
      await this.sendMessage(
        conversation._id.toString(),
        userId,
        userName,
        (userRole.toLowerCase() as ParticipantRole) || "customer",
        { text: dto.initial_message }
      );
    }

    return conversation;
  }

  async getUserConversations(userId: string, userRole?: string, limit = 50, skip = 0): Promise<Conversation[]> {
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "SUPPORT") {
      return this.repo.listAdminSupportConversations(limit, skip);
    }
    const userObjId = new ObjectId(userId);
    return this.repo.listUserConversations(userObjId, limit, skip);
  }

  async getMessages(
    conversationId: string,
    userId: string,
    userRole?: string,
    limit = 50,
    skip = 0
  ): Promise<{ messages: ChatMessage[]; total: number }> {
    const convObjId = new ObjectId(conversationId);
    const userObjId = new ObjectId(userId);

    const conversation = await this.repo.findConversationById(convObjId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const normalizedRole = (userRole || "").toLowerCase();
    const isParticipant = conversation.participant_ids.some((id) => id.equals(userObjId));
    const isStaff =
      normalizedRole === "admin" ||
      normalizedRole === "super_admin" ||
      normalizedRole === "support" ||
      conversation.is_support ||
      conversation.participants.some((p) => p.role === "admin" || (p.role as any) === "support");

    if (!isParticipant && !isStaff) {
      throw new Error("Unauthorized to access this conversation");
    }

    // Auto mark messages as read
    await this.repo.markMessagesAsRead(convObjId, userObjId);

    if (isSocketInitialized()) {
      try {
        getIO().to(`chat:${conversationId}`).emit("chat:read", {
          conversationId,
          userId,
        });
      } catch (err) {
        logger.warn({ err }, "Failed to broadcast chat:read event");
      }
    }

    return this.repo.getMessages(convObjId, limit, skip);
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    senderRole: ParticipantRole,
    dto: SendMessageDTO
  ): Promise<ChatMessage> {
    const convObjId = new ObjectId(conversationId);
    const senderObjId = new ObjectId(senderId);

    const conversation = await this.repo.findConversationById(convObjId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participant_ids.some((id) => id.equals(senderObjId));
    const normalizedRole = (senderRole || "").toLowerCase();
    const isStaff =
      normalizedRole === "admin" ||
      normalizedRole === "super_admin" ||
      normalizedRole === "support" ||
      conversation.is_support ||
      conversation.participants.some((p) => p.role === "admin" || (p.role as any) === "support");

    if (!isParticipant && !isStaff) {
      throw new Error("You are not a participant in this conversation");
    }

    if (!isParticipant && isStaff) {
      await this.repo.addParticipant(convObjId, {
        user_id: senderObjId,
        role: (normalizedRole === "support" ? "support" : "admin") as ParticipantRole,
        name: senderName,
      });
    }

    const message: Omit<ChatMessage, "_id"> = {
      conversation_id: convObjId,
      sender_id: senderObjId,
      sender_name: senderName,
      sender_role: senderRole,
      text: dto.text.trim(),
      attachments: dto.attachments || [],
      read_by: [senderObjId],
      created_at: new Date(),
    };

    const savedMessage = await this.repo.insertMessage(message);
    await this.repo.updateLastMessage(convObjId, dto.text.trim(), senderObjId);

    // Broadcast via Socket.IO to chat room
    if (isSocketInitialized()) {
      try {
        const io = getIO();
        io.to(`chat:${conversationId}`).emit("chat:message", savedMessage);

        // Notify other participants in their personal user rooms
        for (const pId of conversation.participant_ids) {
          if (!pId.equals(senderObjId)) {
            io.to(`user:${pId.toString()}`).emit("chat:incoming", {
              conversationId,
              senderName,
              text: dto.text.trim(),
              createdAt: savedMessage.created_at,
            });
          }
        }
      } catch (err) {
        logger.warn({ err }, "Failed to broadcast socket event for chat message");
      }
    }

    return savedMessage;
  }

  async markAsRead(conversationId: string, userId: string): Promise<number> {
    const convObjId = new ObjectId(conversationId);
    const userObjId = new ObjectId(userId);
    const count = await this.repo.markMessagesAsRead(convObjId, userObjId);

    if (isSocketInitialized()) {
      try {
        getIO().to(`chat:${conversationId}`).emit("chat:read", {
          conversationId,
          userId,
        });
      } catch (err) {
        logger.warn({ err }, "Failed emitting chat:read");
      }
    }

    return count;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const userObjId = new ObjectId(userId);
    return this.repo.countUnreadMessages(userObjId);
  }
}

export const chatService = new ChatService();
