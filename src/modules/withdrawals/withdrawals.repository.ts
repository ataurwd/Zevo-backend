import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { Withdrawal, WithdrawalStatus } from "./withdrawals.types";

export class WithdrawalsRepository {
  private get collection(): Collection<Withdrawal> {
    return getDb().collection<Withdrawal>("withdrawals");
  }

  async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ seller_id: 1, created_at: -1 }, { background: true });
      await this.collection.createIndex({ status: 1, created_at: -1 }, { background: true });
    } catch {
      // Ignore during initial test
    }
  }

  async create(withdrawal: Omit<Withdrawal, "_id">): Promise<Withdrawal> {
    const res = await this.collection.insertOne(withdrawal as any);
    return { ...withdrawal, _id: res.insertedId };
  }

  async findById(id: string | ObjectId): Promise<Withdrawal | null> {
    const _id = typeof id === "string" ? new ObjectId(id) : id;
    return this.collection.findOne({ _id });
  }

  async findBySeller(sellerId: ObjectId): Promise<Withdrawal[]> {
    return this.collection.find({ seller_id: sellerId }).sort({ created_at: -1 }).toArray();
  }

  async listAll(
    status?: WithdrawalStatus,
    limit = 20,
    skip = 0
  ): Promise<{ withdrawals: Withdrawal[]; total: number }> {
    const query = status ? { status } : {};
    const [withdrawals, total] = await Promise.all([
      this.collection.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(query),
    ]);
    return { withdrawals, total };
  }

  async updateStatus(
    id: ObjectId,
    status: WithdrawalStatus,
    adminNotes?: string
  ): Promise<Withdrawal | null> {
    const now = new Date();
    const updateFields: any = {
      status,
      updated_at: now,
    };
    if (adminNotes) {
      updateFields.admin_notes = adminNotes;
    }
    if (status === "processed" || status === "approved") {
      updateFields.processed_at = now;
    }

    return this.collection.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { returnDocument: "after" }
    );
  }
}

export const withdrawalsRepository = new WithdrawalsRepository();
