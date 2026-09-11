import { ObjectId } from "mongodb";
import { InventoryRepository } from "./inventory.repository";
import { SellersRepository } from "../sellers/sellers.repository";
import {
  InventoryDocument,
  InventoryResponse,
  InventoryTransactionResponse,
  UpdateStockDTO,
  SetThresholdDTO,
  InventoryFilterQuery,
} from "./inventory.types";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../shared/errors/errors";
import { notificationQueue } from "../../infrastructure/queue/queues";
import { AuditService } from "../../infrastructure/services/audit.service";
import { logger } from "../../infrastructure/logger";

export class InventoryService {
  public static async provisionInventoryForVariant(
    productId: ObjectId,
    variantId: ObjectId,
    sku: string,
    storeId: ObjectId,
    sellerId: ObjectId,
    initialStock = 50
  ): Promise<InventoryDocument> {
    const existing = await InventoryRepository.findByVariantId(variantId);
    if (existing) return existing;

    const now = new Date();
    const doc: Omit<InventoryDocument, "_id"> = {
      product_id: productId,
      variant_id: variantId,
      sku,
      store_id: storeId,
      seller_id: sellerId,
      quantity_available: initialStock,
      quantity_reserved: 0,
      low_stock_threshold: 10,
      is_trackable: true,
      created_at: now,
      updated_at: now,
    };

    const created = await InventoryRepository.create(doc);

    // Record initial stocking transaction
    await InventoryRepository.logTransaction({
      inventory_id: created._id,
      product_id: productId,
      variant_id: variantId,
      sku,
      type: "restock",
      quantity_change: initialStock,
      balance_after: initialStock,
      reason: "Initial inventory provisioning on product/variant creation",
      created_by: sellerId,
      created_at: now,
    });

    return created;
  }

