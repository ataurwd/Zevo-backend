/**
 * Centralized Redis Key Patterns
 * Format: {domain}:{resource}:{identifier}
 * As defined in docs/08-CACHING-REDIS-DESIGN.md
 */
export const redisKeys = {
  // Product & Catalog Cache
  product: (id: string) => `product:${id}`,
  productsByCategory: (slug: string, page = 1) => `products:category:${slug}:page:${page}`,
  categoriesTree: () => "categories:tree",
  store: (slug: string) => `store:${slug}`,

  // Cart
  guestCart: (sessionToken: string) => `cart:guest:${sessionToken}`,
  userCart: (userId: string) => `cart:user:${userId}`,

  // Authentication & Tokens
  otpEmail: (email: string) => `otp:email:${email.toLowerCase().trim()}`,
  otpPhone: (phone: string) => `otp:phone:${phone}`,
  refreshTokenBlacklist: (jti: string) => `blacklist:rt:${jti}`,
  userForceLogout: (userId: string) => `user:force_logout:${userId}`,

  // Rate Limiting
  rateLimitIp: (ip: string, action: string) => `ratelimit:ip:${ip}:${action}`,
  rateLimitUser: (userId: string, action: string) => `ratelimit:user:${userId}:${action}`,

  // Real-time Delivery & Geolocation
  riderLocation: (riderId: string) => `rider:location:${riderId}`,
  riderGeoKey: () => "riders:locations",

  // Distributed Locks
  lockAssignment: (riderId: string) => `lock:assignment:${riderId}`,
  lockInventory: (sku: string) => `lock:inventory:${sku}`,
} as const;

export const redisTTL = {
  PRODUCT: 60 * 10,                 // 10 minutes
  CATEGORY_PRODUCTS: 60 * 5,        // 5 minutes
  CATEGORIES_TREE: 60 * 60,         // 1 hour
  STORE: 60 * 15,                   // 15 minutes
  GUEST_CART: 60 * 60 * 24 * 7,     // 7 days
  USER_CART: 60 * 60 * 24 * 30,     // 30 days
  OTP_EMAIL: 60 * 10,               // 10 minutes
  OTP_PHONE: 60 * 5,                // 5 minutes
  RIDER_LOCATION: 30,               // 30 seconds
  LOCK_ASSIGNMENT: 10,              // 10 seconds
  LOCK_INVENTORY: 5,                // 5 seconds
} as const;
