import { ObjectId } from "mongodb";
import { getRedisClient } from "../../infrastructure/redis/client";
import { redisKeys, redisTTL } from "../../infrastructure/redis/keys";
import { ProductsRepository } from "../products/products.repository";
import { InventoryRepository } from "../inventory/inventory.repository";
import {
  Cart,
  CartItem,
  AddItemDTO,
  CartValidationResult,
  CartValidationIssue,
} from "./cart.types";
import {
  BadRequestError,
  NotFoundError,
} from "../../shared/errors/errors";

const PROMO_CODES: Record<
  string,
  { discount_percent?: number; discount_amount?: number }
> = {
  WELCOME10: { discount_percent: 10 },
  NEXORA20: { discount_percent: 20 },
  SAVE50: { discount_amount: 5000 }, // $50 in cents
};

export class CartService {
  // In-memory fallback map for environments where Redis is not active/available (e.g., local dev)
  private static inMemoryCartStore: Map<
    string,
    { data: string; expiresAt: number }
  > = new Map();

  private static async getRawCart(key: string): Promise<string | null> {
    try {
      const redis = getRedisClient();
      if (redis && (redis.status === "ready" || redis.status === "connect")) {
        const val = await redis.get(key);
        if (val) return val;
      }
    } catch {
      // Redis unavailable/closed; fall through to in-memory store
    }

    const entry = this.inMemoryCartStore.get(key);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.inMemoryCartStore.delete(key);
        return null;
      }
      return entry.data;
    }
    return null;
  }

  private static async setRawCart(
    key: string,
    data: string,
    ttlSeconds: number
  ): Promise<void> {
    // Always store in memory for rock-solid reliability
    this.inMemoryCartStore.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    try {
      const redis = getRedisClient();
      if (redis && (redis.status === "ready" || redis.status === "connect")) {
        await redis.set(key, data, "EX", ttlSeconds);
      }
    } catch {
      // Redis unavailable; in-memory store already updated
    }
  }

  private static async delRawCart(key: string): Promise<void> {
    this.inMemoryCartStore.delete(key);
    try {
      const redis = getRedisClient();
      if (redis && (redis.status === "ready" || redis.status === "connect")) {
        await redis.del(key);
      }
    } catch {
      // Redis unavailable
    }
  }

  private static resolveKey(
    userId?: string,
    guestSessionToken?: string
  ): { key: string; ttl: number } {
    if (userId) {
      return {
        key: redisKeys.userCart(userId),
        ttl: redisTTL.USER_CART,
      };
    }
    if (guestSessionToken) {
      return {
        key: redisKeys.guestCart(guestSessionToken),
        ttl: redisTTL.GUEST_CART,
      };
    }
    throw new BadRequestError(
      "User authentication or guest session token required for cart operations"
    );
  }

  private static calculateCartTotals(cart: Cart): Cart {
    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    let discount = 0;
    if (cart.coupon) {
      if (cart.coupon.discount_percent) {
        discount = Math.round((subtotal * cart.coupon.discount_percent) / 100);
      } else if (cart.coupon.discount_amount) {
        discount = Math.min(subtotal, cart.coupon.discount_amount);
      }
    }

    const total = Math.max(0, subtotal - discount);

    return {
      ...cart,
      subtotal,
      discount,
      total,
      item_count: itemCount,
      updated_at: new Date().toISOString(),
    };
  }

  public static async getCart(
    userId?: string,
    guestSessionToken?: string
  ): Promise<Cart> {
    try {
      const { key } = this.resolveKey(userId, guestSessionToken);
      const raw = await this.getRawCart(key);

      if (!raw) {
        return {
          items: [],
          subtotal: 0,
          discount: 0,
          total: 0,
          item_count: 0,
          coupon: null,
          updated_at: new Date().toISOString(),
        };
      }

      const parsed: Cart = JSON.parse(raw);
      // Auto-prune any items that have become unavailable or out of stock
      if (parsed.items && parsed.items.length > 0) {
        let hasChanges = false;
        const validItems: CartItem[] = [];
        for (const item of parsed.items) {
          try {
            const product = await ProductsRepository.findById(item.product_id);
            if (!product || product.status !== "approved" || product.is_deleted) {
              hasChanges = true;
              continue;
            }
            const variant = product.variants?.find(
              (v) => v._id.toString() === item.variant_id || (v as any).id === item.variant_id
            );
            if (!variant || variant.is_active === false) {
              hasChanges = true;
              continue;
            }
            const inv = await InventoryRepository.findByVariantId(variant._id);
            const stock = inv ? inv.quantity_available : (variant.quantity ?? 100);
            if (stock <= 0) {
              hasChanges = true;
              continue; // Automatically pruned because stock is 0
            }
            validItems.push(item);
          } catch {
            validItems.push(item);
          }
        }
        if (hasChanges) {
          parsed.items = validItems;
          const { ttl } = this.resolveKey(userId, guestSessionToken);
          const recalculated = this.calculateCartTotals(parsed);
          await this.setRawCart(key, JSON.stringify(recalculated), ttl);
          return recalculated;
        }
      }

      return this.calculateCartTotals(parsed);
    } catch {
      return {
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
        item_count: 0,
        coupon: null,
        updated_at: new Date().toISOString(),
      };
    }
  }

  public static async addItem(
    userId: string | undefined,
    guestSessionToken: string | undefined,
    dto: AddItemDTO
  ): Promise<Cart> {
    const { key, ttl } = this.resolveKey(userId, guestSessionToken);

    // 1. Verify product existence & approved status
    const product = await ProductsRepository.findById(dto.product_id);
    if (!product || product.status !== "approved") {
      throw new NotFoundError("Product not found or unavailable for purchase");
    }

    // 2. Verify variant within product (with resilient fallback matching)
    let variant = product.variants.find(
      (v) =>
        v._id.toHexString() === dto.variant_id ||
        v._id.toString() === dto.variant_id ||
        (v as any).id === dto.variant_id
    );

    if (!variant && product.variants && product.variants.length > 0) {
      variant =
        product.variants.find(
          (v) => (v as any).sku === dto.variant_id || (v as any).is_active !== false
        ) || product.variants[0];
    }

    if (!variant || variant.is_active === false) {
      throw new NotFoundError("Selected product variant is inactive or unavailable");
    }

    // 3. Verify stock in inventory
    const inventory = await InventoryRepository.findByVariantId(variant._id);
    const availableStock = inventory !== null && inventory !== undefined
      ? inventory.quantity_available
      : (variant.quantity !== undefined && variant.quantity !== null ? variant.quantity : 100);

    if (availableStock <= 0) {
      throw new BadRequestError(`"${product.name}" (${variant.name}) is currently out of stock.`);
    }

    const cart = await this.getCart(userId, guestSessionToken);
    const variantIdStr = variant._id.toHexString();
    const existingItemIndex = cart.items.findIndex(
      (item) => item.variant_id === variantIdStr || item.variant_id === dto.variant_id
    );

    const currentQty = existingItemIndex >= 0 ? cart.items[existingItemIndex].quantity : 0;
    const requestedTotal = currentQty + dto.quantity;

    if (requestedTotal > availableStock) {
      throw new BadRequestError(
        `Insufficient stock for ${variant.name}. Only ${availableStock} unit(s) currently available.`
      );
    }

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity = requestedTotal;
      cart.items[existingItemIndex].price = variant.price;
      cart.items[existingItemIndex].name = product.name;
    } else {
      const primaryImage =
        product.images && product.images.length > 0
          ? typeof product.images[0] === "string"
            ? product.images[0]
            : (product.images[0] as any)?.url || null
          : null;

      const newItem: CartItem = {
        product_id: product._id.toHexString(),
        variant_id: variantIdStr,
        store_id: product.store_id.toHexString(),
        seller_id: product.seller_id.toHexString(),
        name: product.name,
        variant_name: variant.name,
        sku: variant.sku,
        price: variant.price,
        quantity: dto.quantity,
        image_url: primaryImage,
      };
      cart.items.push(newItem);
    }

    const updatedCart = this.calculateCartTotals(cart);

    // Save with rolling TTL
    await this.setRawCart(key, JSON.stringify(updatedCart), ttl);

    return updatedCart;
  }

  public static async updateQuantity(
    userId: string | undefined,
    guestSessionToken: string | undefined,
    variantId: string,
    quantity: number
  ): Promise<Cart> {
    const { key, ttl } = this.resolveKey(userId, guestSessionToken);
    const cart = await this.getCart(userId, guestSessionToken);

    const index = cart.items.findIndex((item) => item.variant_id === variantId);
    if (index === -1) {
      throw new NotFoundError("Item not found in cart");
    }

    // Verify stock if inventory document exists
    try {
      if (ObjectId.isValid(variantId)) {
        const inventory = await InventoryRepository.findByVariantId(
          new ObjectId(variantId)
        );
        if (inventory && inventory.quantity_available > 0 && quantity > inventory.quantity_available) {
          throw new BadRequestError(
            `Cannot set quantity to ${quantity}. Only ${inventory.quantity_available} unit(s) available in stock.`
          );
        }
      }
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;
    }

    cart.items[index].quantity = quantity;
    const updatedCart = this.calculateCartTotals(cart);

    await this.setRawCart(key, JSON.stringify(updatedCart), ttl);

    return updatedCart;
  }

  public static async removeItem(
    userId: string | undefined,
    guestSessionToken: string | undefined,
    variantId: string
  ): Promise<Cart> {
    const { key, ttl } = this.resolveKey(userId, guestSessionToken);
    const cart = await this.getCart(userId, guestSessionToken);

    cart.items = cart.items.filter((item) => item.variant_id !== variantId);
    const updatedCart = this.calculateCartTotals(cart);

    await this.setRawCart(key, JSON.stringify(updatedCart), ttl);

    return updatedCart;
  }

  public static async clearCart(
    userId?: string,
    guestSessionToken?: string
  ): Promise<void> {
    const { key } = this.resolveKey(userId, guestSessionToken);
    await this.delRawCart(key);
  }

  public static async mergeCart(
    userId: string,
    guestSessionToken: string
  ): Promise<Cart> {
    const userCart = await this.getCart(userId, undefined);
    const guestCart = await this.getCart(undefined, guestSessionToken);

    if (guestCart.items.length === 0) {
      return userCart;
    }

    // Merge items into user cart
    for (const gItem of guestCart.items) {
      const existingIdx = userCart.items.findIndex(
        (uItem) => uItem.variant_id === gItem.variant_id
      );

      let maxAvailable = 999;
      try {
        if (ObjectId.isValid(gItem.variant_id)) {
          const inv = await InventoryRepository.findByVariantId(
            new ObjectId(gItem.variant_id)
          );
          if (inv && inv.quantity_available > 0) {
            maxAvailable = inv.quantity_available;
          }
        }
      } catch {
        // Continue with default
      }

      if (existingIdx >= 0) {
        const combined = userCart.items[existingIdx].quantity + gItem.quantity;
        userCart.items[existingIdx].quantity = Math.min(combined, maxAvailable);
      } else {
        userCart.items.push({
          ...gItem,
          quantity: Math.min(gItem.quantity, maxAvailable),
        });
      }
    }

    // Retain guest coupon if user cart has none
    if (!userCart.coupon && guestCart.coupon) {
      userCart.coupon = guestCart.coupon;
    }

    const updatedUserCart = this.calculateCartTotals(userCart);

    await this.setRawCart(
      redisKeys.userCart(userId),
      JSON.stringify(updatedUserCart),
      redisTTL.USER_CART
    );

    await this.delRawCart(redisKeys.guestCart(guestSessionToken));

    return updatedUserCart;
  }

  public static async validateCart(
    userId?: string,
    guestSessionToken?: string
  ): Promise<CartValidationResult> {
    const { key, ttl } = this.resolveKey(userId, guestSessionToken);
    const cart = await this.getCart(userId, guestSessionToken);
    const issues: CartValidationIssue[] = [];

    const validatedItems: CartItem[] = [];

    for (const item of cart.items) {
      const product = await ProductsRepository.findById(item.product_id);
      if (!product || product.status !== "approved") {
        issues.push({
          variant_id: item.variant_id,
          sku: item.sku,
          issue: "product_unavailable",
          message: `Product "${item.name}" is no longer available.`,
        });
        continue;
      }

      const variant = product.variants.find(
        (v) =>
          v._id.toHexString() === item.variant_id ||
          v._id.toString() === item.variant_id ||
          (v as any).id === item.variant_id
      );

      if (!variant || variant.is_active === false) {
        issues.push({
          variant_id: item.variant_id,
          sku: item.sku,
          issue: "product_unavailable",
          message: `Option for "${item.name}" is no longer available.`,
        });
        continue;
      }

      if (variant.price !== item.price) {
        issues.push({
          variant_id: item.variant_id,
          sku: item.sku,
          issue: "price_changed",
          old_value: item.price,
          new_value: variant.price,
          message: `Price for "${item.name}" changed from $${(item.price / 100).toFixed(2)} to $${(variant.price / 100).toFixed(2)}.`,
        });
        item.price = variant.price;
      }

      // Check live inventory stock
      const inventory = await InventoryRepository.findByVariantId(variant._id);
      const availableStock = inventory !== null && inventory !== undefined
        ? inventory.quantity_available
        : (variant.quantity !== undefined && variant.quantity !== null ? variant.quantity : 100);

      if (availableStock <= 0) {
        issues.push({
          variant_id: item.variant_id,
          sku: item.sku,
          issue: "out_of_stock",
          message: `"${item.name}" was removed from your cart because it is now out of stock.`,
        });
        continue;
      }

      if (item.quantity > availableStock) {
        issues.push({
          variant_id: item.variant_id,
          sku: item.sku,
          issue: "insufficient_stock",
          old_value: item.quantity,
          new_value: availableStock,
          message: `Quantity for "${item.name}" was adjusted to available stock (${availableStock}).`,
        });
        item.quantity = availableStock;
      }

      validatedItems.push(item);
    }

    cart.items = validatedItems;
    const updatedCart = this.calculateCartTotals(cart);

    await this.setRawCart(key, JSON.stringify(updatedCart), ttl);

    return {
      is_valid: issues.length === 0,
      issues,
      cart: updatedCart,
    };
  }

  public static async applyCoupon(
    userId: string | undefined,
    guestSessionToken: string | undefined,
    code: string
  ): Promise<Cart> {
    const { key, ttl } = this.resolveKey(userId, guestSessionToken);
    const cart = await this.getCart(userId, guestSessionToken);

    const promo = PROMO_CODES[code.toUpperCase()];
    if (!promo) {
      throw new BadRequestError(`Coupon code "${code}" is invalid or expired.`);
    }

    cart.coupon = {
      code: code.toUpperCase(),
      discount_percent: promo.discount_percent,
      discount_amount: promo.discount_amount,
    };

    const updatedCart = this.calculateCartTotals(cart);

    await this.setRawCart(key, JSON.stringify(updatedCart), ttl);

    return updatedCart;
  }

  public static async removeCoupon(
    userId?: string,
    guestSessionToken?: string
  ): Promise<Cart> {
    const { key, ttl } = this.resolveKey(userId, guestSessionToken);
    const cart = await this.getCart(userId, guestSessionToken);

    cart.coupon = null;
    const updatedCart = this.calculateCartTotals(cart);

    await this.setRawCart(key, JSON.stringify(updatedCart), ttl);

    return updatedCart;
  }
}
