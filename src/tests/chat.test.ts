import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { chatRepository } from "../modules/chat/chat.repository";
import { UsersRepository } from "../modules/users/users.repository";
import { generateAccessToken } from "../shared/utils/jwt";
import { Conversation, ChatMessage } from "../modules/chat/chat.types";

describe("Chat System API Endpoints", () => {
  const user1Id = "65f1a2b3c4d5e6f7a8b9c301";
  const user2Id = "65f1a2b3c4d5e6f7a8b9c302";
  const convId = new ObjectId("65f1a2b3c4d5e6f7a8b9c303");
  const msgId = new ObjectId("65f1a2b3c4d5e6f7a8b9c304");

  let token: string;

  const mockUser2 = {
    _id: new ObjectId(user2Id),
    email: "seller@nexora.com",
    first_name: "Sarah",
    last_name: "Seller",
    role: "SELLER",
  };

  const mockConversation: Conversation = {
    _id: convId,
    order_id: null,
    sub_order_id: null,
    participants: [
      { user_id: new ObjectId(user1Id), role: "customer", name: "Buyer User" },
      { user_id: new ObjectId(user2Id), role: "seller", name: "Sarah Seller" },
    ],
    participant_ids: [new ObjectId(user1Id), new ObjectId(user2Id)],
    last_message: "Hello seller!",
    last_message_at: new Date(),
    last_message_sender_id: new ObjectId(user1Id),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockMessage: ChatMessage = {
    _id: msgId,
    conversation_id: convId,
    sender_id: new ObjectId(user1Id),
    sender_name: "Buyer User",
    sender_role: "customer",
    text: "Hello seller!",
    attachments: [],
    read_by: [new ObjectId(user1Id)],
    created_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const tokenObj = generateAccessToken({
      id: user1Id,
      email: "buyer@nexora.com",
      role: "CUSTOMER",
    });
    token = tokenObj.token;
  });

  describe("POST /api/v1/chat/conversations", () => {
    it("should start a new conversation with another user", async () => {
      vi.spyOn(UsersRepository, "findById").mockResolvedValue(mockUser2 as any);
      vi.spyOn(chatRepository, "findExistingConversation").mockResolvedValue(null);
      vi.spyOn(chatRepository, "createConversation").mockResolvedValue(mockConversation);
      vi.spyOn(chatRepository, "findConversationById").mockResolvedValue(mockConversation);
      vi.spyOn(chatRepository, "insertMessage").mockResolvedValue(mockMessage);
      vi.spyOn(chatRepository, "updateLastMessage").mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/v1/chat/conversations")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipient_id: user2Id,
          initial_message: "Hello seller!",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.participants).toHaveLength(2);
    });
  });

  describe("GET /api/v1/chat/conversations", () => {
    it("should list active conversations for authenticated user", async () => {
      vi.spyOn(chatRepository, "listUserConversations").mockResolvedValue([mockConversation]);

      const res = await request(app)
        .get("/api/v1/chat/conversations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("GET /api/v1/chat/conversations/:id/messages", () => {
    it("should return paginated message history and mark as read", async () => {
      vi.spyOn(chatRepository, "findConversationById").mockResolvedValue(mockConversation);
      vi.spyOn(chatRepository, "markMessagesAsRead").mockResolvedValue(1);
      vi.spyOn(chatRepository, "getMessages").mockResolvedValue({
        messages: [mockMessage],
        total: 1,
      });

      const res = await request(app)
        .get(`/api/v1/chat/conversations/${convId.toString()}/messages`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messages).toHaveLength(1);
      expect(res.body.data.messages[0].text).toBe("Hello seller!");
    });
  });

  describe("POST /api/v1/chat/conversations/:id/messages", () => {
    it("should send a new message in conversation", async () => {
      vi.spyOn(chatRepository, "findConversationById").mockResolvedValue(mockConversation);
      vi.spyOn(chatRepository, "insertMessage").mockResolvedValue(mockMessage);
      vi.spyOn(chatRepository, "updateLastMessage").mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/v1/chat/conversations/${convId.toString()}/messages`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          text: "Hello seller!",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.text).toBe("Hello seller!");
    });
  });

  describe("GET /api/v1/chat/unread-count", () => {
    it("should return total unread count across user conversations", async () => {
      vi.spyOn(chatRepository, "countUnreadMessages").mockResolvedValue(3);

      const res = await request(app)
        .get("/api/v1/chat/unread-count")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unreadCount).toBe(3);
    });
  });
});
