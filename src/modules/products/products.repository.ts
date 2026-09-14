import { Collection, ObjectId, Filter } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import {
  ProductDocument,
  ProductResponse,
  ProductFilterQuery,
} from "./products.types";

export class ProductsRepository {
  private static getCollection(): Collection<ProductDocument> {
    return getDb().collection<ProductDocument>("products");
  }

  public static async findById(id: string | ObjectId): Promise<ProductDocument | null> {
    if (typeof id === "string" && (!ObjectId.isValid(id) || id.length !== 24)) {
      return null;
    }
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    return await this.getCollection().findOne({ _id: objectId, is_deleted: false });
  }

  public static async findByIdOrSlug(identifier: string): Promise<ProductDocument | null> {
    const col = this.getCollection();
    const clean = decodeURIComponent(identifier).trim();

    // 1. If valid 24-hex ObjectId, check by _id first
    if (ObjectId.isValid(clean) && clean.length === 24) {
      const byId = await col.findOne({ _id: new ObjectId(clean), is_deleted: false });
      if (byId) return byId;
    }

    // 2. Try exact slug match
    const bySlug = await col.findOne({ slug: clean, is_deleted: false });
    if (bySlug) return bySlug;

    // 3. Try case-insensitive slug match
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bySlugCi = await col.findOne({
      slug: { $regex: new RegExp(`^${escaped}$`, "i") },
      is_deleted: false,
    });
    if (bySlugCi) return bySlugCi;

    // 4. Try exact or case-insensitive name match (converting dashes to spaces or as is)
    const nameWithSpaces = clean.replace(/[-_]+/g, " ");
    const escapedNameWithSpaces = nameWithSpaces.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const byName = await col.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${escaped}$`, "i") } },
        { name: { $regex: new RegExp(`^${escapedNameWithSpaces}$`, "i") } },
      ],
      is_deleted: false,
    });
    if (byName) return byName;

    // 5. Try slug prefix match (e.g. if slug has random suffix)
    const bySlugPrefix = await col.findOne({
      slug: { $regex: new RegExp(`^${escaped}`, "i") },
      is_deleted: false,
    });
    if (bySlugPrefix) return bySlugPrefix;

    return null;
  }

  public static async findBySlug(slug: string, storeId?: string | ObjectId): Promise<ProductDocument | null> {
    const query: Filter<ProductDocument> = { slug, is_deleted: false };
    if (storeId) {
      query.store_id = typeof storeId === "string" ? new ObjectId(storeId) : storeId;
    }
    return await this.getCollection().findOne(query);
  }

  public static async findByVariantId(variantId: string | ObjectId): Promise<ProductDocument | null> {
    const objectId = typeof variantId === "string" && ObjectId.isValid(variantId) ? new ObjectId(variantId) : variantId;
    const vStr = variantId.toString();
    return await this.getCollection().findOne({
      "variants._id": { $in: [objectId, vStr] } as any,
      is_deleted: false,
    });
  }

  public static async findBySellerId(sellerId: string | ObjectId): Promise<ProductDocument[]> {
    const objectId = typeof sellerId === "string" ? new ObjectId(sellerId) : sellerId;
    return await this.getCollection()
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

  public static async delete(id: string | ObjectId): Promise<boolean> {
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

  public static softDelete(id: string | ObjectId): Promise<boolean> {
    return this.delete(id);
  }

  public static async searchPublic(
    filter: ProductFilterQuery
  ): Promise<{ items: ProductDocument[]; total: number }> {
    const query: Filter<ProductDocument> = {
      status: "approved",
      is_deleted: false,
    };

    if (filter.category) {
      try {
        query.category_id = new ObjectId(filter.category);
      } catch {
        (query as any).$or = [
          { category_id: filter.category },
          { tags: filter.category.toLowerCase() },
        ];
      }
    }

    if (filter.store) {
      try {
        query.store_id = new ObjectId(filter.store);
      } catch {
        // Ignore invalid store ObjectId
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
      store_id: doc.store_id ? doc.store_id.toString() : "",
      seller_id: doc.seller_id ? doc.seller_id.toString() : "",
      category_id: doc.category_id ? doc.category_id.toString() : "",
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      status: doc.status,
      rejection_reason: doc.rejection_reason || null,
      images: doc.images || [],
      tags: doc.tags || [],
      attributes: doc.attributes || [],
      variants: (doc.variants || []).map((v) => ({
        id: v._id ? v._id.toString() : "",
        sku: v.sku,
        name: v.name,
        attributes: v.attributes || {},
        price: v.price,
        compare_at_price: v.compare_at_price || null,
        weight_grams: v.weight_grams || null,
        quantity: v.quantity ?? null,
        is_active: v.is_active,
      })),
      base_price: doc.base_price,
      compare_at_price: doc.compare_at_price || null,
      shipping: doc.shipping || null,
      selling_type: doc.selling_type || null,
      inventory_quantity: doc.inventory_quantity ?? null,
      rating_avg: doc.rating_avg || 0,
      rating_count: doc.rating_count || 0,
      total_sold: doc.total_sold || 0,
      created_at: doc.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString(),
    };
  }
}
