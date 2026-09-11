import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import {
  PaymentDocument,
  RefundDocument,
  PaymentStatus,
  WebhookEventRecord,
  PaymentResponse,
  RefundResponse,
} from "./payment.types";

export class PaymentRepository {
  public static get paymentsCollection(): Collection<PaymentDocument> {
    return getDb().collection<PaymentDocument>("payments");
  }

  public static get refundsCollection(): Collection<RefundDocument> {
    return getDb().collection<RefundDocument>("refunds");
  }

  public static async createPayment(payment: PaymentDocument): Promise<PaymentDocument> {
    await this.paymentsCollection.insertOne(payment as any);
    return payment;
  }

  public static async findById(paymentId: ObjectId): Promise<PaymentDocument | null> {
    return this.paymentsCollection.findOne({ _id: paymentId });
  }

  public static async findByPaymentIntentId(
    stripePaymentIntentId: string
  ): Promise<PaymentDocument | null> {
    return this.paymentsCollection.findOne({
      stripe_payment_intent_id: stripePaymentIntentId,
    });
  }

  public static async findByOrderId(orderId: ObjectId): Promise<PaymentDocument | null> {
    return this.paymentsCollection.findOne({ order_id: orderId });
  }

  public static async findByCustomerId(
    customerId: ObjectId,
    skip = 0,
    limit = 20
  ): Promise<{ payments: PaymentDocument[]; total: number }> {
    const filter = { customer_id: customerId };
    const [payments, total] = await Promise.all([
      this.paymentsCollection
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.paymentsCollection.countDocuments(filter),
    ]);
    return { payments, total };
  }

  public static async updateStatus(
    paymentId: ObjectId,
    status: PaymentStatus,
    additional: Partial<PaymentDocument> = {}
  ): Promise<PaymentDocument | null> {
    return this.paymentsCollection.findOneAndUpdate(
      { _id: paymentId },
      {
        $set: {
          status,
          updated_at: new Date(),
          ...additional,
        },
      },
      { returnDocument: "after" }
    );
  }

  public static async appendWebhookEvent(
    stripePaymentIntentId: string,
    event: WebhookEventRecord
  ): Promise<boolean> {
    const res = await this.paymentsCollection.updateOne(
      {
        stripe_payment_intent_id: stripePaymentIntentId,
        "webhook_events.event_id": { $ne: event.event_id },
      },
      {
        $push: { webhook_events: event },
        $set: { updated_at: new Date() },
      }
    );
    return res.modifiedCount > 0;
  }

  public static async isWebhookProcessed(
    stripePaymentIntentId: string,
    eventId: string
  ): Promise<boolean> {
    const doc = await this.paymentsCollection.findOne({
      stripe_payment_intent_id: stripePaymentIntentId,
      "webhook_events.event_id": eventId,
    });
    return !!doc;
  }

  public static async createRefund(refund: RefundDocument): Promise<RefundDocument> {
    await this.refundsCollection.insertOne(refund as any);
    return refund;
  }

  public static async findRefundsByPaymentId(
    paymentId: ObjectId
  ): Promise<RefundDocument[]> {
    return this.refundsCollection
      .find({ payment_id: paymentId })
      .sort({ created_at: -1 })
      .toArray();
  }

  public static toPaymentResponse(doc: PaymentDocument): PaymentResponse {
    return {
      id: doc._id.toString(),
      order_id: doc.order_id.toString(),
      customer_id: doc.customer_id.toString(),
      stripe_payment_intent_id: doc.stripe_payment_intent_id,
      amount: doc.amount,
      currency: doc.currency,
      status: doc.status,
      payment_method_type: doc.payment_method_type || null,
      failure_message: doc.failure_message || null,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
    };
  }

  public static toRefundResponse(doc: RefundDocument): RefundResponse {
    return {
      id: doc._id.toString(),
      payment_id: doc.payment_id.toString(),
      order_id: doc.order_id.toString(),
      stripe_refund_id: doc.stripe_refund_id,
      amount: doc.amount,
      reason: doc.reason,
      status: doc.status,
      created_at: doc.created_at.toISOString(),
    };
  }
}
