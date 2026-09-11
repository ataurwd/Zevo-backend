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
    return this.subOrdersCollection.findOne({ _id: subOrderId });
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
    return {
      id: doc._id.toString(),
      order_number: doc.order_number,
      customer_id: doc.customer_id.toString(),
      status: doc.status,
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
      delivered_at: doc.delivered_at?.toISOString() || null,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
    };
  }
}
