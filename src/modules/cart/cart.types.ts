export interface CartItem {
  product_id: string;
  variant_id: string;
  store_id: string;
  seller_id: string;
  name: string;
  variant_name: string;
  sku: string;
  price: number; // in cents
  quantity: number;
  image_url?: string | null;
}

export interface CartCoupon {
  code: string;
  discount_percent?: number;
  discount_amount?: number; // in cents
}

export interface Cart {
  items: CartItem[];
  subtotal: number; // in cents
  discount: number; // in cents
  total: number; // in cents
  item_count: number;
  coupon?: CartCoupon | null;
  updated_at: string;
}

export interface AddItemDTO {
  product_id: string;
  variant_id: string;
  quantity: number;
}

export interface UpdateQuantityDTO {
  quantity: number;
}

export interface ApplyCouponDTO {
  code: string;
}

export interface CartValidationIssue {
  variant_id: string;
  sku: string;
  issue: "price_changed" | "out_of_stock" | "insufficient_stock" | "product_unavailable";
  old_value?: any;
  new_value?: any;
  message: string;
}

export interface CartValidationResult {
  is_valid: boolean;
  issues: CartValidationIssue[];
  cart: Cart;
}
