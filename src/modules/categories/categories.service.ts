import { ObjectId } from "mongodb";
import { CategoriesRepository } from "./categories.repository";
import {
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CategoryResponse,
  CategoryNode,
  CategoryDocument,
} from "./categories.types";
import { ConflictError, NotFoundError } from "../../shared/errors/errors";
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

export class CategoriesService {
  public static async getCategoryTree(): Promise<CategoryNode[]> {
    // 1. Check Redis Cache
    try {
      const redis = getRedisClient();
      const cached = await redis.get(redisKeys.categoriesTree());
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore cache failures
    }

    // 2. Fetch from Mongo
    const all = await CategoriesRepository.findAllActive();
    const map = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];

    all.forEach((doc) => {
      const node: CategoryNode = {
        ...CategoriesRepository.toResponse(doc),
        children: [],
      };
      map.set(node.id, node);
    });

    all.forEach((doc) => {
      const node = map.get(doc._id.toString())!;
      if (doc.parent_id) {
        const parent = map.get(doc.parent_id.toString());
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    // 3. Cache in Redis
    try {
      const redis = getRedisClient();
      await redis.set(
        redisKeys.categoriesTree(),
        JSON.stringify(roots),
        "EX",
        redisTTL.CATEGORIES_TREE
      );
    } catch (err) {
      logger.warn({ err }, "Failed caching categories tree");
    }

    return roots;
  }

  public static async getBySlug(
    slug: string
  ): Promise<{ category: CategoryResponse; children: CategoryResponse[] }> {
    const category = await CategoriesRepository.findBySlug(slug);
    if (!category) {
      throw new NotFoundError(`Category with slug '${slug}' not found`);
    }

    const children = await CategoriesRepository.findByParentId(category._id);
    return {
      category: CategoriesRepository.toResponse(category),
      children: children.map(CategoriesRepository.toResponse),
    };
  }

  // Admin Actions
  public static async createCategory(dto: CreateCategoryDTO): Promise<CategoryResponse> {
    let slug = slugify(dto.name);
    const existing = await CategoriesRepository.findBySlug(slug);
    if (existing) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    let parentObjectId: ObjectId | null = null;
    if (dto.parent_id) {
      const parent = await CategoriesRepository.findById(dto.parent_id);
      if (!parent) {
        throw new NotFoundError(`Parent category '${dto.parent_id}' not found`);
      }
      parentObjectId = parent._id;
    }

    const now = new Date();
    const doc: Omit<CategoryDocument, "_id"> = {
      name: dto.name,
      slug,
      parent_id: parentObjectId,
      image_url: dto.image_url || null,
      is_active: true,
      sort_order: dto.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    };

    const created = await CategoriesRepository.create(doc);
    await this.invalidateCache();
    return CategoriesRepository.toResponse(created);
  }

  public static async updateCategory(
    id: string,
    dto: UpdateCategoryDTO
  ): Promise<CategoryResponse> {
    const updateData: Partial<CategoryDocument> = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.image_url !== undefined ? { image_url: dto.image_url } : {}),
      ...(dto.sort_order !== undefined ? { sort_order: dto.sort_order } : {}),
      ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      ...(dto.parent_id !== undefined
        ? { parent_id: dto.parent_id ? new ObjectId(dto.parent_id) : null }
        : {}),
    };

    const updated = await CategoriesRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundError("Category not found");
    }

    await this.invalidateCache();
    return CategoriesRepository.toResponse(updated);
  }

  public static async deleteCategory(id: string): Promise<void> {
    const success = await CategoriesRepository.softDelete(id);
    if (!success) {
      throw new NotFoundError("Category not found");
    }
    await this.invalidateCache();
  }

  private static async invalidateCache(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(redisKeys.categoriesTree());
    } catch (err) {
      logger.warn({ err }, "Failed invalidating category tree cache");
    }
  }
}
