import { ObjectId } from "mongodb";
import { StoresRepository } from "./stores.repository";
import { SellersRepository } from "../sellers/sellers.repository";
import {
  CreateStoreDTO,
  UpdateStoreDTO,
  StoreResponse,
  StoreDocument,
} from "./stores.types";
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../shared/errors/errors";
import { getRedisClient } from "../../infrastructure/redis/client";
import { redisKeys, redisTTL } from "../../infrastructure/redis/keys";
import { logger } from "../../infrastructure/logger";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class StoresService {
  public static async createStore(
    userId: string,
    dto: CreateStoreDTO
  ): Promise<StoreResponse> {
    const seller = await SellersRepository.findByUserId(userId);
    if (!seller) {
      throw new ForbiddenError("You must be registered as a seller to create a store.");
    }

    if (seller.status !== "approved") {
      throw new ForbiddenError(
        `Your seller status is '${seller.status}'. Stores can only be created after administrator approval.`
      );
    }

    const existingStore = await StoresRepository.findBySellerId(seller._id);
    if (existingStore) {
      throw new ConflictError("A store has already been registered for this merchant account.");
    }

    let slug = slugify(dto.name);
    const existingSlug = await StoresRepository.findBySlug(slug);
    if (existingSlug) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    const now = new Date();
    const doc: Omit<StoreDocument, "_id"> = {
      seller_id: seller._id,
      name: dto.name,
      slug,
      description: dto.description || null,
      logo_url: null,
      banner_url: null,
      contact_email: dto.contact_email || null,
      contact_phone: dto.contact_phone || null,
      address: dto.address,
      location: dto.location
        ? {
            type: "Point",
            coordinates: [dto.location.lon, dto.location.lat],
          }
        : null,
      rating_avg: 0,
      rating_count: 0,
      is_open: true,
      created_at: now,
      updated_at: now,
    };

    const created = await StoresRepository.create(doc);
    return StoresRepository.toResponse(created);
  }

  public static async getMyStore(userId: string): Promise<StoreResponse> {
    const seller = await SellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundError("Seller profile not found");
    }

    const store = await StoresRepository.findBySellerId(seller._id);
    if (!store) {
      throw new NotFoundError("Store has not been initialized for this seller");
    }

    return StoresRepository.toResponse(store);
  }

  public static async updateMyStore(
    userId: string,
    dto: UpdateStoreDTO
  ): Promise<StoreResponse> {
    const seller = await SellersRepository.findByUserId(userId);
    if (!seller) throw new NotFoundError("Seller profile not found");

    const store = await StoresRepository.findBySellerId(seller._id);
    if (!store) throw new NotFoundError("Store not found");

    const updateData: Partial<StoreDocument> = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.contact_email !== undefined ? { contact_email: dto.contact_email } : {}),
      ...(dto.contact_phone !== undefined ? { contact_phone: dto.contact_phone } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.is_open !== undefined ? { is_open: dto.is_open } : {}),
      ...(dto.location !== undefined
        ? {
            location: {
              type: "Point",
              coordinates: [dto.location.lon, dto.location.lat],
            },
          }
        : {}),
    };

    const updated = await StoresRepository.update(store._id, updateData);
    if (!updated) throw new BadRequestError("Failed updating store");

    // Invalidate Redis store cache
    try {
      const redis = getRedisClient();
      await redis.del(redisKeys.store(store.slug));
    } catch (err) {
      logger.warn({ err }, "Could not invalidate store cache");
    }

    return StoresRepository.toResponse(updated);
  }

  public static async updateLogo(userId: string, logoUrl: string): Promise<StoreResponse> {
    const seller = await SellersRepository.findByUserId(userId);
    if (!seller) throw new NotFoundError("Seller profile not found");

    const store = await StoresRepository.findBySellerId(seller._id);
    if (!store) throw new NotFoundError("Store not found");

    const updated = await StoresRepository.update(store._id, { logo_url: logoUrl });
    if (!updated) throw new BadRequestError("Failed updating store logo");

    return StoresRepository.toResponse(updated);
  }

  public static async updateBanner(userId: string, bannerUrl: string): Promise<StoreResponse> {
    const seller = await SellersRepository.findByUserId(userId);
    if (!seller) throw new NotFoundError("Seller profile not found");

    const store = await StoresRepository.findBySellerId(seller._id);
    if (!store) throw new NotFoundError("Store not found");

    const updated = await StoresRepository.update(store._id, { banner_url: bannerUrl });
    if (!updated) throw new BadRequestError("Failed updating store banner");

    return StoresRepository.toResponse(updated);
  }

  // Public operations
  public static async getStoreBySlug(slug: string): Promise<StoreResponse> {
    // Check Redis cache
    try {
      const redis = getRedisClient();
      const cached = await redis.get(redisKeys.store(slug));
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore cache error
    }

    const store = await StoresRepository.findBySlug(slug);
    if (!store) {
      throw new NotFoundError(`Store with slug '${slug}' not found`);
    }

    const res = StoresRepository.toResponse(store);

    // Save to Redis
    try {
      const redis = getRedisClient();
      await redis.set(redisKeys.store(slug), JSON.stringify(res), "EX", redisTTL.STORE);
    } catch {
      // Ignore
    }

    return res;
  }

  public static async listStores(
    skip = 0,
    limit = 20
  ): Promise<{ items: StoreResponse[]; total: number }> {
    const { items, total } = await StoresRepository.listPublic(skip, limit);
    return {
      items: items.map(StoresRepository.toResponse),
      total,
    };
  }
}
