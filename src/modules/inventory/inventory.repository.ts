import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import {
  InventoryDocument,
  InventoryTransactionDocument,
  InventoryResponse,
  InventoryTransactionResponse,
  InventoryFilterQuery,
} from "./inventory.types";

export class InventoryRepository {
  private static get collection(): Collection<InventoryDocument> {
    return getDb().collection<InventoryDocument>("inventory");
  }

  private static get transactionCollection(): Collection<InventoryTransactionDocument> {
    return getDb().collection<InventoryTransactionDocument>("inventory_transactions");
  }

  public static async create(
    doc: Omit<InventoryDocument, "_id">
  ): Promise<InventoryDocument> {
    const result = await this.collection.insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  }

  public static async findBySku(
    sku: string,
    sellerId?: ObjectId
  ): Promise<InventoryDocument | null> {
    const query: any = { sku };
    if (sellerId) query.seller_id = sellerId;
    return this.collection.findOne(query);
  }

  public static async findByVariantId(
    variantId: ObjectId
  ): Promise<InventoryDocument | null> {
    return this.collection.findOne({ variant_id: variantId });
  }

  public static async findBySellerId(
    sellerId: ObjectId,
    filter: InventoryFilterQuery = {}
  ): Promise<{ items: InventoryDocument[]; total: number }> {
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;

    const query: any = { seller_id: sellerId };

    if (filter.search) {
      query.sku = { $regex: filter.search, $options: "i" };
    }

    if (filter.low_stock_only) {
      query.$expr = { $lte: ["$quantity_available", "$low_stock_threshold"] };
    }

    const [items, total] = await Promise.all([
      this.collection.find(query).sort({ updated_at: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(query),
    ]);

    return { items, total };
  }

  public static async atomicUpdateStock(
    sku: string,
    sellerId: ObjectId,
    quantityChange: number
  ): Promise<InventoryDocument | null> {
    const query: any = {
      sku,
      seller_id: sellerId,
    };

    // If decreasing stock, ensure available won't go below 0
    if (quantityChange < 0) {
      query.quantity_available = { $gte: Math.abs(quantityChange) };
    }

    const result = await this.collection.findOneAndUpdate(
      query,
      {
        $inc: { quantity_available: quantityChange },
        $set: { updated_at: new Date() },
      },
      { returnDocument: "after" }
    );

    return result || null;
  }

  public static async atomicReserve(
    variantId: ObjectId,
    quantity: number
  ): Promise<InventoryDocument | null> {
    const result = await this.collection.findOneAndUpdate(
      {
        variant_id: variantId,
        quantity_available: { $gte: quantity },
      },
      {
        $inc: {
          quantity_available: -quantity,
          quantity_reserved: quantity,
        },
        $set: { updated_at: new Date() },
      },
      { returnDocument: "after" }
    );

    return result || null;
  }

  public static async atomicRelease(
    variantId: ObjectId,
    quantity: number
  ): Promise<InventoryDocument | null> {
    const result = await this.collection.findOneAndUpdate(
      {
        variant_id: variantId,
        quantity_reserved: { $gte: quantity },
      },
      {
        $inc: {
          quantity_available: quantity,
          quantity_reserved: -quantity,
        },
        $set: { updated_at: new Date() },
      },
      { returnDocument: "after" }
    );

    return result || null;
  }

  public static async atomicDeduct(
    variantId: ObjectId,
    quantity: number
  ): Promise<InventoryDocument | null> {
    const result = await this.collection.findOneAndUpdate(
      {
        variant_id: variantId,
        quantity_reserved: { $gte: quantity },
      },
      {
        $inc: {
          quantity_reserved: -quantity,
        },
        $set: { updated_at: new Date() },
      },
      { returnDocument: "after" }
    );

    return result || null;
  }

  public static async setThreshold(
    sku: string,
    sellerId: ObjectId,
    threshold: number
  ): Promise<InventoryDocument | null> {
    const result = await this.collection.findOneAndUpdate(
      { sku, seller_id: sellerId },
      {
        $set: {
          low_stock_threshold: threshold,
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    return result || null;
  }

  public static async logTransaction(
    doc: Omit<InventoryTransactionDocument, "_id">
  ): Promise<InventoryTransactionDocument> {
    const result = await this.transactionCollection.insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  }

  public static async getTransactionsBySeller(
    sellerId: ObjectId,
    limit = 50
  ): Promise<InventoryTransactionDocument[]> {
    // Lookup transactions by inventory records owned by this seller
    const sellerInventory = await this.collection
      .find({ seller_id: sellerId }, { projection: { _id: 1 } })
      .toArray();
    const inventoryIds = sellerInventory.map((i) => i._id);

    return this.transactionCollection
      .find({ inventory_id: { $in: inventoryIds } })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  public static async adminListAll(
    skip = 0,
    limit = 50
  ): Promise<{ items: InventoryDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.collection.find().sort({ updated_at: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(),
    ]);
    return { items, total };
  }

  public static toResponse(doc: InventoryDocument): InventoryResponse {
    return {
      id: doc._id.toHexString(),
      product_id: doc.product_id.toHexString(),
      variant_id: doc.variant_id.toHexString(),
      sku: doc.sku,
      store_id: doc.store_id.toHexString(),
      seller_id: doc.seller_id.toHexString(),
      quantity_available: doc.quantity_available,
      quantity_reserved: doc.quantity_reserved,
      low_stock_threshold: doc.low_stock_threshold,
      is_low_stock: doc.quantity_available <= doc.low_stock_threshold,
      is_trackable: doc.is_trackable,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
    };
  }

  public static toTransactionResponse(
    doc: InventoryTransactionDocument
  ): InventoryTransactionResponse {
    return {
      id: doc._id.toHexString(),
      inventory_id: doc.inventory_id.toHexString(),
      sku: doc.sku,
      type: doc.type,
      quantity_change: doc.quantity_change,
      balance_after: doc.balance_after,
      reference_id: doc.reference_id,
      reason: doc.reason,
      created_at: doc.created_at.toISOString(),
    };
  }
}
