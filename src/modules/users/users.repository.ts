import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { UserDocument, UserResponse } from "../auth/auth.types";

export class UsersRepository {
  private static getCollection(): Collection<UserDocument> {
    return getDb().collection<UserDocument>("users");
  }

  public static async findByEmail(email: string): Promise<UserDocument | null> {
    return this.getCollection().findOne({ email: email.toLowerCase().trim() });
  }

  public static async findById(id: string | ObjectId): Promise<UserDocument | null> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    return this.getCollection().findOne({ _id: objectId });
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
    return this.getCollection().findOne({
      email_verification_token: tokenHash,
      email_verification_expires: { $gt: new Date() },
    });
  }

  public static async findByResetToken(tokenHash: string): Promise<UserDocument | null> {
    return this.getCollection().findOne({
      password_reset_token: tokenHash,
      password_reset_expires: { $gt: new Date() },
    });
  }

  public static toResponse(user: UserDocument): UserResponse {
    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || null,
      avatar_url: user.avatar_url || null,
      is_email_verified: user.is_email_verified,
      is_active: user.is_active,
      created_at: user.created_at.toISOString(),
    };
  }
}
