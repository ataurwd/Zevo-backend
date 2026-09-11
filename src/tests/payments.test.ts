import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { PaymentRepository } from "../modules/payments/payment.repository";
import { OrderRepository } from "../modules/orders/order.repository";
import { InventoryService } from "../modules/inventory/inventory.service";
import { SellersRepository } from "../modules/sellers/sellers.repository";
import { StripeService } from "../infrastructure/services/stripe.service";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Payment API & Webhook Endpoints", () => {
  const customerUserId = "65f1a2b3c4d5e6f7a8b9c011";
  const adminUserId = "65f1a2b3c4d5e6f7a8b9c099";
  const sellerId = new ObjectId("65f1a2b3c4d5e6f7a8b9c033");
  const orderId = new ObjectId("65f1a2b3c4d5e6f7a8b9c077");
  const paymentId = new ObjectId("65f1a2b3c4d5e6f7a8b9c0aa");
  const variantId = new ObjectId("65f1a2b3c4d5e6f7a8b9c055");
  const piId = "pi_test_123456789";

  let customerToken: string;
  let adminToken: string;

  const mockPayment: any = {
    _id: paymentId,
    order_id: orderId,
    customer_id: new ObjectId(customerUserId),
    stripe_payment_intent_id: piId,
    amount: 10400,
    currency: "usd",
    status: "pending",
    webhook_events: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockOrder: any = {
    _id: orderId,
    order_number: "NX-2026-999888",
    customer_id: new ObjectId(customerUserId),
    status: "pending",
    payment_status: "pending",
    subtotal: 9900,
    discount_amount: 0,
    delivery_fee: 500,
    platform_fee: 990,
    total: 10400,
    currency: "usd",
    delivery_address: {
      recipient_name: "Jane Doe",
      phone: "555-0199",
      line1: "123 Market St",
      city: "San Francisco",
      state: "CA",
      postal_code: "94105",
      country: "US",
    },
    stripe_payment_intent_id: piId,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSubOrder: any = {
    _id: new ObjectId("65f1a2b3c4d5e6f7a8b9c088"),
    order_id: orderId,
    seller_id: sellerId,
    status: "pending",
    items: [
      {
        product_id: new ObjectId(),
        variant_id: variantId,
        sku: "KEY-001",
        product_name: "Keyboard",
        variant_name: "Brown",
        unit_price: 9900,
        quantity: 1,
        subtotal: 9900,
      },
    ],
    subtotal: 9900,
    seller_earnings: 8910,
    platform_commission: 990,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    customerToken = generateAccessToken({
      id: customerUserId,
      email: "customer@nexora.com",
      role: "CUSTOMER",
    }).token;

    adminToken = generateAccessToken({
      id: adminUserId,
      email: "admin@nexora.com",
      role: "ADMIN",
    }).token;
  });

  describe("POST /api/v1/payments/webhook", () => {
    it("should handle payment_intent.succeeded by confirming order, deducting stock, and crediting seller", async () => {
      const webhookPayload = {
        id: "evt_test_1",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: piId,
            latest_charge: "ch_test_123",
            payment_method_types: ["card"],
          },
        },
      };

      vi.spyOn(StripeService, "constructWebhookEvent").mockReturnValue(webhookPayload as any);
      vi.spyOn(PaymentRepository, "isWebhookProcessed").mockResolvedValue(false);
      vi.spyOn(PaymentRepository, "appendWebhookEvent").mockResolvedValue(true);
      vi.spyOn(PaymentRepository, "findByPaymentIntentId").mockResolvedValue(mockPayment);
      vi.spyOn(PaymentRepository, "updateStatus").mockResolvedValue({ ...mockPayment, status: "succeeded" });
      vi.spyOn(OrderRepository, "findById").mockResolvedValue(mockOrder);
      vi.spyOn(OrderRepository, "updateOrderStatus").mockResolvedValue({ ...mockOrder, status: "confirmed", payment_status: "paid" });
      vi.spyOn(OrderRepository, "updateSubOrdersByOrderId").mockResolvedValue(1);
      vi.spyOn(OrderRepository, "findSubOrdersByOrderId").mockResolvedValue([mockSubOrder]);
      vi.spyOn(InventoryService, "deductStock").mockResolvedValue(true);
      vi.spyOn(SellersRepository, "creditSellerBalance").mockResolvedValue();

      const res = await request(app)
        .post("/api/v1/payments/webhook")
        .set("stripe-signature", "t=123,v1=abc")
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(PaymentRepository.appendWebhookEvent).toHaveBeenCalled();
    });

    it("should return duplicate: true on duplicate webhook delivery (idempotency)", async () => {
      const webhookPayload = {
        id: "evt_duplicate_test",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: piId,
          },
        },
      };

      vi.spyOn(StripeService, "constructWebhookEvent").mockReturnValue(webhookPayload as any);
      vi.spyOn(PaymentRepository, "isWebhookProcessed").mockResolvedValue(true);

      const res = await request(app)
        .post("/api/v1/payments/webhook")
        .set("stripe-signature", "t=123,v1=abc")
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.duplicate).toBe(true);
    });
  });

  describe("Admin Refund: POST /api/v1/payments/admin/:id/refund", () => {
    it("should allow admin to issue a refund on succeeded payment", async () => {
      const succeededPayment = { ...mockPayment, status: "succeeded" };
      vi.spyOn(PaymentRepository, "findById").mockResolvedValue(succeededPayment);
      vi.spyOn(PaymentRepository, "findRefundsByPaymentId").mockResolvedValue([]);
      vi.spyOn(StripeService, "createRefund").mockResolvedValue({ id: "re_test_123", status: "succeeded" });
      vi.spyOn(PaymentRepository, "createRefund").mockImplementation(async (r) => r);
      vi.spyOn(PaymentRepository, "updateStatus").mockResolvedValue({ ...succeededPayment, status: "refunded" });
      vi.spyOn(OrderRepository, "updateOrderStatus").mockResolvedValue({ ...mockOrder, status: "cancelled" });

      const res = await request(app)
        .post(`/api/v1/payments/admin/${paymentId}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          amount: 10400,
          reason: "customer_request",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stripe_refund_id).toBe("re_test_123");
    });

    it("should forbid non-admin customers from initiating refunds", async () => {
      const res = await request(app)
        .post(`/api/v1/payments/admin/${paymentId}/refund`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          amount: 10400,
          reason: "customer_request",
        });

      expect(res.status).toBe(403);
    });
  });
});
