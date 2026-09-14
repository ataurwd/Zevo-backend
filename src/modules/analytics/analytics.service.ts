import { ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import {
  SellerAnalytics,
  AdminAnalytics,
  RevenueTimePoint,
  TopProductMetric,
  TopStoreMetric,
} from "./analytics.types";

export class AnalyticsService {
  private get subOrdersCollection() {
    return getDb().collection("sub_orders");
  }

  private get ordersCollection() {
    return getDb().collection("orders");
  }

  private get sellersCollection() {
    return getDb().collection("sellers");
  }

  private get ridersCollection() {
    return getDb().collection("delivery_agents");
  }

  async getSellerAnalytics(sellerId: string, days = 30): Promise<SellerAnalytics> {
    const sellerObjId = new ObjectId(sellerId);
    const startDate = new Date(Date.now() - days * 86400000);

    const matchStage = {
      seller_id: sellerObjId,
      created_at: { $gte: startDate },
    };

    // 1. Overall totals aggregation
    const totalsPromise = this.subOrdersCollection
      .aggregate<{
        _id: null;
        total_revenue: number;
        net_earnings: number;
        total_commission: number;
        total_orders: number;
      }>([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total_revenue: { $sum: "$subtotal" },
            net_earnings: { $sum: "$seller_earnings" },
            total_commission: { $sum: "$platform_commission" },
            total_orders: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // 2. Status counts
    const statusCountsPromise = this.subOrdersCollection
      .aggregate<{ _id: string; count: number }>([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray();

    // 3. Daily timeseries aggregation
    const timeseriesPromise = this.subOrdersCollection
      .aggregate<{ _id: string; revenue: number; orders: number }>([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
            revenue: { $sum: "$seller_earnings" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    // 4. Top 5 selling products
    const topProductsPromise = this.subOrdersCollection
      .aggregate<TopProductMetric>([
        { $match: matchStage },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product_id",
            product_name: { $first: "$items.product_name" },
            total_quantity: { $sum: "$items.quantity" },
            total_revenue: { $sum: "$items.subtotal" },
          },
        },
        { $sort: { total_quantity: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            product_id: "$_id",
            product_name: 1,
            total_quantity: 1,
            total_revenue: 1,
          },
        },
      ])
      .toArray();

    const [totalsRes, statusRes, timeseriesRes, topProductsRes] = await Promise.all([
      totalsPromise,
      statusCountsPromise,
      timeseriesPromise,
      topProductsPromise,
    ]);

    const totals = totalsRes[0] || {
      total_revenue: 0,
      net_earnings: 0,
      total_commission: 0,
      total_orders: 0,
    };

    let deliveredCount = 0;
    let pendingCount = 0;
    for (const s of statusRes) {
      if (s._id === "delivered") deliveredCount += s.count;
      if (s._id === "pending" || s._id === "confirmed" || s._id === "preparing") {
        pendingCount += s.count;
      }
    }

    const revenue_chart: RevenueTimePoint[] = timeseriesRes.map((t) => ({
      date: t._id,
      revenue: t.revenue,
      orders: t.orders,
    }));

    return {
      total_revenue: totals.total_revenue,
      net_earnings: totals.net_earnings,
      total_commission: totals.total_commission,
      total_orders: totals.total_orders,
      delivered_orders: deliveredCount,
      pending_orders: pendingCount,
      revenue_chart,
      top_products: topProductsRes,
    };
  }

  async getAdminAnalytics(days = 30): Promise<AdminAnalytics> {
    const startDate = new Date(Date.now() - days * 86400000);
    const matchStage = { created_at: { $gte: startDate } };

    // 1. Overall platform order financials
    const financialsPromise = this.ordersCollection
      .aggregate<{
        _id: null;
        platform_gmv: number;
        total_platform_fees: number;
        total_orders: number;
      }>([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            platform_gmv: { $sum: "$total" },
            total_platform_fees: { $sum: "$platform_fee" },
            total_orders: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // 2. Headcounts
    const [totalSellers, totalRiders, activeRiders] = await Promise.all([
      this.sellersCollection.countDocuments({ status: "approved" }),
      this.ridersCollection.countDocuments({ status: "approved" }),
      this.ridersCollection.countDocuments({ status: "approved", is_online: true }),
    ]);

    // 3. Platform daily revenue timeseries
    const timeseriesPromise = this.ordersCollection
      .aggregate<{ _id: string; revenue: number; orders: number }>([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
            revenue: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    // 4. Top stores by revenue
    const topStoresPromise = this.subOrdersCollection
      .aggregate<TopStoreMetric>([
        { $match: matchStage },
        {
          $group: {
            _id: "$seller_id",
            store_name: { $first: "$order_number" }, // fallback label
            total_gmv: { $sum: "$subtotal" },
            orders_count: { $sum: 1 },
          },
        },
        { $sort: { total_gmv: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            store_id: { $toString: "$_id" },
            store_name: 1,
            total_gmv: 1,
            orders_count: 1,
          },
        },
      ])
      .toArray();

    const [finRes, timeseriesRes, topStoresRes] = await Promise.all([
      financialsPromise,
      timeseriesPromise,
      topStoresPromise,
    ]);

    const fin = finRes[0] || {
      platform_gmv: 0,
      total_platform_fees: 0,
      total_orders: 0,
    };

    const revenue_chart: RevenueTimePoint[] = timeseriesRes.map((t) => ({
      date: t._id,
      revenue: t.revenue,
      orders: t.orders,
    }));

    return {
      platform_gmv: fin.platform_gmv,
      total_platform_fees: fin.total_platform_fees,
      total_orders: fin.total_orders,
      total_sellers: totalSellers,
      total_riders: totalRiders,
      active_riders_online: activeRiders,
      revenue_chart,
      top_stores: topStoresRes,
    };
  }
}

export const analyticsService = new AnalyticsService();
