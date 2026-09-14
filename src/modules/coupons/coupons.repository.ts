import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { Coupon } from "./coupons.types";

export class CouponsRepository {
  private get collection(): Collection<Coupon> {
    return getDb().collection<Coupon>("coupons");
  }

  async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ code: 1 }, { unique: true, background: true });
      await this.collection.createIndex({ seller_id: 1 }, { background: true });
    } catch {
      // Ignore during initial test
    }
  }

  async create(coupon: Omit<Coupon, "_id">): Promise<Coupon> {
    const res = await this.collection.insertOne(coupon as any);
    return { ...coupon, _id: res.insertedId };
  }

  async findByCode(code: string): Promise<Coupon | null> {
    return this.collection.findOne({ code: code.toUpperCase().trim() });
  }

  async findById(id: string | ObjectId): Promise<Coupon | null> {
    const _id = typeof id === "string" ? new ObjectId(id) : id;
    return this.collection.findOne({ _id });
  }

  async findBySeller(sellerId: ObjectId): Promise<Coupon[]> {
    return this.collection.find({ seller_id: sellerId }).sort({ created_at: -1 }).toArray();
  }

  async incrementUsage(code: string): Promise<boolean> {
    const res = await this.collection.updateOne(
      { code: code.toUpperCase().trim() },
      { $inc: { usage_count: 1 }, $set: { updated_at: new Date() } }
    );
    return res.modifiedCount > 0;
  }

  async toggleActive(id: ObjectId, isActive: boolean): Promise<Coupon | null> {
    return this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { is_active: isActive, updated_at: new Date() } },
      { returnDocument: "after" }
    );
  }

  async delete(id: ObjectId): Promise<boolean> {
    const res = await this.collection.deleteOne({ _id: id });
    return res.deletedCount > 0;
  }
}

export const couponsRepository = new CouponsRepository();
