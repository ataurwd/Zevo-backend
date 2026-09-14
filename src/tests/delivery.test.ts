import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { ObjectId } from "mongodb";
import { app } from "../app";
import { deliveryRepository } from "../modules/delivery/delivery.repository";
import { OrderRepository } from "../modules/orders/order.repository";
import { notificationService } from "../modules/notifications/notification.service";
import { generateAccessToken } from "../shared/utils/jwt";
import { DeliveryAgent, DeliveryTask } from "../modules/delivery/delivery.types";

describe("Delivery System & Rider Network API", () => {
  const riderUserId = "65f1a2b3c4d5e6f7a8b9c201";
  const agentId = new ObjectId("65f1a2b3c4d5e6f7a8b9c202");
  const taskId = new ObjectId("65f1a2b3c4d5e6f7a8b9c203");
  const subOrderId = new ObjectId("65f1a2b3c4d5e6f7a8b9c204");
  const orderId = new ObjectId("65f1a2b3c4d5e6f7a8b9c205");
  const customerId = new ObjectId("65f1a2b3c4d5e6f7a8b9c206");
  const sellerId = new ObjectId("65f1a2b3c4d5e6f7a8b9c207");

  let riderToken: string;
  let customerToken: string;

  const mockAgent: DeliveryAgent = {
    _id: agentId,
    user_id: new ObjectId(riderUserId),
    vehicle_type: "motorcycle",
    vehicle_number: "NX-MOTO-99",
    license_number: "LIC-774411",
    status: "approved",
    is_online: true,
    current_location: { type: "Point", coordinates: [-74.006, 40.7128] },
    active_task_id: taskId,
    pending_earnings: 1200,
    total_earnings: 4500,
    rating: 4.9,
    total_deliveries: 15,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTask: DeliveryTask = {
    _id: taskId,
    task_number: "DLV-2026-123456",
    sub_order_id: subOrderId,
    order_id: orderId,
    seller_id: sellerId,
    customer_id: customerId,
    delivery_agent_id: agentId,
    status: "assigned",
    pickup_address: {
      recipient_name: "Vendor Central",
      phone: "555-0100",
      line1: "100 Warehouse Way",
      city: "San Francisco",
      state: "CA",
      postal_code: "94107",
      country: "USA",
      coordinates: [-122.4194, 37.7749],
    },
    delivery_address: {
      recipient_name: "Alice Customer",
      phone: "555-0199",
      line1: "456 Market St",
      city: "San Francisco",
      state: "CA",
      postal_code: "94105",
      country: "USA",
      coordinates: [-122.3999, 37.7908],
    },
    estimated_pickup: null,
    estimated_delivery: null,
    actual_pickup: null,
    actual_delivery: null,
    rider_earnings: 600, // $6.00
    assignment_attempts: 1,
    failure_reason: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    riderToken = generateAccessToken({
      id: riderUserId,
      email: "rider@nexora.com",
      role: "DELIVERY_AGENT",
    }).token;

    customerToken = generateAccessToken({
      id: customerId.toString(),
      email: "customer@nexora.com",
      role: "CUSTOMER",
    }).token;
  });

  it("should fetch rider profile successfully", async () => {
    vi.spyOn(deliveryRepository, "findAgentByUserId").mockResolvedValue(mockAgent);

    const res = await request(app)
      .get("/api/v1/delivery/rider/me/profile")
      .set("Authorization", `Bearer ${riderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehicle_number).toBe("NX-MOTO-99");
  });

  it("should toggle online/offline status", async () => {
    vi.spyOn(deliveryRepository, "findAgentByUserId").mockResolvedValue(mockAgent);
    vi.spyOn(deliveryRepository, "setOnlineStatus").mockResolvedValue(true);

    const res = await request(app)
      .patch("/api/v1/delivery/rider/me/status")
      .set("Authorization", `Bearer ${riderToken}`)
      .send({ is_online: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_online).toBe(false);
  });

  it("should transition delivery task through lifecycle: pickup -> picked_up -> start_delivery -> deliver", async () => {
    vi.spyOn(deliveryRepository, "findAgentByUserId").mockResolvedValue(mockAgent);
    vi.spyOn(deliveryRepository, "findTaskById").mockResolvedValue({ ...mockTask });
    vi.spyOn(deliveryRepository, "updateTaskStatus").mockResolvedValue(true);
    vi.spyOn(deliveryRepository, "creditEarnings").mockResolvedValue(true);
    vi.spyOn(OrderRepository, "updateSubOrderStatus").mockResolvedValue(null as any);
    vi.spyOn(OrderRepository, "findSubOrdersByOrderId").mockResolvedValue([]);
    vi.spyOn(OrderRepository, "updateOrderStatus").mockResolvedValue(null as any);

    // 1. Start pickup
    const pickupRes = await request(app)
      .patch(`/api/v1/delivery/rider/me/tasks/${taskId.toString()}/pickup`)
      .set("Authorization", `Bearer ${riderToken}`);

    expect(pickupRes.status).toBe(200);
    expect(pickupRes.body.data.status).toBe("en_route_pickup");

    // 2. Confirm picked up
    vi.spyOn(deliveryRepository, "findTaskById").mockResolvedValue({
      ...mockTask,
      status: "en_route_pickup",
    });

    const pickedUpRes = await request(app)
      .patch(`/api/v1/delivery/rider/me/tasks/${taskId.toString()}/picked-up`)
      .set("Authorization", `Bearer ${riderToken}`);

    expect(pickedUpRes.status).toBe(200);
    expect(pickedUpRes.body.data.status).toBe("picked_up");

    // 3. Start delivery
    vi.spyOn(deliveryRepository, "findTaskById").mockResolvedValue({
      ...mockTask,
      status: "picked_up",
    });

    const enRouteRes = await request(app)
      .patch(`/api/v1/delivery/rider/me/tasks/${taskId.toString()}/start-delivery`)
      .set("Authorization", `Bearer ${riderToken}`);

    expect(enRouteRes.status).toBe(200);
    expect(enRouteRes.body.data.status).toBe("en_route_delivery");

    // 4. Deliver and credit earnings
    vi.spyOn(deliveryRepository, "findTaskById").mockResolvedValue({
      ...mockTask,
      status: "en_route_delivery",
    });
    vi.spyOn(notificationService, "createNotification").mockResolvedValue({} as any);

    const deliverRes = await request(app)
      .patch(`/api/v1/delivery/rider/me/tasks/${taskId.toString()}/deliver`)
      .set("Authorization", `Bearer ${riderToken}`);

    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.status).toBe("delivered");
  });

  it("should reject illegal state machine transition", async () => {
    vi.spyOn(deliveryRepository, "findAgentByUserId").mockResolvedValue(mockAgent);
    // Task is in "assigned" state, trying to deliver directly
    vi.spyOn(deliveryRepository, "findTaskById").mockResolvedValue({
      ...mockTask,
      status: "assigned",
    });

    const res = await request(app)
      .patch(`/api/v1/delivery/rider/me/tasks/${taskId.toString()}/deliver`)
      .set("Authorization", `Bearer ${riderToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("Cannot complete delivery from status");
  });

  it("should return live tracking details for customer", async () => {
    vi.spyOn(deliveryRepository, "findTaskById").mockResolvedValue({
      ...mockTask,
      status: "en_route_delivery",
    });
    vi.spyOn(deliveryRepository, "findAgentById").mockResolvedValue(mockAgent);

    const res = await request(app)
      .get(`/api/v1/delivery/track/${taskId.toString()}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.task.status).toBe("en_route_delivery");
    expect(res.body.data.rider.vehicleNumber).toBe("NX-MOTO-99");
  });
});
