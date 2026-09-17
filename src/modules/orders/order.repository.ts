import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import {
  OrderDocument,
  SubOrderDocument,
  OrderStatus,
  SubOrderStatus,
  OrderResponse,
  SubOrderResponse,
} from "./order.types";

export class OrderRepository {
  public static get ordersCollection(): Collection<OrderDocument> {
    return getDb().collection<OrderDocument>("orders");
  }

  public static get subOrdersCollection(): Collection<SubOrderDocument> {
    return getDb().collection<SubOrderDocument>("sub_orders");
  }

  public static async createOrder(order: OrderDocument): Promise<OrderDocument> {
    await this.ordersCollection.insertOne(order as any);
    return order;
  }

  public static async createSubOrders(
    subOrders: SubOrderDocument[]
  ): Promise<SubOrderDocument[]> {
    if (subOrders.length > 0) {
      await this.subOrdersCollection.insertMany(subOrders as any);
    }
    return subOrders;
  }

  public static async findById(orderId: ObjectId): Promise<OrderDocument | null> {
    return this.ordersCollection.findOne({ _id: orderId });
  }

  public static async findByOrderNumber(
    orderNumber: string
  ): Promise<OrderDocument | null> {
    return this.ordersCollection.findOne({ order_number: orderNumber });
  }

  public static async findByPaymentIntentId(
    paymentIntentId: string
  ): Promise<OrderDocument | null> {
    return this.ordersCollection.findOne({
      stripe_payment_intent_id: paymentIntentId,
    });
  }

  public static async findSubOrdersByOrderId(
    orderId: ObjectId
  ): Promise<SubOrderDocument[]> {
    return this.subOrdersCollection.find({ order_id: orderId }).toArray();
  }

  public static async findByCustomerId(
    customerId: ObjectId,
    skip = 0,
    limit = 20,
    status?: string
  ): Promise<{ orders: OrderDocument[]; total: number }> {
    const filter: any = { customer_id: customerId };
    if (status && status !== "all") {
      filter.status = status;
    }

    const [orders, total] = await Promise.all([
      this.ordersCollection
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.ordersCollection.countDocuments(filter),
    ]);

    return { orders, total };
  }

  public static async updateOrderStatus(
    orderId: ObjectId,
    status: OrderStatus,
    additionalFields: Partial<OrderDocument> = {}
  ): Promise<OrderDocument | null> {
    const res = await this.ordersCollection.findOneAndUpdate(
      { _id: orderId },
      {
        $set: {
          status,
          updated_at: new Date(),
          ...additionalFields,
        },
      },
      { returnDocument: "after" }
    );
    return res;
  }

  public static async findSubOrderById(
    subOrderId: ObjectId
  ): Promise<SubOrderDocument | null> {
    const subOrder = await this.subOrdersCollection.findOne({ _id: subOrderId });
    if (subOrder && !subOrder.delivery_address) {
      const parentOrder = await this.findById(subOrder.order_id);
      if (parentOrder) {
        subOrder.delivery_address = parentOrder.delivery_address;
        subOrder.customer_notes = subOrder.customer_notes || parentOrder.notes;
        subOrder.customer_id = subOrder.customer_id || parentOrder.customer_id;
      }
    }
    return subOrder;
  }

  public static async findSubOrdersBySellerId(
    sellerId: ObjectId,
    skip = 0,
    limit = 20,
    status?: string
  ): Promise<{ subOrders: SubOrderDocument[]; total: number }> {
    const filter: any = { seller_id: sellerId };
    if (status && status !== "all") {
      filter.status = status;
    }

    const [subOrders, total] = await Promise.all([
      this.subOrdersCollection
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.subOrdersCollection.countDocuments(filter),
    ]);

    // Backfill delivery_address and customer_notes from parent orders for any legacy sub-orders
    const missingParentIds = subOrders
      .filter((s) => !s.delivery_address && s.order_id)
      .map((s) => s.order_id);

    if (missingParentIds.length > 0) {
      const parentOrders = await this.ordersCollection
        .find({ _id: { $in: missingParentIds } })
        .toArray();
      const parentMap = new Map<string, OrderDocument>();
      for (const po of parentOrders) {
        parentMap.set(po._id.toString(), po);
      }

      for (const s of subOrders) {
        if (!s.delivery_address && s.order_id) {
          const po = parentMap.get(s.order_id.toString());
          if (po) {
            s.delivery_address = po.delivery_address;
            s.customer_notes = s.customer_notes || po.notes;
            s.customer_id = s.customer_id || po.customer_id;
          }
        }
      }
    }

    return { subOrders, total };
  }

  public static async updateSubOrderStatus(
    subOrderId: ObjectId,
    status: SubOrderStatus,
    additionalFields: Partial<SubOrderDocument> = {}
  ): Promise<SubOrderDocument | null> {
    const res = await this.subOrdersCollection.findOneAndUpdate(
      { _id: subOrderId },
      {
        $set: {
          status,
          updated_at: new Date(),
          ...additionalFields,
        },
      },
      { returnDocument: "after" }
    );
    return res;
  }

  public static async updateSubOrdersByOrderId(
    orderId: ObjectId,
    status: SubOrderStatus,
    additionalFields: Partial<SubOrderDocument> = {}
  ): Promise<number> {
    const res = await this.subOrdersCollection.updateMany(
      { order_id: orderId },
      {
        $set: {
          status,
          updated_at: new Date(),
          ...additionalFields,
        },
      }
    );
    return res.modifiedCount;
  }

