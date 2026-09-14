import { ObjectId } from "mongodb";
import { PaymentRepository } from "./payment.repository";
import {
  PaymentResponse,
  RefundResponse,
  InitiateRefundDTO,
} from "./payment.types";
import { OrderRepository } from "../orders/order.repository";
import { InventoryService } from "../inventory/inventory.service";
import { SellersRepository } from "../sellers/sellers.repository";
import { StripeService } from "../../infrastructure/services/stripe.service";
import { AuditService } from "../../infrastructure/services/audit.service";
import { paymentQueue, notificationQueue } from "../../infrastructure/queue/queues";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../shared/errors/errors";
import { logger } from "../../infrastructure/logger";

export class PaymentService {
  /**
   * Fast webhook ingestion endpoint: verifies signature, checks idempotency,
   * enqueues job to BullMQ, and immediately responds 200 to Stripe.
   */
  public static async processWebhook(
    rawBody: Buffer | string,
    signature: string
  ): Promise<{ received: boolean; duplicate?: boolean }> {
    let event: any;
    try {
      event = StripeService.constructWebhookEvent(rawBody, signature);
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook signature construction failed");
      throw new BadRequestError(`Webhook signature verification failed: ${err.message}`);
    }

    // Resolve payment intent ID from event object
    const eventObj = event.data?.object;
    let paymentIntentId = "";
    if (event.type.startsWith("payment_intent.")) {
      paymentIntentId = eventObj?.id || "";
    } else if (event.type.startsWith("charge.")) {
      paymentIntentId =
        typeof eventObj?.payment_intent === "string"
          ? eventObj.payment_intent
          : eventObj?.payment_intent?.id || "";
    }

    if (paymentIntentId) {
      // Idempotency check: has this event already been processed?
      const alreadyProcessed = await PaymentRepository.isWebhookProcessed(
        paymentIntentId,
        event.id
      );
      if (alreadyProcessed) {
        logger.info(
          `Stripe webhook event ${event.id} already processed for ${paymentIntentId} (idempotent ignore)`
        );
        return { received: true, duplicate: true };
      }

      // Record event log in payment record
      await PaymentRepository.appendWebhookEvent(paymentIntentId, {
        event_id: event.id,
        type: event.type,
        received_at: new Date(),
      });
    }

    // Enqueue job for asynchronous processing via BullMQ
    try {
      await paymentQueue.add(
        "payment.process_webhook",
        { event },
        {
          jobId: `stripe-webhook-${event.id}`,
        }
      );
    } catch (err) {
      logger.error({ err }, `Failed to enqueue webhook event ${event.id}`);
      // If queueing fails, we can process directly as fallback
      await this.handleWebhookEvent(event);
    }

    return { received: true };
  }

