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
    const { key } = this.resolveKey(userId, guestSessionToken);
    const redis = getRedisClient();
    const raw = await redis.get(key);

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

    try {
      const parsed: Cart = JSON.parse(raw);
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

    // 2. Verify variant within product
    const variant = product.variants.find(
      (v) => v._id.toHexString() === dto.variant_id
    );
    if (!variant || !variant.is_active) {
      throw new NotFoundError("Selected product variant is inactive or unavailable");
    }

    // 3. Verify stock in inventory
    const inventory = await InventoryRepository.findByVariantId(variant._id);
    const availableStock = inventory ? inventory.quantity_available : 0;

    const cart = await this.getCart(userId, guestSessionToken);
    const existingItemIndex = cart.items.findIndex(
      (item) => item.variant_id === dto.variant_id
    );

    const currentQty = existingItemIndex >= 0 ? cart.items[existingItemIndex].quantity : 0;
    const requestedTotal = currentQty + dto.quantity;

    if (inventory && requestedTotal > availableStock) {
      throw new BadRequestError(
        `Insufficient stock for ${variant.name}. Only ${availableStock} unit(s) currently available.`
      );
    }

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity = requestedTotal;
      // Refresh current price and name
      cart.items[existingItemIndex].price = variant.price;
      cart.items[existingItemIndex].name = product.name;
    } else {
      const primaryImage =
        product.images && product.images.length > 0 ? product.images[0] : null;

      const newItem: CartItem = {
        product_id: product._id.toHexString(),
        variant_id: variant._id.toHexString(),
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

    // Save to Redis with rolling TTL
    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(updatedCart), "EX", ttl);

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

    // Verify stock
    const inventory = await InventoryRepository.findByVariantId(
      new ObjectId(variantId)
    );
    if (inventory && quantity > inventory.quantity_available) {
      throw new BadRequestError(
        `Cannot set quantity to ${quantity}. Only ${inventory.quantity_available} unit(s) available in stock.`
      );
    }

    cart.items[index].quantity = quantity;
    const updatedCart = this.calculateCartTotals(cart);

    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(updatedCart), "EX", ttl);

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

    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(updatedCart), "EX", ttl);

    return updatedCart;
  }

  public static async clearCart(
    userId?: string,
    guestSessionToken?: string
  ): Promise<void> {
    const { key } = this.resolveKey(userId, guestSessionToken);
    const redis = getRedisClient();
    await redis.del(key);
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

      // Check available stock
      const inventory = await InventoryRepository.findByVariantId(
        new ObjectId(gItem.variant_id)
      );
      const maxAvailable = inventory ? inventory.quantity_available : 999;

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

    const redis = getRedisClient();
    // Save to user cart in Redis
    await redis.set(
      redisKeys.userCart(userId),
      JSON.stringify(updatedUserCart),
      "EX",
      redisTTL.USER_CART
    );

    // Delete guest cart
    await redis.del(redisKeys.guestCart(guestSessionToken));

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
        continue; // Exclude from active validated cart
      }

      const variant = product.variants.find(
        (v) => v._id.toHexString() === item.variant_id
      );
      if (!variant || !variant.is_active) {
        issues.push({
          variant_id: item.variant_id,
          sku: item.sku,
          issue: "product_unavailable",
          message: `Variant "${item.variant_name}" is no longer active.`,
        });
        continue;
      }

      // Check price change
      if (variant.price !== item.price) {
        issues.push({
          variant_id: item.variant_id,
          sku: item.sku,
          issue: "price_changed",
          old_value: item.price,
          new_value: variant.price,
          message: `Price for "${item.name} (${item.variant_name})" updated from $${(
            item.price / 100
          ).toFixed(2)} to $${(variant.price / 100).toFixed(2)}.`,
        });
        item.price = variant.price;
      }

      // Check available stock
      const inventory = await InventoryRepository.findByVariantId(variant._id);
      const available = inventory ? inventory.quantity_available : 0;

      if (available <= 0) {
        issues.push({
          variant_id: item.variant_id,
          sku: item.sku,
          issue: "out_of_stock",
          message: `Item "${item.name} (${item.variant_name})" is currently out of stock.`,
        });
        continue;
      } else if (item.quantity > available) {
        issues.push({
          variant_id: item.variant_id,
          sku: item.sku,
          issue: "insufficient_stock",
          old_value: item.quantity,
          new_value: available,
          message: `Quantity for "${item.name}" adjusted from ${item.quantity} to maximum available stock (${available}).`,
        });
        item.quantity = available;
      }

      validatedItems.push(item);
    }

    cart.items = validatedItems;
    const updatedCart = this.calculateCartTotals(cart);

    // Save updated cart to Redis
    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(updatedCart), "EX", ttl);

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

    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(updatedCart), "EX", ttl);

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

    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(updatedCart), "EX", ttl);

    return updatedCart;
  }
}
