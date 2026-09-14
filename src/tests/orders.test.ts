import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { OrderRepository } from "../modules/orders/order.repository";
import { PaymentRepository } from "../modules/payments/payment.repository";
import { CartService } from "../modules/cart/cart.service";
import { InventoryService } from "../modules/inventory/inventory.service";
import { AddressesRepository } from "../modules/users/addresses.repository";
import { SellersRepository } from "../modules/sellers/sellers.repository";
import { StripeService } from "../infrastructure/services/stripe.service";
import { generateAccessToken } from "../shared/utils/jwt";

describe("Order API Endpoints", () => {
  const customerUserId = "65f1a2b3c4d5e6f7a8b9c011";
  const sellerUserId = "65f1a2b3c4d5e6f7a8b9c022";
  const sellerProfileId = new ObjectId("65f1a2b3c4d5e6f7a8b9c033");
  const storeId = new ObjectId("65f1a2b3c4d5e6f7a8b9c044");
  const variantId = new ObjectId("65f1a2b3c4d5e6f7a8b9c055");
  const addressId = "65f1a2b3c4d5e6f7a8b9c066";
  const orderId = new ObjectId("65f1a2b3c4d5e6f7a8b9c077");
  const subOrderId = new ObjectId("65f1a2b3c4d5e6f7a8b9c088");

  let customerToken: string;
  let sellerToken: string;

  const mockAddress = {
    _id: new ObjectId(addressId),
    user_id: new ObjectId(customerUserId),
    recipient_name: "Jane Doe",
    phone: "555-0199",
    line1: "123 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: "94105",
    country: "US",
    is_default: true,
  };

  const mockCart = {
    items: [
      {
        product_id: "65f1a2b3c4d5e6f7a8b9c099",
        variant_id: variantId.toString(),
        store_id: storeId.toString(),
        seller_id: sellerProfileId.toString(),
        name: "Mechanical Keyboard",
        variant_name: "Brown Switch",
        sku: "KEY-001-BRN",
        price: 9900, // 9900 cents = $99
        quantity: 1,
      },
    ],
    subtotal: 9900,
    discount: 0,
    total: 9900,
    item_count: 1,
    coupon: null,
    updated_at: new Date().toISOString(),
  };

  const mockOrderDoc: any = {
    _id: orderId,
    order_number: "NX-2026-123456",
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
    stripe_payment_intent_id: "pi_mock_123",
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSubOrderDoc: any = {
    _id: subOrderId,
    order_id: orderId,
    order_number: "NX-2026-123456-01",
    seller_id: sellerProfileId,
    store_id: storeId,
    status: "pending",
    items: [
      {
        product_id: new ObjectId("65f1a2b3c4d5e6f7a8b9c099"),
        variant_id: variantId,
        sku: "KEY-001-BRN",
        product_name: "Mechanical Keyboard",
        variant_name: "Brown Switch",
        unit_price: 9900,
        quantity: 1,
        subtotal: 9900,
      },
    ],
    subtotal: 9900,
    seller_earnings: 8910,
    platform_commission: 990,
    commission_rate: 10,
    delivery_fee: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(StripeService, "createPaymentIntent").mockResolvedValue({
      id: "pi_mock_123",
      client_secret: "pi_mock_123_secret_mock",
      status: "requires_payment_method",
    });
    vi.spyOn(StripeService, "cancelPaymentIntent").mockResolvedValue({
      id: "pi_mock_123",
      status: "canceled",
    });

    customerToken = generateAccessToken({
      id: customerUserId,
      email: "jane@nexora.com",
      role: "CUSTOMER",
    }).token;

    sellerToken = generateAccessToken({
      id: sellerUserId,
      email: "seller@nexora.com",
      role: "SELLER",
    }).token;

    vi.spyOn(SellersRepository, "findByUserId").mockResolvedValue({
      _id: sellerProfileId,
      user_id: new ObjectId(sellerUserId),
      status: "approved",
    } as any);

    vi.spyOn(PaymentRepository, "createPayment").mockImplementation(async (doc) => doc);
    vi.spyOn(PaymentRepository, "findByOrderId").mockResolvedValue(null);
    vi.spyOn(PaymentRepository, "updateStatus").mockResolvedValue(null);
  });

  describe("POST /api/v1/orders", () => {
    it("should reject order creation if cart is empty", async () => {
      vi.spyOn(AddressesRepository, "findById").mockResolvedValue(mockAddress as any);
      vi.spyOn(CartService, "getCart").mockResolvedValue({
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0,
        item_count: 0,
        coupon: null,
        updated_at: new Date().toISOString(),
      });

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ address_id: addressId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("empty cart");
    });

    it("should successfully create order, reserve inventory, and return payment client secret", async () => {
      vi.spyOn(AddressesRepository, "findById").mockResolvedValue(mockAddress as any);
      vi.spyOn(CartService, "getCart").mockResolvedValue(mockCart as any);
      vi.spyOn(CartService, "validateCart").mockResolvedValue({
        is_valid: true,
        issues: [],
        cart: mockCart as any,
      });
      vi.spyOn(InventoryService, "reserveStock").mockResolvedValue(true);
      vi.spyOn(OrderRepository, "createOrder").mockImplementation(async (doc) => doc);
      vi.spyOn(OrderRepository, "createSubOrders").mockImplementation(async (docs) => docs);
      vi.spyOn(CartService, "clearCart").mockResolvedValue({} as any);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ address_id: addressId, notes: "Please handle with care" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.order.status).toBe("pending");
      expect(res.body.data.payment_intent_client_secret).toBeDefined();
      expect(InventoryService.reserveStock).toHaveBeenCalledWith(
        variantId.toString(),
        1,
        expect.anything()
      );
    });

    it("should rollback previously reserved stock if any variant runs out of stock", async () => {
      vi.spyOn(AddressesRepository, "findById").mockResolvedValue(mockAddress as any);
      vi.spyOn(CartService, "getCart").mockResolvedValue(mockCart as any);
      vi.spyOn(CartService, "validateCart").mockResolvedValue({
        is_valid: true,
        issues: [],
        cart: mockCart as any,
      });
      vi.spyOn(InventoryService, "reserveStock").mockResolvedValue(false); // Out of stock
      vi.spyOn(InventoryService, "releaseStock").mockResolvedValue(true);

      const res = await request(app)
        .post("/api/v1/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ address_id: addressId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("ran out of stock");
    });
  });

  describe("POST /api/v1/orders/:id/cancel", () => {
    it("should cancel a pending order and release reserved stock", async () => {
      vi.spyOn(OrderRepository, "findById").mockResolvedValue(mockOrderDoc);
      vi.spyOn(OrderRepository, "findSubOrdersByOrderId").mockResolvedValue([mockSubOrderDoc]);
      vi.spyOn(InventoryService, "releaseStock").mockResolvedValue(true);
      vi.spyOn(OrderRepository, "updateOrderStatus").mockResolvedValue({
        ...mockOrderDoc,
        status: "cancelled",
        cancelled_at: new Date(),
      });
      vi.spyOn(OrderRepository, "updateSubOrdersByOrderId").mockResolvedValue(1);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ reason: "Changed my mind" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("cancelled");
      expect(InventoryService.releaseStock).toHaveBeenCalledWith(
        variantId,
        1,
        orderId.toString()
      );
    });
  });

  describe("Seller Sub-Order Progression", () => {
    it("should allow seller to confirm a pending sub-order", async () => {
      vi.spyOn(OrderRepository, "findSubOrderById").mockResolvedValue(mockSubOrderDoc);
      vi.spyOn(OrderRepository, "updateSubOrderStatus").mockResolvedValue({
        ...mockSubOrderDoc,
        status: "confirmed",
        confirmed_at: new Date(),
      });

      const res = await request(app)
        .patch(`/api/v1/orders/seller/me/${subOrderId}/confirm`)
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("confirmed");
    });

    it("should reject invalid status jumping from pending straight to ready_for_pickup", async () => {
      vi.spyOn(OrderRepository, "findSubOrderById").mockResolvedValue(mockSubOrderDoc); // status: pending

      const res = await request(app)
        .patch(`/api/v1/orders/seller/me/${subOrderId}/ready`)
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("Cannot transition");
    });
  });
});
