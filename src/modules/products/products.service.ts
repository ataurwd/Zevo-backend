import crypto from "crypto";
import { ObjectId } from "mongodb";
import { ProductsRepository } from "./products.repository";
import { StoresRepository } from "../stores/stores.repository";
import { SellersRepository } from "../sellers/sellers.repository";
import { InventoryService } from "../inventory/inventory.service";
import {
  CreateProductDTO,
  UpdateProductDTO,
  CreateVariantDTO,
  ProductResponse,
  ProductFilterQuery,
  ProductDocument,
  ProductVariant,
} from "./products.types";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../shared/errors/errors";
import { getRedisClient } from "../../infrastructure/redis/client";
import { redisKeys, redisTTL } from "../../infrastructure/redis/keys";
import { AuditService } from "../../infrastructure/services/audit.service";
import { logger } from "../../infrastructure/logger";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class ProductsService {
  public static async createProduct(
    sellerUserId: string,
    dto: CreateProductDTO
  ): Promise<ProductResponse> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const store = await StoresRepository.findBySellerId(seller._id);
    if (!store) {
      throw new ForbiddenError("You must establish your store settings before publishing products.");
    }

    let slug = slugify(dto.name);
    const existingSlug = await ProductsRepository.findBySlug(slug, store._id);
    if (existingSlug) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    const variants: ProductVariant[] = dto.variants.map((v, index) => {
      const sku = v.sku?.trim() || `SKU-${Date.now()}-${index}-${crypto.randomBytes(3).toString("hex")}`.toUpperCase();
      return {
        _id: new ObjectId(),
        sku,
        name: v.name,
        attributes: v.attributes || {},
        price: v.price,
        compare_at_price: v.compare_at_price || null,
        weight_grams: v.weight_grams || null,
        is_active: v.is_active !== undefined ? v.is_active : true,
      };
    });

    const activePrices = variants.filter((v) => v.is_active).map((v) => v.price);
    const base_price = activePrices.length > 0 ? Math.min(...activePrices) : variants[0].price;

    const now = new Date();
    const doc: Omit<ProductDocument, "_id"> = {
      store_id: store._id,
      seller_id: seller._id,
      category_id: new ObjectId(dto.category_id),
      name: dto.name,
      slug,
      description: dto.description,
      status: "draft",
      rejection_reason: null,
      images: dto.images || [],
      tags: dto.tags || [],
      attributes: dto.attributes || [],
      variants,
      base_price,
      rating_avg: 0,
      rating_count: 0,
      total_sold: 0,
      is_deleted: false,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    const created = await ProductsRepository.create(doc);

    // Auto-provision inventory records for all variants
    for (const variant of created.variants) {
      await InventoryService.provisionInventoryForVariant(
        created._id,
        variant._id,
        variant.sku,
        created.store_id,
        created.seller_id
      );
    }

    await AuditService.log({
      userId: sellerUserId,
      action: "product.created",
      resourceType: "product",
      resourceId: created._id,
    });

    return ProductsRepository.toResponse(created);
  }

  public static async getSellerProducts(sellerUserId: string): Promise<ProductResponse[]> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const products = await ProductsRepository.findBySellerId(seller._id);
    return products.map(ProductsRepository.toResponse);
  }

  public static async getSellerProductById(
    sellerUserId: string,
    productId: string
  ): Promise<ProductResponse> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const product = await ProductsRepository.findById(productId);
    if (!product) throw new NotFoundError("Product not found");

    if (!product.seller_id.equals(seller._id)) {
      throw new ForbiddenError("Access denied. You do not own this product.");
    }

    return ProductsRepository.toResponse(product);
  }

  public static async updateProduct(
    sellerUserId: string,
    productId: string,
    dto: UpdateProductDTO
  ): Promise<ProductResponse> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const product = await ProductsRepository.findById(productId);
    if (!product) throw new NotFoundError("Product not found");

    if (!product.seller_id.equals(seller._id)) {
      throw new ForbiddenError("Access denied. You do not own this product.");
    }

    const updateData: Partial<ProductDocument> = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
      ...(dto.attributes !== undefined ? { attributes: dto.attributes } : {}),
      ...(dto.category_id !== undefined ? { category_id: new ObjectId(dto.category_id) } : {}),
    };

    const updated = await ProductsRepository.update(productId, updateData);
    if (!updated) throw new BadRequestError("Failed updating product");

    await this.invalidateCache(productId);
    return ProductsRepository.toResponse(updated);
  }

  public static async deleteProduct(
    sellerUserId: string,
    productId: string
  ): Promise<void> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const product = await ProductsRepository.findById(productId);
    if (!product) throw new NotFoundError("Product not found");

    if (!product.seller_id.equals(seller._id)) {
      throw new ForbiddenError("Access denied. You do not own this product.");
    }

    await ProductsRepository.softDelete(productId);
    await this.invalidateCache(productId);
  }

  // Variant operations
  public static async addVariant(
    sellerUserId: string,
    productId: string,
    dto: CreateVariantDTO
  ): Promise<ProductResponse> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const product = await ProductsRepository.findById(productId);
    if (!product) throw new NotFoundError("Product not found");

    if (!product.seller_id.equals(seller._id)) {
      throw new ForbiddenError("Access denied. You do not own this product.");
    }

    const sku = dto.sku?.trim() || `SKU-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`.toUpperCase();
    const newVariant: ProductVariant = {
      _id: new ObjectId(),
      sku,
      name: dto.name,
      attributes: dto.attributes || {},
      price: dto.price,
      compare_at_price: dto.compare_at_price || null,
      weight_grams: dto.weight_grams || null,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
    };

    const updatedVariants = [...product.variants, newVariant];
    const activePrices = updatedVariants.filter((v) => v.is_active).map((v) => v.price);
    const base_price = activePrices.length > 0 ? Math.min(...activePrices) : updatedVariants[0].price;

    const updated = await ProductsRepository.update(productId, {
      variants: updatedVariants,
      base_price,
    });

    // Auto-provision inventory for newly added variant
    await InventoryService.provisionInventoryForVariant(
      product._id,
      newVariant._id,
      newVariant.sku,
      product.store_id,
      product.seller_id
    );

    await this.invalidateCache(productId);
    return ProductsRepository.toResponse(updated!);
  }

  public static async submitForReview(
    sellerUserId: string,
    productId: string
  ): Promise<ProductResponse> {
    const seller = await SellersRepository.findByUserId(sellerUserId);
    if (!seller) throw new ForbiddenError("Seller profile not found");

    const product = await ProductsRepository.findById(productId);
    if (!product) throw new NotFoundError("Product not found");

    if (!product.seller_id.equals(seller._id)) {
      throw new ForbiddenError("Access denied. You do not own this product.");
    }

    if (product.variants.length === 0) {
      throw new BadRequestError("Cannot submit a product without variants.");
    }

    const updated = await ProductsRepository.update(productId, {
      status: "pending_review",
      rejection_reason: null,
    });

    await this.invalidateCache(productId);
    return ProductsRepository.toResponse(updated!);
  }

  // Admin Actions
  public static async adminApprove(productId: string, adminUserId: string): Promise<ProductResponse> {
    const product = await ProductsRepository.findById(productId);
    if (!product) throw new NotFoundError("Product not found");

    const updated = await ProductsRepository.update(productId, {
      status: "approved",
      rejection_reason: null,
    });

    await AuditService.log({
      userId: adminUserId,
      action: "product.approved",
      resourceType: "product",
      resourceId: productId,
    });

    await this.invalidateCache(productId);
    return ProductsRepository.toResponse(updated!);
  }

  public static async adminReject(
    productId: string,
    adminUserId: string,
    reason: string
  ): Promise<ProductResponse> {
    const product = await ProductsRepository.findById(productId);
    if (!product) throw new NotFoundError("Product not found");

    const updated = await ProductsRepository.update(productId, {
      status: "rejected",
      rejection_reason: reason,
    });

    await AuditService.log({
      userId: adminUserId,
      action: "product.rejected",
      resourceType: "product",
      resourceId: productId,
      metadata: { reason },
    });

    await this.invalidateCache(productId);
    return ProductsRepository.toResponse(updated!);
  }

  public static async adminList(
    status?: string,
    skip = 0,
    limit = 20
  ): Promise<{ items: ProductResponse[]; total: number }> {
    const { items, total } = await ProductsRepository.listAdmin(status, skip, limit);
    return {
      items: items.map(ProductsRepository.toResponse),
      total,
    };
  }

  // Public Catalog
  public static async getProductPublicById(productId: string): Promise<ProductResponse> {
    // 1. Check Redis Cache
    try {
      const redis = getRedisClient();
      const cached = await redis.get(redisKeys.product(productId));
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore
    }

    const product = await ProductsRepository.findById(productId);
    if (!product || product.status !== "approved") {
      throw new NotFoundError("Product not found or currently unavailable");
    }

    const res = ProductsRepository.toResponse(product);

    // Save to Redis
    try {
      const redis = getRedisClient();
      await redis.set(redisKeys.product(productId), JSON.stringify(res), "EX", redisTTL.PRODUCT);
    } catch {
      // Ignore
    }

    return res;
  }

  public static async browsePublic(
    filter: ProductFilterQuery
  ): Promise<{ items: ProductResponse[]; total: number }> {
    const { items, total } = await ProductsRepository.searchPublic(filter);
    return {
      items: items.map(ProductsRepository.toResponse),
      total,
    };
  }

  private static async invalidateCache(productId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(redisKeys.product(productId));
    } catch (err) {
      logger.warn({ err }, "Failed invalidating product cache");
    }
  }
}