  public static async adminFindAllOrders(
    skip = 0,
    limit = 20,
    status?: string
  ): Promise<{ orders: OrderDocument[]; total: number }> {
    const filter: any = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    const [orders, total] = await Promise.all([
      this.ordersCollection
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.ordersCollection.countDocuments(filter),
    ]);

    return { orders, total };
  }

  public static async adminFindAllSubOrders(
    skip = 0,
    limit = 20,
    status?: string
  ): Promise<{ subOrders: SubOrderDocument[]; total: number }> {
    const filter: any = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    const [subOrders, total] = await Promise.all([
      this.subOrdersCollection
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.subOrdersCollection.countDocuments(filter),
    ]);

    return { subOrders, total };
  }

  public static toOrderResponse(
    doc: OrderDocument,
    subOrders?: SubOrderDocument[]
  ): OrderResponse {
    const primarySub = subOrders?.[0];
    let effectiveStatus: any = doc.status;

    const hasSubOrders = !!(subOrders && subOrders.length > 0);
    const allDelivered = hasSubOrders && subOrders!.every((s) => s.status === "delivered");
    const anyInTransit = hasSubOrders && subOrders!.some((s) => s.status === "in_transit" || s.status === "picked_up");
    const anyDelivered = hasSubOrders && subOrders!.some((s) => s.status === "delivered");

    // Harmonize overall status with sub-orders
    if (allDelivered) {
      effectiveStatus = "completed";
    } else if (effectiveStatus === "pending" || effectiveStatus === "confirmed") {
      if (anyInTransit || anyDelivered) {
        effectiveStatus = "in_transit";
      } else if (primarySub?.status && primarySub.status !== "pending") {
        effectiveStatus = primarySub.status;
      }
    }

    const assignedRider = (doc as any).assigned_rider || (primarySub as any)?.assigned_rider || null;

    // Only expose delivered_at on parent order if the parent order as a whole is completed/delivered
    const isCompleted = effectiveStatus === "completed" || effectiveStatus === "delivered" || allDelivered;
    const parentDeliveredAt = isCompleted
      ? (doc as any).delivered_at?.toISOString() || (hasSubOrders && subOrders!.every((s) => s.delivered_at) ? subOrders![subOrders!.length - 1].delivered_at?.toISOString() : null) || null
      : null;

    return {
      id: doc._id.toString(),
      order_number: doc.order_number,
      customer_id: doc.customer_id.toString(),
      status: effectiveStatus,
      payment_status: doc.payment_status,
      subtotal: doc.subtotal,
      discount_amount: doc.discount_amount,
      delivery_fee: doc.delivery_fee,
      platform_fee: doc.platform_fee,
      total: doc.total,
      currency: doc.currency,
      delivery_address: doc.delivery_address,
      stripe_payment_intent_id: doc.stripe_payment_intent_id,
      coupon_code: doc.coupon_code,
      notes: doc.notes,
      cancelled_at: doc.cancelled_at?.toISOString() || null,
      cancellation_reason: doc.cancellation_reason || null,
      assigned_rider: assignedRider,
      confirmed_at: (doc as any).confirmed_at?.toISOString() || primarySub?.confirmed_at?.toISOString() || null,
      preparing_at: (doc as any).preparing_at?.toISOString() || primarySub?.preparing_at?.toISOString() || null,
      ready_at: (doc as any).ready_at?.toISOString() || primarySub?.ready_at?.toISOString() || null,
      picked_up_at: (doc as any).picked_up_at?.toISOString() || primarySub?.picked_up_at?.toISOString() || null,
      in_transit_at: (doc as any).in_transit_at?.toISOString() || (primarySub as any)?.in_transit_at?.toISOString() || null,
      delivered_at: parentDeliveredAt,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
      sub_orders: subOrders ? subOrders.map(this.toSubOrderResponse) : undefined,
    };
  }

  public static toSubOrderResponse(doc: SubOrderDocument): SubOrderResponse {
    return {
      id: doc._id.toString(),
      order_id: doc.order_id.toString(),
      order_number: doc.order_number,
      seller_id: doc.seller_id.toString(),
      store_id: doc.store_id.toString(),
      customer_id: doc.customer_id?.toString(),
      delivery_address: doc.delivery_address,
      customer_notes: doc.customer_notes || null,
      status: doc.status,
      items: doc.items.map((i) => ({
        product_id: i.product_id.toString(),
        variant_id: i.variant_id.toString(),
        sku: i.sku,
        product_name: i.product_name,
        variant_name: i.variant_name,
        image_url: i.image_url,
        unit_price: i.unit_price,
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
      subtotal: doc.subtotal,
      seller_earnings: doc.seller_earnings,
      platform_commission: doc.platform_commission,
      commission_rate: doc.commission_rate,
      delivery_fee: doc.delivery_fee,
      stripe_transfer_id: doc.stripe_transfer_id || null,
      confirmed_at: doc.confirmed_at?.toISOString() || null,
      preparing_at: doc.preparing_at?.toISOString() || null,
      ready_at: doc.ready_at?.toISOString() || null,
      picked_up_at: doc.picked_up_at?.toISOString() || null,
      delivered_at: doc.delivered_at?.toISOString() || null,
      cancelled_at: doc.cancelled_at?.toISOString() || null,
      cancellation_reason: doc.cancellation_reason || null,
      assigned_rider: (doc as any).assigned_rider || null,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
    };
  }
}
