export interface RevenueTimePoint {
  date: string;
  revenue: number; // in cents
  orders: number;
}

export interface TopProductMetric {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue: number; // in cents
}

export interface SellerAnalytics {
  total_revenue: number; // in cents
  net_earnings: number; // in cents
  total_commission: number; // in cents
  total_orders: number;
  delivered_orders: number;
  pending_orders: number;
  revenue_chart: RevenueTimePoint[];
  top_products: TopProductMetric[];
}

export interface TopStoreMetric {
  store_id: string;
  store_name: string;
  total_gmv: number;
  orders_count: number;
}

export interface AdminAnalytics {
  platform_gmv: number; // in cents
  total_platform_fees: number; // in cents
  total_orders: number;
  total_sellers: number;
  total_riders: number;
  active_riders_online: number;
  revenue_chart: RevenueTimePoint[];
  top_stores: TopStoreMetric[];
}
