import Stripe from "stripe";
import { logger } from "../logger";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const isConfigured =
  !!stripeSecretKey &&
  !stripeSecretKey.includes("...") &&
  stripeSecretKey.startsWith("sk_");

export const stripeClient: Stripe | null = isConfigured
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20" as any,
    })
  : null;

export interface CreatePaymentIntentParams {
  amount: number; // in cents
  currency?: string;
  orderId: string;
  customerId: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  id: string;
  client_secret: string;
  status: string;
}

export interface CreateTransferParams {
  amount: number; // in cents
  currency?: string;
  destination: string; // Connected account ID
  subOrderId: string;
  orderId: string;
}

export interface CreateRefundParams {
  paymentIntentId: string;
  amount?: number; // in cents
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}

export class StripeService {
  public static async createPaymentIntent(
    params: CreatePaymentIntentParams
  ): Promise<PaymentIntentResult> {
    const currency = params.currency || "usd";

    if (stripeClient) {
      try {
        const intent = await stripeClient.paymentIntents.create(
          {
            amount: params.amount,
            currency,
            metadata: {
              order_id: params.orderId,
              customer_id: params.customerId,
              ...params.metadata,
            },
          },
          {
            idempotencyKey: `order-${params.orderId}-pi`,
          }
        );

        return {
          id: intent.id,
          client_secret: intent.client_secret || "",
          status: intent.status,
        };
      } catch (err: any) {
        logger.error({ err }, `Stripe createPaymentIntent failed for order ${params.orderId}`);
        throw err;
      }
    }

    // Mock mode for development & test environments without Stripe keys
    logger.warn(
      `[MOCK STRIPE] Generating mock PaymentIntent for order ${params.orderId} (amount: $${(params.amount / 100).toFixed(2)})`
    );
    const mockId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      id: mockId,
      client_secret: `${mockId}_secret_test`,
      status: "requires_payment_method",
    };
  }

  public static constructWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
    webhookSecret?: string
  ): Stripe.Event {
    const secret = webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || "";

    if (stripeClient && secret && !secret.includes("...")) {
      return stripeClient.webhooks.constructEvent(rawBody, signature, secret);
    }

    // Simulated / fallback mode
    try {
      const payloadString =
        typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
      const parsed = JSON.parse(payloadString);
      return parsed as Stripe.Event;
    } catch {
      throw new Error("Invalid mock webhook payload");
    }
  }

  public static async createTransfer(
    params: CreateTransferParams
  ): Promise<{ id: string }> {
    if (stripeClient) {
      const transfer = await stripeClient.transfers.create(
        {
          amount: params.amount,
          currency: params.currency || "usd",
          destination: params.destination,
          transfer_group: `order-${params.orderId}`,
          metadata: {
            sub_order_id: params.subOrderId,
            order_id: params.orderId,
          },
        },
        {
          idempotencyKey: `transfer-${params.subOrderId}`,
        }
      );
      return { id: transfer.id };
    }

    logger.warn(
      `[MOCK STRIPE] Simulating transfer of $${(params.amount / 100).toFixed(2)} to ${params.destination}`
    );
    return { id: `tr_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` };
  }

  public static async createRefund(
    params: CreateRefundParams
  ): Promise<{ id: string; status: string }> {
    if (stripeClient && !params.paymentIntentId.startsWith("pi_mock_")) {
      const refund = await stripeClient.refunds.create(
        {
          payment_intent: params.paymentIntentId,
          amount: params.amount,
          reason: params.reason,
        },
        {
          idempotencyKey: `refund-${params.paymentIntentId}-${params.amount || "full"}`,
        }
      );
      return { id: refund.id, status: refund.status || "succeeded" };
    }

    logger.warn(
      `[MOCK STRIPE] Simulating refund for payment ${params.paymentIntentId}`
    );
    return {
      id: `re_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: "succeeded",
    };
  }

  public static async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    if (stripeClient && !paymentIntentId.startsWith("pi_mock_")) {
      try {
        await stripeClient.paymentIntents.cancel(paymentIntentId);
      } catch (err: any) {
        logger.warn({ err }, `Could not cancel PaymentIntent ${paymentIntentId}`);
      }
    } else {
      logger.warn(`[MOCK STRIPE] Cancelled PaymentIntent ${paymentIntentId}`);
    }
  }
}
