import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { CategoryDocument, CategoryResponse } from "./categories.types";

export class CategoriesRepository {
  private static getCollection(): Collection<CategoryDocument> {
    return getDb().collection<CategoryDocument>("categories");
  }

  public static async findAllActive(): Promise<CategoryDocument[]> {
    return await this.getCollection()
      .find({ is_active: true })
      .sort({ sort_order: 1, name: 1 })
      .toArray();
  }

  public static async findRoots(): Promise<CategoryDocument[]> {
    return await this.getCollection()
      .find({ parent_id: null, is_active: true })
      .sort({ sort_order: 1, name: 1 })
      .toArray();
  }

  public static async findByParentId(parentId: string | ObjectId): Promise<CategoryDocument[]> {
    const objectId = typeof parentId === "string" ? new ObjectId(parentId) : parentId;
    return await this.getCollection()
      .find({ parent_id: objectId, is_active: true })
      .sort({ sort_order: 1, name: 1 })
      .toArray();
  }

  public static async findBySlug(slug: string): Promise<CategoryDocument | null> {
    return await this.getCollection().findOne({ slug: slug.toLowerCase() });
  }

  public static async findById(id: string | ObjectId): Promise<CategoryDocument | null> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    return await this.getCollection().findOne({ _id: objectId });
  }

  public static async create(data: Omit<CategoryDocument, "_id">): Promise<CategoryDocument> {
    const res = await this.getCollection().insertOne(data as CategoryDocument);
    return {
      _id: res.insertedId,
      ...data,
    };
  }

  public static async update(
    id: string | ObjectId,
    updateData: Partial<CategoryDocument>
  ): Promise<CategoryDocument | null> {
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

  public static async softDelete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === "string" ? new ObjectId(id) : id;
    const res = await this.getCollection().updateOne(
      { _id: objectId },
      { $set: { is_active: false, updated_at: new Date() } }
    );
    return res.modifiedCount > 0;
  }

  public static toResponse(doc: CategoryDocument): CategoryResponse {
    return {
      id: doc._id.toString(),
      name: doc.name,
      slug: doc.slug,
      parent_id: doc.parent_id ? doc.parent_id.toString() : null,
      image_url: doc.image_url || null,
      is_active: doc.is_active,
      sort_order: doc.sort_order,
      created_at: doc.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString(),
    };
  }
}
