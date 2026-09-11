import { Collection, ObjectId, Filter } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import {
  ProductDocument,
  ProductResponse,
  ProductFilterQuery,
  ProductVariant,
} from "./products.types";

export class ProductsRepository {
  private static getCollection(): Collection<ProductDocument> {
    return getDb().collection<ProductDocument>("products");
  }

  public static async findById(id: string | ObjectId): Promise<ProductDocument | null> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    return this.getCollection().findOne({ _id: objectId, is_deleted: false });
  }

  public static async findBySlug(slug: string, storeId: string | ObjectId): Promise<ProductDocument | null> {
    const storeObjectId = typeof storeId === "string" ? new ObjectId(storeId) : storeId;
    return this.getCollection().findOne({ slug, store_id: storeObjectId, is_deleted: false });
  }

  public static async findBySellerId(sellerId: string | ObjectId): Promise<ProductDocument[]> {
    const objectId = typeof sellerId === "string" ? new ObjectId(sellerId) : sellerId;
    return this.getCollection()
      .find({ seller_id: objectId, is_deleted: false })
      .sort({ created_at: -1 })
      .toArray();
  }

  public static async create(data: Omit<ProductDocument, "_id">): Promise<ProductDocument> {
    const res = await this.getCollection().insertOne(data as ProductDocument);
    return {
      _id: res.insertedId,
      ...data,
    };
  }

  public static async update(
    id: string | ObjectId,
    updateData: Partial<ProductDocument>
  ): Promise<ProductDocument | null> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    const res = await this.getCollection().findOneAndUpdate(
      { _id: objectId, is_deleted: false },
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

  public static async softDelete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    const res = await this.getCollection().updateOne(
      { _id: objectId },
      {
        $set: {
          is_deleted: true,
          deleted_at: new Date(),
          updated_at: new Date(),
        },
      }
    );
    return res.modifiedCount > 0;
  }

  public static async searchPublic(
    filter: ProductFilterQuery
  ): Promise<{ items: ProductDocument[]; total: number }> {
    const query: Filter<ProductDocument> = {
      status: "approved",
      is_deleted: false,
    };

    if (filter.category) {
      // Allow category filter by ID or slug lookup
      try {
        query.category_id = new ObjectId(filter.category);
      } catch {
        // Ignored if slug
      }
    }

    if (filter.store) {
      try {
        query.store_id = new ObjectId(filter.store);
      } catch {
        // Ignore
      }
    }

    if (filter.min_price !== undefined || filter.max_price !== undefined) {
      query.base_price = {};
      if (filter.min_price !== undefined) query.base_price.$gte = Number(filter.min_price);
      if (filter.max_price !== undefined) query.base_price.$lte = Number(filter.max_price);
    }

    if (filter.rating !== undefined) {
      query.rating_avg = { $gte: Number(filter.rating) };
    }

    if (filter.q) {
      const regex = new RegExp(filter.q, "i");
      query.$or = [{ name: regex }, { description: regex }, { tags: regex }];
    }

    let sortOption: Record<string, 1 | -1> = { created_at: -1 };
    if (filter.sort === "price_asc") sortOption = { base_price: 1 };
    else if (filter.sort === "price_desc") sortOption = { base_price: -1 };
    else if (filter.sort === "rating") sortOption = { rating_avg: -1 };

    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const col = this.getCollection();
    const [items, total] = await Promise.all([
      col.find(query).sort(sortOption).skip(skip).limit(limit).toArray(),
      col.countDocuments(query),
    ]);

    return { items, total };
  }

  public static async listAdmin(
    status?: string,
    skip = 0,
    limit = 20
  ): Promise<{ items: ProductDocument[]; total: number }> {
    const query: Filter<ProductDocument> = { is_deleted: false };
    if (status) query.status = status as any;

    const col = this.getCollection();
    const [items, total] = await Promise.all([
      col.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(query),
    ]);

    return { items, total };
  }

  public static toResponse(doc: ProductDocument): ProductResponse {
    return {
      id: doc._id.toString(),
      store_id: doc.store_id.toString(),
      seller_id: doc.seller_id.toString(),
      category_id: doc.category_id.toString(),
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      status: doc.status,
      rejection_reason: doc.rejection_reason || null,
      images: doc.images || [],
      tags: doc.tags || [],
      attributes: doc.attributes || [],
      variants: (doc.variants || []).map((v) => ({
        id: v._id.toString(),
        sku: v.sku,
        name: v.name,
        attributes: v.attributes || {},
        price: v.price,
        compare_at_price: v.compare_at_price || null,
        weight_grams: v.weight_grams || null,
        is_active: v.is_active,
      })),
      base_price: doc.base_price,
      rating_avg: doc.rating_avg || 0,
      rating_count: doc.rating_count || 0,
      total_sold: doc.total_sold || 0,
      created_at: doc.created_at.toISOString(),
    };
  }
}
