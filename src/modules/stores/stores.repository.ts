import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { StoreDocument, StoreResponse } from "./stores.types";

export class StoresRepository {
  private static getCollection(): Collection<StoreDocument> {
    return getDb().collection<StoreDocument>("stores");
  }

  public static async findBySellerId(sellerId: string | ObjectId): Promise<StoreDocument | null> {
    const objectId = typeof sellerId === "string" ? new ObjectId(sellerId) : sellerId;
    return this.getCollection().findOne({ seller_id: objectId });
  }

  public static async findBySlug(slug: string): Promise<StoreDocument | null> {
    return this.getCollection().findOne({ slug: slug.toLowerCase() });
  }

  public static async findById(id: string | ObjectId): Promise<StoreDocument | null> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    return this.getCollection().findOne({ _id: objectId });
  }

  public static async create(data: Omit<StoreDocument, "_id">): Promise<StoreDocument> {
    const res = await this.getCollection().insertOne(data as StoreDocument);
    return {
      _id: res.insertedId,
      ...data,
    };
  }

  public static async update(
    id: string | ObjectId,
    updateData: Partial<StoreDocument>
  ): Promise<StoreDocument | null> {
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

  public static async listPublic(skip = 0, limit = 20): Promise<{ items: StoreDocument[]; total: number }> {
    const col = this.getCollection();
    const [items, total] = await Promise.all([
      col.find({ is_open: true }).sort({ rating_avg: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments({ is_open: true }),
    ]);
    return { items, total };
  }

  public static toResponse(doc: StoreDocument): StoreResponse {
    return {
      id: doc._id.toString(),
      seller_id: doc.seller_id.toString(),
      name: doc.name,
      slug: doc.slug,
      description: doc.description || null,
      logo_url: doc.logo_url || null,
      banner_url: doc.banner_url || null,
      contact_email: doc.contact_email || null,
      contact_phone: doc.contact_phone || null,
      address: doc.address,
      location: doc.location || null,
      rating_avg: doc.rating_avg || 0,
      rating_count: doc.rating_count || 0,
      is_open: doc.is_open,
      created_at: doc.created_at.toISOString(),
    };
  }
}
