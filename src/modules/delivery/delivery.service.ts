import { ObjectId } from "mongodb";
import { deliveryRepository, DeliveryRepository } from "./delivery.repository";
import {
  DeliveryAgent,
  DeliveryTask,
  DeliveryTaskStatus,
  RegisterRiderDTO,
  RiderStatus,
  UpdateLocationDTO,
} from "./delivery.types";
import { OrderRepository } from "../orders/order.repository";
import { SellersRepository } from "../sellers/sellers.repository";
import { getDb } from "../../infrastructure/db/client";
import { SubOrderDocument, OrderDocument } from "../orders/order.types";
import { notificationService } from "../notifications/notification.service";
import { isSocketInitialized, getIO } from "../../infrastructure/socket/io";
import { getRedisClient } from "../../infrastructure/redis/client";
import { logger } from "../../infrastructure/logger";
import { BadRequestError, NotFoundError, ForbiddenError } from "../../shared/errors/errors";

function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class DeliveryService {
  constructor(private repo: DeliveryRepository = deliveryRepository) {}

  async registerOrGetAgent(
    userId: string,
    dto?: RegisterRiderDTO
  ): Promise<DeliveryAgent> {
    const userObjId = new ObjectId(userId);
    let agent = await this.repo.findAgentByUserId(userObjId);

    if (!agent) {
      agent = await this.repo.createAgent({
        user_id: userObjId,
        vehicle_type: dto?.vehicle_type || "motorcycle",
        vehicle_number: dto?.vehicle_number || "NX-RIDER-01",
        license_number: dto?.license_number || "LIC-998822",
        delivery_zones: dto?.delivery_zones || ["Dhaka", "Gulshan", "Banani", "Uttara", "Dhanmondi"],
        service_city: dto?.service_city || "Dhaka",
        status: "approved", // Auto-approved for testing convenience
      });
    }

    return agent;
  }

  async getRiderProfile(userId: string): Promise<DeliveryAgent> {
    const agent = await this.registerOrGetAgent(userId);
    return agent;
  }

  async toggleOnlineStatus(userId: string, is_online: boolean): Promise<DeliveryAgent> {
    const agent = await this.registerOrGetAgent(userId);
    await this.repo.setOnlineStatus(agent._id!, is_online);
    agent.is_online = is_online;
    return agent;
  }

  async createTaskForSubOrder(
    subOrder: SubOrderDocument,
    order: OrderDocument
  ): Promise<DeliveryTask> {
    // Check if task already exists
    const existing = await this.repo.findTaskBySubOrderId(subOrder._id);
    if (existing) return existing;

    const task = await this.repo.createTask({
      sub_order_id: subOrder._id,
      order_id: order._id,
      seller_id: subOrder.seller_id,
      customer_id: order.customer_id,
      status: "unassigned",
      pickup_address: {
        recipient_name: "Store Fulfillment Center",
        phone: "+1 800 555 0199",
        line1: "452 Vendor Way",
        city: "New York",
        state: "NY",
        postal_code: "10001",
        country: "USA",
        coordinates: [-73.992, 40.735], // Sample store coordinates
      },
      delivery_address: {
        ...order.delivery_address,
        coordinates: [-74.006, 40.7128], // Sample destination
      },
      rider_earnings: 550, // $5.50
    });

    // Auto-trigger assignment attempt
    await this.autoAssignTask(task._id!.toString());

    return task;
  }

  async autoAssignTask(taskId: string): Promise<boolean> {
    const task = await this.repo.findTaskById(taskId);
    if (!task || task.status !== "unassigned") return false;

    const storeCoords = task.pickup_address.coordinates || [-73.992, 40.735];
    const riders = await this.repo.findNearbyAvailableRiders(
      storeCoords[0],
      storeCoords[1],
      15000 // 15km search radius
    );

    if (!riders || riders.length === 0) {
      logger.warn({ taskId }, "No online riders found in proximity for auto-assignment");
      return false;
    }

    const selectedRider = riders[0];
    const riderIdStr = selectedRider._id!.toString();

    // Redis distributed lock on assignment
    const redis = getRedisClient();
    const lockKey = `lock:assignment:${riderIdStr}`;
    const acquired = await redis.set(lockKey, "1", "EX", 10, "NX");
    if (!acquired) {
      logger.info({ riderId: riderIdStr }, "Rider assignment lock contention; skipping");
      return false;
    }

    try {
      const assigned = await this.repo.assignRiderToTask(task._id!, selectedRider._id!);
      if (!assigned) return false;

      await this.repo.setActiveTaskId(selectedRider._id!, new ObjectId(task._id!));

      // Real-time broadcast
      if (isSocketInitialized()) {
        const io = getIO();
        const payload = {
          taskId: task._id!.toString(),
          orderId: task.order_id.toString(),
          riderId: selectedRider._id!.toString(),
          pickupAddress: task.pickup_address,
          deliveryAddress: task.delivery_address,
        };

        io.to(`user:${selectedRider.user_id.toString()}`).emit(
          "delivery:task_assigned",
          payload
        );
        io.to(`order:${task.order_id.toString()}`).emit("delivery:assigned", payload);
      }

      // Create in-app notification for rider
      await notificationService.createNotification({
        user_id: selectedRider.user_id.toString(),
        type: "delivery_assigned",
        title: "New Delivery Assigned",
        body: `You have been assigned order delivery ${task.task_number}. Tap to accept.`,
        reference_id: task._id!.toString(),
        reference_type: "delivery",
      });

      return true;
    } finally {
      await redis.del(lockKey).catch(() => {});
    }
  }

  // RIDER STATE MACHINE ACTIONS
  private async getRiderAndValidateTask(
    taskId: string,
    userId: string
  ): Promise<{ task: DeliveryTask; agent: DeliveryAgent }> {
    const agent = await this.registerOrGetAgent(userId);
    const task = await this.repo.findTaskById(taskId);
    if (!task) {
      throw new NotFoundError("Delivery task not found");
    }

    if (
      task.delivery_agent_id &&
      task.delivery_agent_id.toString() !== agent._id!.toString()
    ) {
      throw new ForbiddenError("You are not assigned to this delivery task");
    }

    return { task, agent };
  }

  async startPickup(taskId: string, userId: string): Promise<DeliveryTask> {
    const { task } = await this.getRiderAndValidateTask(taskId, userId);
    if (task.status !== "assigned") {
      throw new BadRequestError(`Cannot start pickup from status "${task.status}"`);
    }

    await this.repo.updateTaskStatus(taskId, "en_route_pickup");
    task.status = "en_route_pickup";

    this.emitDeliveryStatus(task, "delivery:en_route_pickup");
    return task;
  }

  async confirmPickup(taskId: string, userId: string): Promise<DeliveryTask> {
    const { task } = await this.getRiderAndValidateTask(taskId, userId);
    if (task.status !== "en_route_pickup") {
      throw new BadRequestError(`Cannot confirm pickup from status "${task.status}"`);
    }

    const now = new Date();
    await this.repo.updateTaskStatus(taskId, "picked_up", { actual_pickup: now });
    task.status = "picked_up";
    task.actual_pickup = now;

    // Update ALL sub_orders of this order to "picked_up" with timestamp
    await OrderRepository.updateSubOrdersByOrderId(task.order_id, "picked_up" as any, {
      picked_up_at: now,
      updated_at: now,
    });

    // Also update parent order status and timestamp
    await OrderRepository.updateOrderStatus(task.order_id, "picked_up" as any, {
      picked_up_at: now,
      updated_at: now,
    });

    this.emitDeliveryStatus(task, "delivery:picked_up", {
      status: "picked_up",
      picked_up_at: now.toISOString(),
    });
    return task;
  }

  async startDelivery(taskId: string, userId: string): Promise<DeliveryTask> {
    const { task } = await this.getRiderAndValidateTask(taskId, userId);
    if (task.status !== "picked_up") {
      throw new BadRequestError(`Cannot start customer delivery from status "${task.status}"`);
    }

    const now = new Date();
    await this.repo.updateTaskStatus(taskId, "en_route_delivery");
    task.status = "en_route_delivery";

    // Update ALL sub_orders of this order to in_transit
    await OrderRepository.updateSubOrdersByOrderId(task.order_id, "in_transit" as any, {
      in_transit_at: now,
      updated_at: now,
    });

    // Also update parent order status to in_transit
    await OrderRepository.updateOrderStatus(task.order_id, "in_transit" as any, {
      in_transit_at: now,
      updated_at: now,
    });

    this.emitDeliveryStatus(task, "delivery:en_route_delivery", {
      status: "in_transit",
      in_transit_at: now.toISOString(),
    });
    return task;
  }

  async completeDelivery(taskId: string, userId: string): Promise<DeliveryTask> {
    const { task, agent } = await this.getRiderAndValidateTask(taskId, userId);
    if (task.status !== "en_route_delivery") {
      throw new BadRequestError(`Cannot complete delivery from status "${task.status}"`);
    }

    const now = new Date();
    await this.repo.updateTaskStatus(taskId, "delivered", { actual_delivery: now });
    task.status = "delivered";
    task.actual_delivery = now;

    // Credit earnings to rider
    await this.repo.creditEarnings(agent._id!, task.rider_earnings || 550);

    // Update ALL sub_orders of this order to delivered with delivered_at
    await OrderRepository.updateSubOrdersByOrderId(task.order_id, "delivered" as any, {
      delivered_at: now,
      updated_at: now,
    });

    // Update parent order to completed with delivered_at
    await OrderRepository.updateOrderStatus(task.order_id, "completed", {
      delivered_at: now,
      updated_at: now,
    });

    // Broadcast completion & create notifications
    this.emitDeliveryStatus(task, "delivery:delivered", {
      status: "completed",
      delivered_at: now.toISOString(),
    });

    await notificationService.createNotification({
      user_id: task.customer_id.toString(),
      type: "delivery_completed",
      title: "Order Delivered!",
      body: `Your package from order ${task.task_number} has been delivered safely.`,
      reference_id: task.order_id.toString(),
      reference_type: "order",
    });

    return task;
  }

  async failDelivery(taskId: string, userId: string, reason: string): Promise<DeliveryTask> {
    const { task, agent } = await this.getRiderAndValidateTask(taskId, userId);

    await this.repo.updateTaskStatus(taskId, "failed", { failure_reason: reason });
    await this.repo.setActiveTaskId(agent._id!, null);
    task.status = "failed";
    task.failure_reason = reason;

    this.emitDeliveryStatus(task, "delivery:failed", { reason });
    return task;
  }

  // LOCATION TRACKING
  async updateLocation(userId: string, dto: UpdateLocationDTO): Promise<{ etaMinutes: number }> {
    const agent = await this.registerOrGetAgent(userId);
    await this.repo.updateAgentLocation(agent._id!, dto.longitude, dto.latitude);

    // Redis ephemeral cache
    const redis = getRedisClient();
    await redis.set(
      `rider:location:${userId}`,
      JSON.stringify({
        lat: dto.latitude,
        lon: dto.longitude,
        timestamp: Date.now(),
      }),
      "EX",
      30
    );

    let etaMinutes = 15;
    if (dto.taskId) {
      const task = await this.repo.findTaskById(dto.taskId);
      if (task) {
        const destCoords =
          task.status === "en_route_pickup"
            ? task.pickup_address.coordinates || [-73.992, 40.735]
            : task.delivery_address.coordinates || [-74.006, 40.7128];

        const distKm = calculateHaversineDistanceKm(
          dto.latitude,
          dto.longitude,
          destCoords[1],
          destCoords[0]
        );

        // Average city speed: 30 km/h -> 0.5 km/min
        etaMinutes = Math.max(2, Math.round(distKm / 0.5));

        if (isSocketInitialized()) {
          getIO().to(`delivery:${dto.taskId}`).emit("delivery:location_updated", {
            taskId: dto.taskId,
            lat: dto.latitude,
            lon: dto.longitude,
            etaMinutes,
            distanceKm: parseFloat(distKm.toFixed(2)),
          });
        }
      }
    }

    return { etaMinutes };
  }

  async getTrackingDetails(taskId: string): Promise<any> {
    const task = await this.repo.findTaskById(taskId);
    if (!task) {
      throw new NotFoundError("Delivery task not found");
    }

    let riderInfo = null;
    if (task.delivery_agent_id) {
      const agent = await this.repo.findAgentById(task.delivery_agent_id);
      if (agent) {
        riderInfo = {
          agentId: agent._id,
          vehicleType: agent.vehicle_type,
          vehicleNumber: agent.vehicle_number,
          rating: agent.rating,
          totalDeliveries: agent.total_deliveries,
          currentLocation: agent.current_location,
        };
      }
    }

    return {
      task,
      rider: riderInfo,
    };
  }

  async getRiderTasks(userId: string): Promise<DeliveryTask[]> {
    const agent = await this.registerOrGetAgent(userId);
    return this.repo.findTasksByAgent(agent._id!);
  }

  private emitDeliveryStatus(
    task: DeliveryTask,
    event: string,
    extra: Record<string, any> = {}
  ) {
    if (!isSocketInitialized()) return;
    const io = getIO();
    const payload = {
      taskId: task._id!.toString(),
      orderId: task.order_id.toString(),
      status: task.status,
      timestamp: new Date().toISOString(),
      ...extra,
    };

    io.to(`delivery:${task._id!.toString()}`).emit(event, payload);
    io.to(`order:${task.order_id.toString()}`).emit(event, payload);
    io.to(`order:${task.order_id.toString()}`).emit("order:status_updated", payload);
  }

  // ADMIN METHODS
  async adminListRiders(skip = 0, limit = 20, status?: RiderStatus) {
    return this.repo.adminListAgents(skip, limit, status);
  }

  async adminUpdateRiderStatus(agentId: string, status: RiderStatus) {
    return this.repo.updateAgentStatus(agentId, status);
  }

  async adminListTasks(skip = 0, limit = 20, status?: DeliveryTaskStatus) {
    return this.repo.adminListTasks(skip, limit, status);
  }

  async getAvailableRiders(city?: string, zone?: string): Promise<DeliveryAgent[]> {
    return this.repo.findAllAvailableRiders(city, zone);
  }

  async updateRiderProfile(
    userId: string,
    dto: {
      vehicle_type?: any;
      vehicle_number?: string;
      license_number?: string;
      delivery_zones?: string[];
      service_city?: string;
      phone?: string;
    }
  ): Promise<DeliveryAgent> {
    const agent = await this.registerOrGetAgent(userId);
    const updateData: any = {};
    if (dto.vehicle_type) updateData.vehicle_type = dto.vehicle_type;
    if (dto.vehicle_number) updateData.vehicle_number = dto.vehicle_number;
    if (dto.license_number) updateData.license_number = dto.license_number;
    if (dto.delivery_zones) updateData.delivery_zones = dto.delivery_zones;
    if (dto.service_city) updateData.service_city = dto.service_city;

    await this.repo.updateAgentProfile(agent._id!, updateData);

    if (dto.phone) {
      try {
        await getDb().collection("users").updateOne(
          { _id: new ObjectId(userId) },
          { $set: { phone: dto.phone, updated_at: new Date() } }
        );
      } catch {}
    }

    return this.getRiderProfile(userId);
  }

  async assignRiderToSubOrder(
    callerUser: { id: string; role: string },
    payload: { subOrderId: string; riderId: string; orderId?: string }
  ) {
    const subOrderObjId = new ObjectId(payload.subOrderId);
    const subOrder = await OrderRepository.findSubOrderById(subOrderObjId);
    if (!subOrder) {
      throw new NotFoundError("Sub-order not found");
    }

    // Role-based verification:
    // If order has no merchant/seller (platform product): only Admin can assign
    // If order has merchant: both Admin AND that Merchant can assign
    const isAdmin = callerUser.role === "ADMIN" || callerUser.role === "SUPER_ADMIN";
    if (!isAdmin) {
      if (!subOrder.seller_id) {
        throw new ForbiddenError("Only platform administrators can assign riders to non-merchant platform orders.");
      }
      const seller = await SellersRepository.findByUserId(callerUser.id);
      if (!seller || seller._id.toString() !== subOrder.seller_id.toString()) {
        throw new ForbiddenError("You can only assign riders to orders belonging to your own store.");
      }
    }

    // Validate Rider
    const agent = await this.repo.findAgentById(payload.riderId);
    if (!agent) {
      throw new NotFoundError("Rider not found");
    }

    // Resolve rider user details for snapshot
    let riderName = "Delivery Rider";
    let riderPhone = agent.phone || "";
    try {
      const user = await getDb().collection("users").findOne({ _id: new ObjectId(agent.user_id) });
      if (user) {
        riderName = `${user.first_name} ${user.last_name}`.trim();
        riderPhone = user.phone || riderPhone;
      }
    } catch {}

    // Find or create DeliveryTask
    let task = await this.repo.findTaskBySubOrderId(subOrder._id);
    if (!task) {
      task = await this.repo.createTask({
        task_number: `TSK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        sub_order_id: subOrder._id,
        order_id: subOrder.order_id,
        seller_id: subOrder.seller_id || new ObjectId("65f1a2b3c4d5e6f7a8b9c001"),
        customer_id: subOrder.customer_id || new ObjectId("65f1a2b3c4d5e6f7a8b9c003"),
        delivery_agent_id: null,
        status: "unassigned",
        pickup_address: {
          recipient_name: "Store Dispatch Hub",
          phone: "+15550000000",
          line1: "Warehouse Dispatch Center",
          city: subOrder.delivery_address?.city || "Dhaka",
          state: subOrder.delivery_address?.state || "Dhaka",
          postal_code: subOrder.delivery_address?.postal_code || "1212",
          country: subOrder.delivery_address?.country || "BD",
        },
        delivery_address: subOrder.delivery_address || {
          recipient_name: "Customer Destination",
          phone: "+15550000000",
          line1: "Delivery Address",
          city: "Dhaka",
          state: "Dhaka",
          postal_code: "1212",
          country: "BD",
        },
        rider_earnings: 300,
        assignment_attempts: 1,
      });
    }

    const assignedAgentObjId = typeof agent._id === "string" ? new ObjectId(agent._id) : agent._id!;
    await this.repo.assignRiderToTask(task._id!, assignedAgentObjId);
    await this.repo.setActiveTaskId(assignedAgentObjId, new ObjectId(task._id!));
    await this.repo.updateTaskStatus(task._id!.toString(), "assigned");

    const assignedRiderSnapshot = {
      agent_id: assignedAgentObjId.toString(),
      user_id: agent.user_id.toString(),
      name: riderName,
      phone: riderPhone,
      vehicle_type: agent.vehicle_type,
      vehicle_number: agent.vehicle_number,
      delivery_zones: agent.delivery_zones || ["Dhaka", "Gulshan", "Banani", "Uttara", "Dhanmondi"],
      assigned_at: new Date().toISOString(),
    };

    const newStatus = (subOrder.status === "pending" || subOrder.status === "confirmed" || subOrder.status === "preparing")
      ? "ready_for_pickup"
      : subOrder.status;

    const nowTimestamp = new Date();
    // Assign rider to ALL sub-orders under this parent order
    await getDb().collection("sub_orders").updateMany(
      { order_id: subOrder.order_id },
      {
        $set: {
          delivery_agent_id: agent._id,
          assigned_rider: assignedRiderSnapshot,
          status: newStatus,
          ready_at: newStatus === "ready_for_pickup" ? nowTimestamp : (subOrder.ready_at || nowTimestamp),
          updated_at: nowTimestamp,
        },
      }
    );

    // Sync all delivery tasks under this order
    await getDb().collection("delivery_tasks").updateMany(
      { order_id: subOrder.order_id },
      {
        $set: {
          delivery_agent_id: assignedAgentObjId,
          status: "assigned",
          updated_at: nowTimestamp,
        },
      }
    );

    // Also sync parent order so customer & admin see assigned rider and advanced status
    await getDb().collection("orders").updateOne(
      { _id: subOrder.order_id },
      {
        $set: {
          assigned_rider: assignedRiderSnapshot,
          status: newStatus,
          ready_at: newStatus === "ready_for_pickup" ? nowTimestamp : (subOrder.ready_at || nowTimestamp),
          updated_at: nowTimestamp,
        },
      }
    );

    // Broadcast WebSocket updates
    if (isSocketInitialized()) {
      const io = getIO();
      const payload = {
        taskId: task._id!.toString(),
        subOrderId: subOrder._id.toString(),
        orderId: subOrder.order_id.toString(),
        status: "assigned",
        rider: assignedRiderSnapshot,
      };
      io.to(`order:${subOrder.order_id.toString()}`).emit("delivery:assigned", payload);
      io.to(`user:${agent.user_id.toString()}`).emit("delivery:task_assigned", payload);
    }

    // In-app notifications
    try {
      if (subOrder.customer_id) {
        await notificationService.createNotification({
          user_id: subOrder.customer_id.toString(),
          title: "Courier Rider Assigned",
          body: `Rider ${riderName} has been assigned for order #${subOrder.order_number}.`,
          type: "delivery_assigned",
          reference_id: subOrder.order_id.toString(),
          reference_type: "order",
        });
      }
      await notificationService.createNotification({
        user_id: agent.user_id.toString(),
        title: "New Delivery Assigned",
        body: `You have been assigned to deliver order #${subOrder.order_number}.`,
        type: "delivery_assigned",
        reference_id: task._id!.toString(),
        reference_type: "delivery",
      });
    } catch {}

    const updatedSubOrder = await OrderRepository.findSubOrderById(subOrder._id);
    return {
      success: true,
      subOrder: updatedSubOrder ? OrderRepository.toSubOrderResponse(updatedSubOrder) : null,
      assignedRider: assignedRiderSnapshot,
    };
  }


  async requestCashout(
    userId: string,
    amountCents: number,
    method: string,
    accountDetails: string
  ) {
    const agent = await this.registerOrGetAgent(userId);
    if (!agent._id) throw new BadRequestError("Delivery agent profile not found");

    if (amountCents <= 0) {
      throw new BadRequestError("Cashout amount must be greater than zero");
    }
    if ((agent.pending_earnings || 0) < amountCents) {
      throw new BadRequestError(
        `Insufficient available balance. Available: $${((agent.pending_earnings || 0) / 100).toFixed(2)}`
      );
    }

    // Deduct from pending earnings
    await this.repo.deductPendingEarnings(agent._id!, amountCents);

    const payoutRecord = {
      _id: new ObjectId(),
      agent_id: new ObjectId(agent._id.toString()),
      user_id: new ObjectId(userId),
      amount: amountCents,
      method: method || "bkash",
      account_details: accountDetails || "",
      status: "processing",
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.repo.recordPayout(payoutRecord);
    return payoutRecord;
  }

  async getPayouts(userId: string) {
    const agent = await this.registerOrGetAgent(userId);
    if (!agent._id) return [];
    return await this.repo.findPayoutsByAgentId(agent._id!);
  }
}

export const deliveryService = new DeliveryService();
