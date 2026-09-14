import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { Conversation, ChatMessage, ChatParticipant } from "./chat.types";

export class ChatRepository {
  private get conversationsCollection(): Collection<Conversation> {
    return getDb().collection<Conversation>("conversations");
  }

  private get messagesCollection(): Collection<ChatMessage> {
    return getDb().collection<ChatMessage>("messages");
  }

  async ensureIndexes(): Promise<void> {
    try {
      await this.conversationsCollection.createIndex(
        { participant_ids: 1, last_message_at: -1 },
        { background: true }
      );
      await this.conversationsCollection.createIndex(
        { order_id: 1 },
        { background: true, sparse: true }
      );
      await this.messagesCollection.createIndex(
        { conversation_id: 1, created_at: -1 },
        { background: true }
      );
    } catch {
      // Ignore during initial testing if DB not yet connected
    }
  }

  async findExistingSupportConversation(userId: ObjectId): Promise<Conversation | null> {
    return this.conversationsCollection.findOne({
      participant_ids: userId,
      $or: [{ is_support: true }, { "participants.role": "admin" }],
    });
  }

  async listAdminSupportConversations(limit = 50, skip = 0): Promise<Conversation[]> {
    return this.conversationsCollection
      .find({
        $or: [{ is_support: true }, { "participants.role": "admin" }],
      })
      .sort({ last_message_at: -1, updated_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async findConversationById(id: string | ObjectId): Promise<Conversation | null> {
    const _id = typeof id === "string" ? new ObjectId(id) : id;
    return this.conversationsCollection.findOne({ _id });
  }

  async findExistingConversation(
    user1Id: ObjectId,
    user2Id: ObjectId,
    orderId?: ObjectId | null
  ): Promise<Conversation | null> {
    const query: any = {
      participant_ids: { $all: [user1Id, user2Id] },
    };
    if (orderId) {
      query.order_id = orderId;
    }
    return this.conversationsCollection.findOne(query);
  }

  async createConversation(data: {
    is_support?: boolean;
    participants: ChatParticipant[];
    order_id?: ObjectId | null;
    sub_order_id?: ObjectId | null;
    initial_message?: string;
  }): Promise<Conversation> {
    const now = new Date();
    const doc: Conversation = {
      order_id: data.order_id || null,
      sub_order_id: data.sub_order_id || null,
      is_support: data.is_support ?? false,
      participants: data.participants,
      participant_ids: data.participants.map((p) => p.user_id),
      last_message: data.initial_message || null,
      last_message_at: data.initial_message ? now : null,
      created_at: now,
      updated_at: now,
    };

    const res = await this.conversationsCollection.insertOne(doc);
    return { ...doc, _id: res.insertedId };
  }

  async listUserConversations(userId: ObjectId, limit = 20, skip = 0): Promise<Conversation[]> {
    return this.conversationsCollection
      .find({ participant_ids: userId })
      .sort({ last_message_at: -1, updated_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async addParticipant(conversationId: ObjectId, participant: ChatParticipant): Promise<void> {
    await this.conversationsCollection.updateOne(
      { _id: conversationId },
      {
        $addToSet: {
          participant_ids: participant.user_id,
          participants: participant,
        },
      }
    );
  }

  async updateLastMessage(
    conversationId: ObjectId,
    messageText: string,
    senderId: ObjectId
  ): Promise<void> {
    const now = new Date();
    await this.conversationsCollection.updateOne(
      { _id: conversationId },
      {
        $set: {
          last_message: messageText,
          last_message_at: now,
          last_message_sender_id: senderId,
          updated_at: now,
        },
      }
    );
  }

  async insertMessage(message: Omit<ChatMessage, "_id">): Promise<ChatMessage> {
    const res = await this.messagesCollection.insertOne(message as any);
    return { ...message, _id: res.insertedId };
  }

  async getMessages(
    conversationId: ObjectId,
    limit = 50,
    skip = 0
  ): Promise<{ messages: ChatMessage[]; total: number }> {
    const query = { conversation_id: conversationId };
    const [messages, total] = await Promise.all([
      this.messagesCollection
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.messagesCollection.countDocuments(query),
    ]);

    return { messages: messages.reverse(), total };
  }

  async markMessagesAsRead(conversationId: ObjectId, userId: ObjectId): Promise<number> {
    const res = await this.messagesCollection.updateMany(
      {
        conversation_id: conversationId,
        sender_id: { $ne: userId },
        read_by: { $ne: userId },
      },
      {
        $addToSet: { read_by: userId },
      }
    );
    return res.modifiedCount;
  }

  async countUnreadMessages(userId: ObjectId): Promise<number> {
    // Count messages in conversations where user is participant, not sender, and not in read_by
    const userConversations = await this.conversationsCollection
      .find({ participant_ids: userId }, { projection: { _id: 1 } })
      .toArray();

    if (userConversations.length === 0) return 0;
    const conversationIds = userConversations.map((c) => c._id as ObjectId);

    return this.messagesCollection.countDocuments({
      conversation_id: { $in: conversationIds },
      sender_id: { $ne: userId },
      read_by: { $ne: userId },
    });
  }
}

export const chatRepository = new ChatRepository();
