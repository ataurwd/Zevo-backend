import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { SellerDocument, SellerResponse, SellerStatus } from "./sellers.types";

export class SellersRepository {
  private static getCollection(): Collection<SellerDocument> {
    return getDb().collection<SellerDocument>("sellers");
  }

  public static async findByUserId(userId: string | ObjectId): Promise<SellerDocument | null> {
    const objectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    return this.getCollection().findOne({ user_id: objectId });
  }

  public static async findById(id: string | ObjectId): Promise<SellerDocument | null> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    return this.getCollection().findOne({ _id: objectId });
  }

  public static async findByStripeAccountId(stripeAccountId: string): Promise<SellerDocument | null> {
    return this.getCollection().findOne({ stripe_account_id: stripeAccountId });
  }

  public static async create(data: Omit<SellerDocument, "_id">): Promise<SellerDocument> {
    const res = await this.getCollection().insertOne(data as SellerDocument);
    return {
      _id: res.insertedId,
      ...data,
    };
  }

  public static async update(
    id: string | ObjectId,
    updateData: Partial<SellerDocument>
  ): Promise<SellerDocument | null> {
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

  public static async creditSellerBalance(
    sellerId: string | ObjectId,
    earnings: number,
    commission: number
  ): Promise<void> {
    const objectId = typeof sellerId === "string" ? new ObjectId(sellerId) : sellerId;
    await this.getCollection().updateOne(
      { _id: objectId },
      {
        $inc: {
          total_earnings: earnings,
          total_commission_paid: commission,
          pending_balance: earnings,
        },
        $set: { updated_at: new Date() },
      }
    );
  }

  public static async listByStatus(status?: SellerStatus): Promise<SellerDocument[]> {
    const query = status ? { status } : {};
    return this.getCollection().find(query).sort({ created_at: -1 }).toArray();
  }

  public static toResponse(doc: SellerDocument): SellerResponse {
    return {
      id: doc._id.toString(),
      user_id: doc.user_id.toString(),
      stripe_account_id: doc.stripe_account_id || null,
      stripe_onboarding_complete: doc.stripe_onboarding_complete,
      status: doc.status,
      rejection_reason: doc.rejection_reason || null,
      approved_at: doc.approved_at ? doc.approved_at.toISOString() : null,
      business_name: doc.business_name,
      business_type: doc.business_type,
      tax_id: doc.tax_id || null,
      bank_verified: doc.bank_verified,
      total_earnings: doc.total_earnings || 0,
      total_commission_paid: doc.total_commission_paid || 0,
      pending_balance: doc.pending_balance || 0,
      created_at: doc.created_at.toISOString(),
    };
  }
}