  public static async getSellerInventory(
    sellerUserId: string,
    filter: InventoryFilterQuery = {}
  ): Promise<{ items: InventoryResponse[]; total: number }> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const { items, total } = await InventoryRepository.findBySellerId(seller._id, filter);
    return {
      items: items.map(InventoryRepository.toResponse),
      total,
    };
  }

  public static async getInventoryBySku(
    sellerUserId: string,
    sku: string
  ): Promise<InventoryResponse> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const inventory = await InventoryRepository.findBySku(sku, seller._id);
    if (!inventory) {
      throw new NotFoundError(`Inventory record for SKU "${sku}" not found`);
    }

    return InventoryRepository.toResponse(inventory);
  }

  public static async updateStock(
    sellerUserId: string,
    sku: string,
    dto: UpdateStockDTO
  ): Promise<InventoryResponse> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const existing = await InventoryRepository.findBySku(sku, seller._id);
    if (!existing) {
      throw new NotFoundError(`Inventory record for SKU "${sku}" not found`);
    }

    if (
      dto.quantity_change < 0 &&
      Math.abs(dto.quantity_change) > existing.quantity_available
    ) {
      throw new BadRequestError(
        `Insufficient available inventory. Current available: ${existing.quantity_available}, requested decrement: ${Math.abs(
          dto.quantity_change
        )}`
      );
    }

    const updated = await InventoryRepository.atomicUpdateStock(
      sku,
      seller._id,
      dto.quantity_change
    );

    if (!updated) {
      throw new BadRequestError("Failed updating inventory stock");
    }

    // Log transaction
    await InventoryRepository.logTransaction({
      inventory_id: updated._id,
      product_id: updated.product_id,
      variant_id: updated.variant_id,
      sku: updated.sku,
      type: dto.type,
      quantity_change: dto.quantity_change,
      balance_after: updated.quantity_available,
      reason: dto.note || `Stock ${dto.type} of ${dto.quantity_change} unit(s)`,
      created_by: seller._id,
      created_at: new Date(),
    });

    await AuditService.log({
      userId: sellerUserId,
      action: `inventory.${dto.type}`,
      resourceType: "inventory",
      resourceId: updated._id,
      metadata: {
        sku: updated.sku,
        quantity_change: dto.quantity_change,
        balance_after: updated.quantity_available,
      },
    });

    // Check low-stock threshold alert
    await this.checkLowStockAlert(updated);

    return InventoryRepository.toResponse(updated);
  }

  public static async setThreshold(
    sellerUserId: string,
    sku: string,
    dto: SetThresholdDTO
  ): Promise<InventoryResponse> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const updated = await InventoryRepository.setThreshold(
      sku,
      seller._id,
      dto.low_stock_threshold
    );

    if (!updated) {
      throw new NotFoundError(`Inventory record for SKU "${sku}" not found`);
    }

    await this.checkLowStockAlert(updated);
    return InventoryRepository.toResponse(updated);
  }

  public static async getTransactions(
    sellerUserId: string,
    limit = 50
  ): Promise<InventoryTransactionResponse[]> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const txs = await InventoryRepository.getTransactionsBySeller(seller._id, limit);
    return txs.map(InventoryRepository.toTransactionResponse);
  }

  public static async reserveStock(
    variantId: string | ObjectId,
    quantity: number
  ): Promise<boolean> {
    const vId = typeof variantId === "string" ? new ObjectId(variantId) : variantId;
    const reserved = await InventoryRepository.atomicReserve(vId, quantity);
    if (!reserved) return false;

    await InventoryRepository.logTransaction({
      inventory_id: reserved._id,
      product_id: reserved.product_id,
      variant_id: reserved.variant_id,
      sku: reserved.sku,
      type: "reserve",
      quantity_change: -quantity,
      balance_after: reserved.quantity_available,
      reason: `Reserved ${quantity} unit(s) for order intent`,
      created_at: new Date(),
    });

    await this.checkLowStockAlert(reserved);
    return true;
  }

  public static async releaseStock(
    variantId: string | ObjectId,
    quantity: number,
    referenceId?: string
  ): Promise<boolean> {
    const vId = typeof variantId === "string" ? new ObjectId(variantId) : variantId;
    const released = await InventoryRepository.atomicRelease(vId, quantity);
    if (!released) return false;

    await InventoryRepository.logTransaction({
      inventory_id: released._id,
      product_id: released.product_id,
      variant_id: released.variant_id,
      sku: released.sku,
      type: "release",
      quantity_change: quantity,
      balance_after: released.quantity_available,
      reference_id: referenceId,
      reason: `Released ${quantity} reserved unit(s)`,
      created_at: new Date(),
    });

    return true;
  }

  public static async deductStock(
    variantId: string | ObjectId,
    quantity: number,
    referenceId?: string
  ): Promise<boolean> {
    const vId = typeof variantId === "string" ? new ObjectId(variantId) : variantId;
    const deducted = await InventoryRepository.atomicDeduct(vId, quantity);
    if (!deducted) return false;

    await InventoryRepository.logTransaction({
      inventory_id: deducted._id,
      product_id: deducted.product_id,
      variant_id: deducted.variant_id,
      sku: deducted.sku,
      type: "deduct",
      quantity_change: 0, // reserved balance decremented
      balance_after: deducted.quantity_available,
      reference_id: referenceId,
      reason: `Deducted ${quantity} reserved unit(s) post payment confirmation`,
      created_at: new Date(),
    });

    return true;
  }

  public static async adminListAll(
    page = 1,
    limit = 50
  ): Promise<{ items: InventoryResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    const { items, total } = await InventoryRepository.adminListAll(skip, limit);
    return {
      items: items.map(InventoryRepository.toResponse),
      total,
    };
  }

  private static async checkLowStockAlert(doc: InventoryDocument): Promise<void> {
    if (doc.quantity_available <= doc.low_stock_threshold) {
      try {
        await notificationQueue.add(
          "inventory.alert",
          {
            type: "inventory.low_stock",
            sku: doc.sku,
            product_id: doc.product_id.toHexString(),
            variant_id: doc.variant_id.toHexString(),
            quantity_available: doc.quantity_available,
            low_stock_threshold: doc.low_stock_threshold,
            seller_id: doc.seller_id.toHexString(),
          },
          { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
        );
      } catch (err) {
        logger.warn({ err, sku: doc.sku }, "Failed dispatching low-stock alert job");
      }
    }
  }
}