  /**
   * Executes business logic for verified Stripe webhook events.
   * Invoked by BullMQ payment worker.
   */
  public static async handleWebhookEvent(event: any): Promise<void> {
    const eventType = event.type;
    const eventObj = event.data?.object;

    logger.info(`Processing Stripe webhook event: ${eventType} (${event.id})`);

    switch (eventType) {
      case "payment_intent.succeeded": {
        const piId = eventObj.id;
        const payment = await PaymentRepository.findByPaymentIntentId(piId);
        if (!payment) {
          logger.warn(`No payment record found for Stripe PaymentIntent ${piId}`);
          return;
        }

        // 1. Update payment record
        await PaymentRepository.updateStatus(payment._id, "succeeded", {
          stripe_charge_id: eventObj.latest_charge || null,
          payment_method_type:
            eventObj.payment_method_types?.[0] || "card",
        });

        // 2. Update order record
        const order = await OrderRepository.findById(payment.order_id);
        if (!order) {
          logger.warn(`Order ${payment.order_id} not found for payment ${payment._id}`);
          return;
        }

        if (order.status === "confirmed") {
          logger.info(`Order ${order.order_number} already confirmed (idempotent skip)`);
          return;
        }

        const now = new Date();
        await OrderRepository.updateOrderStatus(order._id, "confirmed", {
          payment_status: "paid",
        });

        // 3. Update all sub-orders to confirmed
        await OrderRepository.updateSubOrdersByOrderId(order._id, "confirmed", {
          confirmed_at: now,
        });

        // 4. Two-Phase Stock Reservation: Commit phase (atomicDeduct)
        const subOrders = await OrderRepository.findSubOrdersByOrderId(order._id);
        for (const sub of subOrders) {
          for (const item of sub.items) {
            await InventoryService.deductStock(
              item.variant_id,
              item.quantity,
              order._id.toString()
            );
          }

          // 5. Credit seller earnings balance
          await SellersRepository.creditSellerBalance(
            sub.seller_id,
            sub.seller_earnings,
            sub.platform_commission
          );

          // 6. Enqueue transfer job for Connected seller account
          try {
            await paymentQueue.add(
              "payment.transfer",
              { subOrderId: sub._id.toString() },
              { jobId: `transfer-${sub._id.toString()}` }
            );
          } catch (err) {
            logger.warn({ err }, `Could not enqueue transfer for sub_order ${sub._id}`);
          }
        }

        // 7. Audit & Customer notification
        await AuditService.log({
          userId: payment.customer_id.toString(),
          action: "payment.succeeded",
          resourceType: "payment",
          resourceId: payment._id,
          metadata: { order_number: order.order_number, amount: payment.amount },
        });

        try {
          await notificationQueue.add("order.confirmed", {
            orderId: order._id.toString(),
            orderNumber: order.order_number,
            customerId: payment.customer_id.toString(),
          });
        } catch (err) {
          logger.warn({ err }, "Failed to queue order.confirmed notification");
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const piId = eventObj.id;
        const payment = await PaymentRepository.findByPaymentIntentId(piId);
        if (!payment) return;

        const failureMsg =
          eventObj.last_payment_error?.message || "Payment authorization failed";

        await PaymentRepository.updateStatus(payment._id, "failed", {
          failure_code: eventObj.last_payment_error?.code || null,
          failure_message: failureMsg,
        });

        const order = await OrderRepository.findById(payment.order_id);
        if (order && order.status === "pending") {
          await OrderRepository.updateOrderStatus(order._id, "cancelled", {
            payment_status: "failed",
            cancellation_reason: `Payment failed: ${failureMsg}`,
            cancelled_at: new Date(),
          });

          await OrderRepository.updateSubOrdersByOrderId(order._id, "cancelled");

          // Release reserved inventory
          const subOrders = await OrderRepository.findSubOrdersByOrderId(order._id);
          for (const sub of subOrders) {
            for (const item of sub.items) {
              await InventoryService.releaseStock(
                item.variant_id,
                item.quantity,
                order._id.toString()
              );
            }
          }

          try {
            await notificationQueue.add("order.payment_failed", {
              orderId: order._id.toString(),
              orderNumber: order.order_number,
              customerId: payment.customer_id.toString(),
              reason: failureMsg,
            });
          } catch (err) {
            logger.warn({ err }, "Failed to queue payment_failed notification");
          }
        }
        break;
      }

      case "payment_intent.canceled": {
        const piId = eventObj.id;
        const payment = await PaymentRepository.findByPaymentIntentId(piId);
        if (!payment) return;

        await PaymentRepository.updateStatus(payment._id, "cancelled");
        const order = await OrderRepository.findById(payment.order_id);
        if (order && order.status === "pending") {
          await OrderRepository.updateOrderStatus(order._id, "cancelled", {
            payment_status: "cancelled",
            cancellation_reason: "PaymentIntent was cancelled",
            cancelled_at: new Date(),
          });
          await OrderRepository.updateSubOrdersByOrderId(order._id, "cancelled");

          const subOrders = await OrderRepository.findSubOrdersByOrderId(order._id);
          for (const sub of subOrders) {
            for (const item of sub.items) {
              await InventoryService.releaseStock(
                item.variant_id,
                item.quantity,
                order._id.toString()
              );
            }
          }
        }
        break;
      }

      default:
        logger.info(`Unhandled Stripe webhook event: ${eventType}`);
        break;
    }
  }

  /**
   * Processes Stripe Connect transfers for a sub-order to the seller's account.
   */
  public static async processTransfer(subOrderId: string): Promise<void> {
    const subOrderObjId = new ObjectId(subOrderId);
    const subOrder = await OrderRepository.findSubOrderById(subOrderObjId);
    if (!subOrder) {
      logger.warn(`Sub-order ${subOrderId} not found for transfer`);
      return;
    }

    if (subOrder.stripe_transfer_id) {
      logger.info(`Sub-order ${subOrderId} already has transfer ${subOrder.stripe_transfer_id}`);
      return;
    }

    const seller = await SellersRepository.findById(subOrder.seller_id);
    if (!seller || !seller.stripe_account_id) {
      logger.warn(
        `Seller ${subOrder.seller_id} does not have a Stripe Connect account yet. Earnings credited to pending balance.`
      );
      return;
    }

    try {
      const transfer = await StripeService.createTransfer({
        amount: subOrder.seller_earnings,
        currency: "usd",
        destination: seller.stripe_account_id,
        subOrderId: subOrder._id.toString(),
        orderId: subOrder.order_id.toString(),
      });

      await OrderRepository.updateSubOrderStatus(subOrderObjId, subOrder.status, {
        stripe_transfer_id: transfer.id,
      });

      logger.info(
        `Stripe transfer ${transfer.id} executed for sub-order ${subOrderId} ($${(
          subOrder.seller_earnings / 100
        ).toFixed(2)})`
      );
    } catch (err: any) {
      logger.error(
        { err },
        `Failed to process Stripe transfer for sub-order ${subOrderId}`
      );
      throw err;
    }
  }

  /**
   * Admin-initiated refund.
   */
  public static async initiateRefund(
    paymentId: string,
    dto: InitiateRefundDTO,
    adminUserId: string
  ): Promise<RefundResponse> {
    const paymentObjId = new ObjectId(paymentId);
    const payment = await PaymentRepository.findById(paymentObjId);
    if (!payment) {
      throw new NotFoundError("Payment record not found");
    }

    if (payment.status !== "succeeded" && payment.status !== "partially_refunded") {
      throw new BadRequestError(
        `Cannot refund payment in "${payment.status}" status. Only succeeded payments can be refunded.`
      );
    }

    const existingRefunds = await PaymentRepository.findRefundsByPaymentId(paymentObjId);
    const alreadyRefunded = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
    const maxRefundable = payment.amount - alreadyRefunded;

    const refundAmount = dto.amount || maxRefundable;
    if (refundAmount <= 0 || refundAmount > maxRefundable) {
      throw new BadRequestError(
        `Invalid refund amount. Maximum refundable is $${(maxRefundable / 100).toFixed(2)}`
      );
    }

    // Call Stripe refund API
    const stripeRefund = await StripeService.createRefund({
      paymentIntentId: payment.stripe_payment_intent_id,
      amount: refundAmount,
      reason:
        dto.reason === "duplicate" || dto.reason === "fraud"
          ? (dto.reason as any)
          : "requested_by_customer",
    });

    const now = new Date();
    const refundDoc = await PaymentRepository.createRefund({
      _id: new ObjectId(),
      payment_id: paymentObjId,
      order_id: payment.order_id,
      sub_order_id: dto.sub_order_id ? new ObjectId(dto.sub_order_id) : null,
      stripe_refund_id: stripeRefund.id,
      amount: refundAmount,
      reason: dto.reason,
      status: stripeRefund.status === "succeeded" ? "succeeded" : "pending",
      initiated_by: new ObjectId(adminUserId),
      created_at: now,
      updated_at: now,
    });

    const newTotalRefunded = alreadyRefunded + refundAmount;
    const isFullRefund = newTotalRefunded >= payment.amount;
    const newPaymentStatus = isFullRefund ? "refunded" : "partially_refunded";

    await PaymentRepository.updateStatus(paymentObjId, newPaymentStatus);

    await OrderRepository.updateOrderStatus(payment.order_id, isFullRefund ? "cancelled" : "confirmed", {
      payment_status: newPaymentStatus,
    });

    // Audit log
    await AuditService.log({
      userId: adminUserId,
      action: "payment.refund",
      resourceType: "payment",
      resourceId: paymentObjId,
      metadata: { refund_id: refundDoc._id, amount: refundAmount, reason: dto.reason },
    });

    return PaymentRepository.toRefundResponse(refundDoc);
  }

  public static async getCustomerPayments(
    customerId: string,
    page = 1,
    limit = 20
  ): Promise<{ payments: PaymentResponse[]; total: number }> {
    const customerObjId = new ObjectId(customerId);
    const skip = (page - 1) * limit;

    const { payments, total } = await PaymentRepository.findByCustomerId(
      customerObjId,
      skip,
      limit
    );

    return {
      payments: payments.map(PaymentRepository.toPaymentResponse),
      total,
    };
  }

  public static async getPaymentById(
    customerId: string,
    paymentId: string
  ): Promise<PaymentResponse> {
    const paymentObjId = new ObjectId(paymentId);
    const payment = await PaymentRepository.findById(paymentObjId);
    if (!payment) {
      throw new NotFoundError("Payment record not found");
    }

    if (payment.customer_id.toString() !== customerId) {
      throw new ForbiddenError("You do not have permission to view this payment");
    }

    return PaymentRepository.toPaymentResponse(payment);
  }

  public static async adminGetPaymentById(paymentId: string): Promise<PaymentResponse> {
    const paymentObjId = new ObjectId(paymentId);
    const payment = await PaymentRepository.findById(paymentObjId);
    if (!payment) {
      throw new NotFoundError("Payment record not found");
    }
    return PaymentRepository.toPaymentResponse(payment);
  }

  public static async getAllPayments(
    page = 1,
    limit = 50,
    status?: string
  ): Promise<{ payments: PaymentResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    const { payments, total } = await PaymentRepository.findAll(skip, limit, status);
    return {
      payments: payments.map(PaymentRepository.toPaymentResponse),
      total,
    };
  }
}
