import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { AddressDocument, AddressResponse } from "./users.types";

export class AddressesRepository {
  private static getCollection(): Collection<AddressDocument> {
    return getDb().collection<AddressDocument>("addresses");
  }

  public static async findByUserId(userId: string | ObjectId): Promise<AddressDocument[]> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    return this.getCollection()
      .find({ user_id: userObjectId })
      .sort({ is_default: -1, created_at: -1 })
      .toArray();
  }

  public static async findById(
    addressId: string | ObjectId,
    userId: string | ObjectId
  ): Promise<AddressDocument | null> {
    const addrObjectId = typeof addressId === "string" ? new ObjectId(addressId) : addressId;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    return this.getCollection().findOne({
      _id: addrObjectId,
      user_id: userObjectId,
    });
  }

  public static async create(data: Omit<AddressDocument, "_id">): Promise<AddressDocument> {
    const col = this.getCollection();

    // Check if user has any addresses
    const count = await col.countDocuments({ user_id: data.user_id });
    const shouldBeDefault = count === 0 ? true : Boolean(data.is_default);

    if (shouldBeDefault && count > 0) {
      await col.updateMany(
        { user_id: data.user_id },
        { $set: { is_default: false, updated_at: new Date() } }
      );
    }

    const docToInsert = {
      ...data,
      is_default: shouldBeDefault,
    };

    const res = await col.insertOne(docToInsert as AddressDocument);
    return {
      _id: res.insertedId,
      ...docToInsert,
    };
  }

  public static async update(
    addressId: string | ObjectId,
    userId: string | ObjectId,
    updateData: Partial<AddressDocument>
  ): Promise<AddressDocument | null> {
    const col = this.getCollection();
    const addrObjectId = typeof addressId === "string" ? new ObjectId(addressId) : addressId;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;

    if (updateData.is_default) {
      await col.updateMany(
        { user_id: userObjectId },
        { $set: { is_default: false, updated_at: new Date() } }
      );
    }

    const res = await col.findOneAndUpdate(
      { _id: addrObjectId, user_id: userObjectId },
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

  public static async setDefault(
    addressId: string | ObjectId,
    userId: string | ObjectId
  ): Promise<AddressDocument | null> {
    return this.update(addressId, userId, { is_default: true });
  }

  public static async delete(
    addressId: string | ObjectId,
    userId: string | ObjectId
  ): Promise<boolean> {
    const addrObjectId = typeof addressId === "string" ? new ObjectId(addressId) : addressId;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;

    const res = await this.getCollection().deleteOne({
      _id: addrObjectId,
      user_id: userObjectId,
    });
    return res.deletedCount > 0;
  }

  public static toResponse(doc: AddressDocument): AddressResponse {
    return {
      id: doc._id.toString(),
      label: doc.label || null,
      recipient_name: doc.recipient_name,
      phone: doc.phone,
      line1: doc.line1,
      line2: doc.line2 || null,
      city: doc.city,
      state: doc.state,
      postal_code: doc.postal_code,
      country: doc.country,
      location: doc.location || null,
      is_default: doc.is_default,
      created_at: doc.created_at.toISOString(),
    };
  }
}
