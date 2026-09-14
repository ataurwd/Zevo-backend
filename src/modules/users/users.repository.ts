import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { UserDocument, UserResponse } from "../auth/auth.types";

export class UsersRepository {
  private static getCollection(): Collection<UserDocument> {
    return getDb().collection<UserDocument>("users");
  }

  public static async findByEmail(email: string): Promise<UserDocument | null> {
    const normalized = email.toLowerCase().trim();
    return await this.getCollection().findOne({ email: normalized });
  }

  public static async findById(id: string | ObjectId): Promise<UserDocument | null> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    return await this.getCollection().findOne({ _id: objectId });
  }

  public static async create(data: Omit<UserDocument, "_id">): Promise<UserDocument> {
    const res = await this.getCollection().insertOne(data as UserDocument);
    return {
      _id: res.insertedId,
      ...data,
    };
  }

  public static async update(
    id: string | ObjectId,
    updateData: Partial<UserDocument>
  ): Promise<UserDocument | null> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    const res = await this.getCollection().findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          ...updateData,
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    return res;
  }

  public static async findByVerificationToken(tokenHash: string): Promise<UserDocument | null> {
    return await this.getCollection().findOne({
      email_verification_token: tokenHash,
      email_verification_expires: { $gt: new Date() },
    });
  }

  public static async findByResetToken(tokenHash: string): Promise<UserDocument | null> {
    return await this.getCollection().findOne({
      password_reset_token: tokenHash,
      password_reset_expires: { $gt: new Date() },
    });
  }

  public static toResponse(user: UserDocument): UserResponse {
    return {
      id: user._id.toString(),
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      phone: user.phone,
      avatar_url: user.avatar_url,
      is_email_verified: user.is_email_verified,
      is_active: user.is_active,
      created_at: user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString(),
    };
  }

  public static async adminListUsers(options: {
    role?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ users: UserDocument[]; total: number }> {
    const col = this.getCollection();
    const filter: any = {};

    if (options.role && options.role !== "ALL") {
      const r = options.role.toUpperCase();
      if (r === "RIDER" || r === "DELIVERY_AGENT") {
        filter.role = { $in: ["DELIVERY_AGENT", "RIDER"] };
      } else if (r === "ADMIN" || r === "SUPER_ADMIN") {
        filter.role = { $in: ["ADMIN", "SUPER_ADMIN"] };
      } else {
        filter.role = r;
      }
    }

    if (options.search && options.search.trim()) {
      const searchRegex = new RegExp(options.search.trim(), "i");
      filter.$or = [
        { first_name: searchRegex },
        { last_name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const skip = options.skip || 0;
    const limit = options.limit || 50;

    const [users, total] = await Promise.all([
      col.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    return { users, total };
  }

  public static async adminUpdateUser(
    userId: string | ObjectId,
    data: { role?: string; is_active?: boolean; phone?: string; first_name?: string; last_name?: string }
  ): Promise<UserDocument | null> {
    const objectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const updateFields: any = { updated_at: new Date() };
    if (data.role) updateFields.role = data.role;
    if (data.is_active !== undefined) updateFields.is_active = data.is_active;
    if (data.phone !== undefined) updateFields.phone = data.phone;
    if (data.first_name !== undefined) updateFields.first_name = data.first_name;
    if (data.last_name !== undefined) updateFields.last_name = data.last_name;

    const res = await this.getCollection().findOneAndUpdate(
      { _id: objectId },
      { $set: updateFields },
      { returnDocument: "after" }
    );
    return res;
  }


  public static async findByIds(ids: (string | ObjectId)[]): Promise<UserDocument[]> {
    const objectIds = ids.map((id) => (typeof id === "string" ? new ObjectId(id) : id));
    return await this.getCollection().find({ _id: { $in: objectIds } }).toArray();
  }
}
