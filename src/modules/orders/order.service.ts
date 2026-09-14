import { ObjectId } from "mongodb";
import { OrderRepository } from "./order.repository";
import {
  CreateOrderDTO,
  OrderResponse,
  SubOrderResponse,
  DeliveryAddressSnapshot,
  OrderItemSnapshot,
  OrderDocument,
  SubOrderDocument,
  OrderStatus,
} from "./order.types";
import { CartService } from "../cart/cart.service";
import { InventoryService } from "../inventory/inventory.service";
import { AddressesRepository } from "../users/addresses.repository";
import { StripeService } from "../../infrastructure/services/stripe.service";
import { PaymentRepository } from "../payments/payment.repository";
import { SellersRepository } from "../sellers/sellers.repository";
import { AuditService } from "../../infrastructure/services/audit.service";
import { notificationQueue } from "../../infrastructure/queue/queues";
import { isSocketInitialized, getIO } from "../../infrastructure/socket/io";
import { deliveryService } from "../delivery/delivery.service";
import { notificationService } from "../notifications/notification.service";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../shared/errors/errors";
import { logger } from "../../infrastructure/logger";

export class OrderService {
  /**
   * Generates human readable unique order number: NX-YYYY-XXXXXX
   */
  private static generateOrderNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `NX-${year}-${random}`;
  }

  public static async createOrder(
    customerId: string,
    dto: CreateOrderDTO
  ): Promise<{ order: OrderResponse; payment_intent_client_secret: string }> {
    const customerObjId = new ObjectId(customerId);

    // 1. Resolve Delivery Address
    let addressSnapshot: DeliveryAddressSnapshot;
    if (dto.address_id) {
      const addressDoc = await AddressesRepository.findById(
        dto.address_id,
        customerId
      );
      if (!addressDoc) {
        throw new NotFoundError("Selected delivery address was not found");
      }
      addressSnapshot = {
        recipient_name: addressDoc.recipient_name,
        phone: addressDoc.phone,
        line1: addressDoc.line1,
        line2: addressDoc.line2,
        city: addressDoc.city,
        state: addressDoc.state,
        postal_code: addressDoc.postal_code,
        country: addressDoc.country,
      };
    } else if (dto.delivery_address) {
      addressSnapshot = dto.delivery_address;
    } else {
      throw new BadRequestError("A delivery address must be specified");
    }

    // 2. Fetch User Cart
    const cart = await CartService.getCart(customerId, undefined);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestError("Cannot place an order with an empty cart");
    }

    // 3. Pre-checkout validation (Live price & current stock check)
    const validation = await CartService.validateCart(customerId, undefined);
    if (!validation.is_valid) {
      const msgs = validation.issues.map((d) => d.message).join(", ");
      throw new BadRequestError(
        `Cart items require attention before checkout: ${msgs}`
      );
    }

    // 4. Two-Phase Stock Reservation with automatic rollback on partial failure
    const reservedItems: Array<{ variantId: string; quantity: number }> = [];
    for (const item of cart.items) {
      const reserved = await InventoryService.reserveStock(
        item.variant_id,
        item.quantity,
        item.product_id
      );
      if (!reserved) {
        // Rollback all previously reserved items
        for (const prev of reservedItems) {
          await InventoryService.releaseStock(
            prev.variantId,
            prev.quantity,
            "order_reservation_rollback"
          );
        }
        throw new BadRequestError(
          `Item "${item.name} (${item.variant_name})" just ran out of stock. Please adjust your cart.`
        );
      }
      reservedItems.push({
        variantId: item.variant_id,
        quantity: item.quantity,
      });
    }

    // 5. Build Sub-Orders (Group cart items per seller/vendor)
    const parentOrderId = new ObjectId();
    const orderNumber = this.generateOrderNumber();
    const now = new Date();

    const itemsBySeller = new Map<
      string,
      { storeId: string; items: OrderItemSnapshot[]; subtotal: number }
    >();

    for (const item of cart.items) {
      const sellerKey = item.seller_id;
      if (!itemsBySeller.has(sellerKey)) {
        itemsBySeller.set(sellerKey, {
          storeId: item.store_id,
          items: [],
          subtotal: 0,
        });
      }

      const group = itemsBySeller.get(sellerKey)!;
      const unitPriceCents = Math.round(item.price);
      const itemSubtotal = unitPriceCents * item.quantity;

      group.items.push({
        product_id: new ObjectId(item.product_id),
        variant_id: new ObjectId(item.variant_id),
        sku: item.sku,
        product_name: item.name,
        variant_name: item.variant_name,
        image_url: item.image_url || undefined,
        unit_price: unitPriceCents,
        quantity: item.quantity,
        subtotal: itemSubtotal,
      });

      group.subtotal += itemSubtotal;
    }

    const subOrderDocs: SubOrderDocument[] = [];
    let subOrderIndex = 1;
    let totalPlatformCommission = 0;

    for (const [sellerIdStr, data] of itemsBySeller.entries()) {
      const commissionRate = 10; // 10% platform commission
      const platformCommission = Math.round(
        (data.subtotal * commissionRate) / 100
      );
      const sellerEarnings = data.subtotal - platformCommission;
      totalPlatformCommission += platformCommission;

      subOrderDocs.push({
        _id: new ObjectId(),
        order_id: parentOrderId,
        order_number: `${orderNumber}-${String(subOrderIndex).padStart(2, "0")}`,
        seller_id: new ObjectId(sellerIdStr),
        store_id: new ObjectId(data.storeId),
        customer_id: customerObjId,
        delivery_address: addressSnapshot,
        customer_notes: dto.notes || null,
        status: "pending",
        items: data.items,
        subtotal: data.subtotal,
        seller_earnings: sellerEarnings,
        platform_commission: platformCommission,
        commission_rate: commissionRate,
        delivery_fee: 0,
        stripe_transfer_id: null,
        confirmed_at: null,
        preparing_at: null,
        ready_at: null,
        picked_up_at: null,
        delivered_at: null,
        cancelled_at: null,
        cancellation_reason: null,
        created_at: now,
        updated_at: now,
      });
      subOrderIndex++;
    }

    // 6. Calculate Parent Order Financial Totals
    const subtotalCents = Math.round(cart.subtotal);
    const discountCents = Math.round(cart.discount);
    const deliveryFeeCents = 500; // Flat $5.00 delivery fee (500 cents)
    const grandTotalCents = Math.max(
      0,
      subtotalCents - discountCents + deliveryFeeCents
    );

    // 7. Create Stripe PaymentIntent
    let paymentIntent: { id: string; client_secret: string; status: string };
    try {
      paymentIntent = await StripeService.createPaymentIntent({
        amount: grandTotalCents,
        currency: "usd",
        orderId: parentOrderId.toString(),
        customerId,
        metadata: {
          order_number: orderNumber,
        },
      });
    } catch (err) {
      // Rollback reservations if Stripe intent creation failed
      for (const item of reservedItems) {
        await InventoryService.releaseStock(
          item.variantId,
          item.quantity,
          "order_payment_intent_failure"
        );
      }
      throw err;
    }

    // 8. Construct Parent Order Document
    const parentOrderDoc: OrderDocument = {
      _id: parentOrderId,
      order_number: orderNumber,
      customer_id: customerObjId,
      status: "pending",
      payment_status: "pending",
      subtotal: subtotalCents,
      discount_amount: discountCents,
      delivery_fee: deliveryFeeCents,
      platform_fee: totalPlatformCommission,
      total: grandTotalCents,
      currency: "usd",
      delivery_address: addressSnapshot,
      stripe_payment_intent_id: paymentIntent.id,
      coupon_code: cart.coupon?.code || null,
      notes: dto.notes || null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      created_at: now,
      updated_at: now,
    };

    // 9. Persist Order and Sub-Orders
    await OrderRepository.createOrder(parentOrderDoc);
    await OrderRepository.createSubOrders(subOrderDocs);

    // 10. Persist Initial Payment Record
    await PaymentRepository.createPayment({
      _id: new ObjectId(),
      order_id: parentOrderId,
      customer_id: customerObjId,
      stripe_payment_intent_id: paymentIntent.id,
      amount: grandTotalCents,
      currency: "usd",
      status: "pending",
      webhook_events: [],
      created_at: now,
      updated_at: now,
    });

    // 11. Clear Cart
    await CartService.clearCart(customerId, undefined);

    // 12. Dispatch notification job & Socket Event
    try {
      await notificationQueue.add("order.created", {
        orderId: parentOrderId.toString(),
        orderNumber,
        customerId,
        total: grandTotalCents,
      });

      await notificationService.createNotification({
        user_id: customerId,
        type: "order_created",
        title: "Order Placed Successfully",
        body: `Your order #${orderNumber} has been submitted for $${(grandTotalCents / 100).toFixed(2)}.`,
        reference_id: parentOrderId.toString(),
        reference_type: "order",
      });

      if (isSocketInitialized()) {
        getIO().to(`user:${customerId}`).emit("order:created", {
          orderId: parentOrderId.toString(),
          orderNumber,
          status: "pending",
        });
      }
    } catch (err) {
      logger.warn({ err }, "Failed to queue order.created notification");
    }

    // 13. Audit Log
    await AuditService.log({
      userId: customerId,
      action: "order.create",
      resourceType: "order",
      resourceId: parentOrderId,
      metadata: {
        order_number: orderNumber,
        total: grandTotalCents,
        sub_orders_count: subOrderDocs.length,
      },
    });

    return {
      order: OrderRepository.toOrderResponse(parentOrderDoc, subOrderDocs),
      payment_intent_client_secret: paymentIntent.client_secret,
    };
  }

  public static async cancelOrder(
    customerId: string,
    orderId: string,
    reason?: string
  ): Promise<OrderResponse> {
    const orderObjId = new ObjectId(orderId);
    const order = await OrderRepository.findById(orderObjId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.customer_id.toString() !== customerId) {
      throw new ForbiddenError("You do not have permission to cancel this order");
    }

    if (order.status !== "pending") {
      throw new BadRequestError(
        `Cannot cancel order in "${order.status}" status. Only pending orders may be cancelled.`
      );
    }

    const subOrders = await OrderRepository.findSubOrdersByOrderId(orderObjId);
    const hasProgressed = subOrders.some((s) => s.status !== "pending");
    if (hasProgressed) {
      throw new BadRequestError(
        "Cannot cancel order: One or more sellers have already begun processing fulfillment"
      );
    }

    // 1. Release reserved stock
    for (const sub of subOrders) {
      for (const item of sub.items) {
        await InventoryService.releaseStock(
          item.variant_id,
          item.quantity,
          orderId
        );
      }
    }

    // 2. Cancel Stripe PaymentIntent if present
    if (order.stripe_payment_intent_id) {
      await StripeService.cancelPaymentIntent(order.stripe_payment_intent_id);
    }

    // 3. Update status in MongoDB
    const now = new Date();
    const updatedOrder = await OrderRepository.updateOrderStatus(
      orderObjId,
      "cancelled",
      {
        cancelled_at: now,
        cancelled_by: new ObjectId(customerId),
        cancellation_reason: reason || "Customer cancelled before confirmation",
      }
    );

    await OrderRepository.updateSubOrdersByOrderId(orderObjId, "cancelled");

    // 4. Update payment status
    const payment = await PaymentRepository.findByOrderId(orderObjId);
    if (payment) {
      await PaymentRepository.updateStatus(payment._id, "cancelled");
    }

    // 5. Audit Log & Queue Notification
    await AuditService.log({
      userId: customerId,
      action: "order.cancel",
      resourceType: "order",
      resourceId: orderObjId,
      metadata: { reason },
    });

    try {
      await notificationQueue.add("order.cancelled", {
        orderId,
        orderNumber: order.order_number,
        customerId,
        reason,
      });

      await notificationService.createNotification({
        user_id: customerId,
        type: "order_cancelled",
        title: "Order Cancelled",
        body: `Order #${order.order_number} was successfully cancelled.`,
        reference_id: orderId,
        reference_type: "order",
      });

      if (isSocketInitialized()) {
        getIO().to(`order:${orderId}`).emit("order:cancelled", {
          orderId,
          orderNumber: order.order_number,
          reason,
        });
      }
    } catch (err) {
      logger.warn({ err }, "Failed to queue order.cancelled notification");
    }

    const refreshedSubOrders =
      await OrderRepository.findSubOrdersByOrderId(orderObjId);
    return OrderRepository.toOrderResponse(updatedOrder!, refreshedSubOrders);
  }

  public static async getCustomerOrders(
    customerId: string,
    page = 1,
    limit = 20,
    status?: string
  ): Promise<{ orders: OrderResponse[]; total: number }> {
    const customerObjId = new ObjectId(customerId);
    const skip = (page - 1) * limit;

    const { orders, total } = await OrderRepository.findByCustomerId(
      customerObjId,
      skip,
      limit,
      status
    );

    const responses = await Promise.all(
      orders.map(async (o) => {
        const subOrders = await OrderRepository.findSubOrdersByOrderId(o._id);
        return OrderRepository.toOrderResponse(o, subOrders);
      })
    );

    return { orders: responses, total };
  }

  public static async getCustomerOrderById(
    customerId: string,
    orderId: string,
    userRole?: string
  ): Promise<OrderResponse> {
    const orderObjId = new ObjectId(orderId);
    const order = await OrderRepository.findById(orderObjId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const subOrders = await OrderRepository.findSubOrdersByOrderId(orderObjId);

    // Permission check: ADMIN and SUPER_ADMIN have full view access
    const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
    const isOwner = order.customer_id.toString() === customerId;
    const isDeliveryAgent = userRole === "DELIVERY_AGENT";

    let isSellerOfOrder = false;
    if (userRole === "SELLER") {
      try {
        const seller = await this.resolveSellerForUser(customerId);
        if (seller && subOrders.some((s) => s.seller_id?.toString() === seller._id.toString())) {
          isSellerOfOrder = true;
        }
      } catch {
        // Ignore resolution error
      }
    }

    if (!isAdmin && !isOwner && !isSellerOfOrder && !isDeliveryAgent) {
      throw new ForbiddenError("You do not have permission to view this order");
    }

    return OrderRepository.toOrderResponse(order, subOrders);
  }

  private static async resolveSellerForUser(userId: string) {
    let seller = await SellersRepository.findByUserId(userId);
    if (!seller) {
      const { getDb } = await import("../../infrastructure/db/client");
      const db = getDb();
      const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
      if (user && ["SELLER", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
        const firstSeller = await db.collection("sellers").findOne({});
        if (firstSeller) {
          seller = firstSeller as any;
        } else {
          seller = await SellersRepository.create({
            user_id: user._id,
            company_name: `${user.first_name || "Merchant"} Store`,
            store_name: `${user.first_name || "Merchant"} Store`,
            status: "active",
            stripe_account_id: `acct_mock_${user._id.toString().slice(-8)}`,
            stripe_onboarding_complete: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as any);
        }
      }
    }
    return seller;
  }

  public static async getSellerSubOrders(
    sellerUserId: string,
    page = 1,
    limit = 20,
    status?: string
  ): Promise<{ subOrders: SubOrderResponse[]; total: number }> {
    const seller = await this.resolveSellerForUser(sellerUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile not found");
    }

    const skip = (page - 1) * limit;
    const { subOrders, total } = await OrderRepository.findSubOrdersBySellerId(
      seller._id,
      skip,
      limit,
      status
    );

    return {
      subOrders: subOrders.map(OrderRepository.toSubOrderResponse),
      total,
    };
  }

  public static async getSellerSubOrderById(
    sellerUserId: string,
    subOrderId: string
  ): Promise<SubOrderResponse> {
    const seller = await this.resolveSellerForUser(sellerUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile not found");
    }

    const subOrder = await OrderRepository.findSubOrderById(
      new ObjectId(subOrderId)
    );
    if (!subOrder) {
      throw new NotFoundError("Sub-order not found");
    }

    if (subOrder.seller_id.toString() !== seller._id.toString()) {
      throw new ForbiddenError(
        "You do not have permission to view this sub-order"
      );
    }

    return OrderRepository.toSubOrderResponse(subOrder);
  }

  public static async updateSubOrderStatus(
    sellerUserId: string,
    subOrderId: string,
    newStatus: "confirmed" | "preparing" | "ready_for_pickup" | "picked_up" | "delivered" | "cancelled",
    reason?: string
  ): Promise<SubOrderResponse> {
    const seller = await this.resolveSellerForUser(sellerUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile not found");
    }

    const subOrderObjId = new ObjectId(subOrderId);
    const subOrder = await OrderRepository.findSubOrderById(subOrderObjId);
    if (!subOrder) {
      throw new NotFoundError("Sub-order not found");
    }

    if (subOrder.seller_id.toString() !== seller._id.toString()) {
      throw new ForbiddenError(
        "You do not have permission to manage this sub-order"
      );
    }

    // State machine check
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["ready_for_pickup", "cancelled"],
      ready_for_pickup: ["picked_up", "delivered"],
      picked_up: ["delivered"],
    };

    const allowed = validTransitions[subOrder.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestError(
        `Cannot transition sub-order from "${subOrder.status}" to "${newStatus}"`
      );
    }

    const now = new Date();
    const timestampUpdates: Partial<SubOrderDocument> = {};
    if (newStatus === "confirmed") timestampUpdates.confirmed_at = now;
    if (newStatus === "preparing") timestampUpdates.preparing_at = now;
    if (newStatus === "ready_for_pickup") timestampUpdates.ready_at = now;
    if (newStatus === "picked_up") timestampUpdates.picked_up_at = now;
    if (newStatus === "delivered") timestampUpdates.delivered_at = now;
    if (newStatus === "cancelled") {
      timestampUpdates.cancelled_at = now;
      timestampUpdates.cancellation_reason = reason || "Cancelled by seller";

      // Release reserved stock back to inventory
      for (const item of subOrder.items) {
        await InventoryService.releaseStock(
          item.variant_id.toString(),
          item.quantity,
          subOrder.order_id.toString()
        );
      }
    }

    const updated = await OrderRepository.updateSubOrderStatus(
      subOrderObjId,
      newStatus,
      timestampUpdates
    );

    // Auto-synchronize parent order status based on all siblings
    const parentOrder = await OrderRepository.findById(subOrder.order_id);
    if (parentOrder) {
      const siblingSubOrders = await OrderRepository.findSubOrdersByOrderId(subOrder.order_id);
      const allStatuses = siblingSubOrders.map((s) =>
        s._id.equals(subOrderObjId) ? newStatus : s.status
      );

      if (allStatuses.every((s) => s === "delivered")) {
        await OrderRepository.updateOrderStatus(subOrder.order_id, "completed");
      } else if (allStatuses.every((s) => s === "cancelled")) {
        await OrderRepository.updateOrderStatus(subOrder.order_id, "cancelled", {
          cancelled_at: now,
          cancellation_reason: "All merchant packages were cancelled",
        });
      } else if (
        parentOrder.status === "pending" &&
        allStatuses.some((s) =>
          ["confirmed", "preparing", "ready_for_pickup", "picked_up", "delivered"].includes(s)
        )
      ) {
        await OrderRepository.updateOrderStatus(subOrder.order_id, "confirmed");
      }
    }

    // Audit Log & Notification
    await AuditService.log({
      userId: sellerUserId,
      action: `sub_order.${newStatus}`,
      resourceType: "sub_order",
      resourceId: subOrderObjId,
      metadata: { previous_status: subOrder.status, new_status: newStatus, reason },
    });

    try {
      await notificationQueue.add(`sub_order.${newStatus}`, {
        subOrderId,
        orderId: subOrder.order_id.toString(),
        newStatus,
        reason,
      });

      // Delivery task auto-creation when ready for pickup
      if (newStatus === "ready_for_pickup" && parentOrder) {
        deliveryService.createTaskForSubOrder(updated!, parentOrder).catch((err) => {
          logger.warn({ err }, "Failed to auto-create delivery task");
        });
      }

      // Friendly customer notification
      if (parentOrder) {
        let notifTitle = "Order Update";
        let notifBody = `Package #${subOrder.order_number} status is now ${newStatus.replace(/_/g, " ")}.`;
        if (newStatus === "confirmed") {
          notifTitle = "Order Confirmed by Seller";
          notifBody = `Merchant confirmed package #${subOrder.order_number} and is preparing fulfillment.`;
        } else if (newStatus === "preparing") {
          notifTitle = "Order In Preparation";
          notifBody = `Merchant is currently packaging your items for package #${subOrder.order_number}.`;
        } else if (newStatus === "ready_for_pickup") {
          notifTitle = "Package Ready for Courier";
          notifBody = `Package #${subOrder.order_number} is packed and waiting for courier handoff.`;
        } else if (newStatus === "picked_up") {
          notifTitle = "Package In Transit";
          notifBody = `Package #${subOrder.order_number} has been picked up for courier delivery.`;
        } else if (newStatus === "delivered") {
          notifTitle = "Package Delivered";
          notifBody = `Package #${subOrder.order_number} has been delivered successfully!`;
        } else if (newStatus === "cancelled") {
          notifTitle = "Package Cancelled by Seller";
          notifBody = `Package #${subOrder.order_number} was cancelled. ${reason ? `Reason: ${reason}` : ""}`;
        }

        await notificationService.createNotification({
          user_id: parentOrder.customer_id.toString(),
          type: `sub_order_${newStatus}` as any,
          title: notifTitle,
          body: notifBody,
          reference_id: parentOrder._id.toString(),
          reference_type: "order",
        }).catch(() => {});
      }

      if (isSocketInitialized()) {
        const orderIdStr = subOrder.order_id.toString();
        const io = getIO();
        io.to(`order:${orderIdStr}`).emit(`order:${newStatus}`, {
          orderId: orderIdStr,
          subOrderId: subOrder._id.toString(),
          status: newStatus,
        });
        io.to(`order:${orderIdStr}`).emit("order:sub_order_updated", {
          orderId: orderIdStr,
          subOrderId: subOrder._id.toString(),
          status: newStatus,
        });
        if (parentOrder) {
          io.to(`user:${parentOrder.customer_id.toString()}`).emit("order:status_updated", {
            orderId: orderIdStr,
            subOrderId: subOrder._id.toString(),
            status: newStatus,
          });
        }
      }
    } catch (err) {
      logger.warn({ err }, "Failed to queue sub_order status notification");
    }

    return OrderRepository.toSubOrderResponse(updated!);
  }

  public static async adminListAllOrders(
    page = 1,
    limit = 20,
    status?: string
  ): Promise<{ orders: OrderResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    const { orders, total } = await OrderRepository.adminFindAllOrders(
      skip,
      limit,
      status
    );

    const responses = await Promise.all(
      orders.map(async (o) => {
        const subOrders = await OrderRepository.findSubOrdersByOrderId(o._id);
        return OrderRepository.toOrderResponse(o, subOrders);
      })
    );

    return { orders: responses, total };
  }

  public static async adminGetOrderById(
    orderId: string
  ): Promise<OrderResponse> {
    const orderObjId = new ObjectId(orderId);
    const order = await OrderRepository.findById(orderObjId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const subOrders = await OrderRepository.findSubOrdersByOrderId(orderObjId);
    return OrderRepository.toOrderResponse(order, subOrders);
  }

  public static async adminCancelOrder(
    orderId: string,
    reason?: string,
    adminUserId?: string
  ): Promise<OrderResponse> {
    const orderObjId = new ObjectId(orderId);
    const order = await OrderRepository.findById(orderObjId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.status === "cancelled") {
      throw new BadRequestError("Order is already cancelled");
    }

    const subOrders = await OrderRepository.findSubOrdersByOrderId(orderObjId);

    // Release stock if order was still pending (reserved)
    if (order.status === "pending") {
      for (const sub of subOrders) {
        for (const item of sub.items) {
          await InventoryService.releaseStock(
            item.variant_id,
            item.quantity,
            orderId
          );
        }
      }
    }

    if (order.stripe_payment_intent_id) {
      await StripeService.cancelPaymentIntent(order.stripe_payment_intent_id);
    }

    const now = new Date();
    const updated = await OrderRepository.updateOrderStatus(
      orderObjId,
      "cancelled",
      {
        cancelled_at: now,
        cancelled_by: adminUserId ? new ObjectId(adminUserId) : null,
        cancellation_reason: reason || "Administrative cancellation",
      }
    );

    await OrderRepository.updateSubOrdersByOrderId(orderObjId, "cancelled");

    return OrderRepository.toOrderResponse(updated!, subOrders);
  }

  public static async adminListAllSubOrders(
    page = 1,
    limit = 20,
    status?: string
  ): Promise<{ subOrders: SubOrderResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    const { subOrders, total } = await OrderRepository.adminFindAllSubOrders(
      skip,
      limit,
      status
    );

    return {
      subOrders: subOrders.map(OrderRepository.toSubOrderResponse),
      total,
    };
  }
}
