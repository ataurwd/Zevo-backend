import { ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import {
  DeliveryAgent,
  DeliveryTask,
  DeliveryTaskStatus,
  RiderStatus,
} from "./delivery.types";

export class DeliveryRepository {
  private get agentsCollection() {
    return getDb().collection<DeliveryAgent>("delivery_agents");
  }

  private get tasksCollection() {
    return getDb().collection<DeliveryTask>("delivery_tasks");
  }

  async initIndexes(): Promise<void> {
    try {
      await this.agentsCollection.createIndex(
        { user_id: 1 },
        { unique: true, name: "agent_user_id_unique" }
      );
      await this.agentsCollection.createIndex(
        { current_location: "2dsphere" },
        { name: "agent_location_2dsphere" }
      );
      await this.tasksCollection.createIndex(
        { task_number: 1 },
        { unique: true, name: "task_number_unique" }
      );
      await this.tasksCollection.createIndex(
        { sub_order_id: 1 },
        { name: "task_sub_order_idx" }
      );
      await this.tasksCollection.createIndex(
        { delivery_agent_id: 1, status: 1 },
        { name: "task_agent_status_idx" }
      );
    } catch {
      // Indexes might already exist
    }
  }

  // AGENT OPERATIONS
  async createAgent(data: Partial<DeliveryAgent>): Promise<DeliveryAgent> {
    const doc: DeliveryAgent = {
      user_id: data.user_id!,
      vehicle_type: data.vehicle_type || "motorcycle",
      vehicle_number: data.vehicle_number || "",
      license_number: data.license_number || "",
      status: data.status || "approved", // default approved in dev/testing
      is_online: false,
      current_location: data.current_location || {
        type: "Point",
        coordinates: [-74.006, 40.7128], // Default coordinates [lng, lat]
      },
      active_task_id: null,
      pending_earnings: 0,
      total_earnings: 0,
      rating: 5.0,
      total_deliveries: 0,
      delivery_zones: data.delivery_zones || ["Dhaka", "Gulshan", "Banani", "Uttara", "Dhanmondi"],
      service_city: data.service_city || "Dhaka",
      created_at: new Date(),
      updated_at: new Date(),
    };

    const res = await this.agentsCollection.insertOne(doc);
    return { ...doc, _id: res.insertedId };
  }

  async findAgentByUserId(userId: ObjectId | string): Promise<DeliveryAgent | null> {
    const userObjId = typeof userId === "string" ? new ObjectId(userId) : userId;
    return this.agentsCollection.findOne({ user_id: userObjId });
  }

  async findAgentById(agentId: ObjectId | string): Promise<DeliveryAgent | null> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    return this.agentsCollection.findOne({ _id: objId });
  }

  async setOnlineStatus(agentId: ObjectId | string, is_online: boolean): Promise<boolean> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    const res = await this.agentsCollection.updateOne(
      { _id: objId },
      { $set: { is_online, updated_at: new Date() } }
    );
    return res.modifiedCount > 0;
  }

  async updateAgentLocation(
    agentId: ObjectId | string,
    longitude: number,
    latitude: number
  ): Promise<boolean> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    const res = await this.agentsCollection.updateOne(
      { _id: objId },
      {
        $set: {
          current_location: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          updated_at: new Date(),
        },
      }
    );
    return res.modifiedCount > 0;
  }

  async setActiveTaskId(
    agentId: ObjectId | string,
    taskId: ObjectId | null
  ): Promise<boolean> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    const res = await this.agentsCollection.updateOne(
      { _id: objId },
      { $set: { active_task_id: taskId, updated_at: new Date() } }
    );
    return res.modifiedCount > 0;
  }

  async creditEarnings(
    agentId: ObjectId | string,
    earningsCents: number
  ): Promise<boolean> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    const res = await this.agentsCollection.updateOne(
      { _id: objId },
      {
        $inc: {
          pending_earnings: earningsCents,
          total_earnings: earningsCents,
          total_deliveries: 1,
        },
        $set: {
          active_task_id: null,
          updated_at: new Date(),
        },
      }
    );
    return res.modifiedCount > 0;
  }

  async findNearbyAvailableRiders(
    longitude: number,
    latitude: number,
    maxDistanceMeters = 10000
  ): Promise<DeliveryAgent[]> {
    return this.agentsCollection
      .find({
        status: "approved",
        is_online: true,
        active_task_id: null,
        current_location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: maxDistanceMeters,
          },
        },
      })
      .toArray();
  }

  async adminListAgents(
    skip = 0,
    limit = 20,
    status?: RiderStatus
  ): Promise<{ agents: DeliveryAgent[]; total: number }> {
    const query: any = {};
    if (status) query.status = status;

    const [agents, total] = await Promise.all([
      this.agentsCollection.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.agentsCollection.countDocuments(query),
    ]);

    return { agents, total };
  }

  async updateAgentProfile(
    agentId: ObjectId | string,
    data: Partial<DeliveryAgent>
  ): Promise<boolean> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    const updateFields: any = { ...data, updated_at: new Date() };
    delete updateFields._id;
    delete updateFields.user_id;

    const res = await this.agentsCollection.updateOne(
      { _id: objId },
      { $set: updateFields }
    );
    return res.modifiedCount > 0;
  }

  async findAllAvailableRiders(city?: string, zone?: string): Promise<DeliveryAgent[]> {
    // 1. Fetch all approved agents. Do NOT filter out riders from the result set if city differs;
    // instead, prioritize zone matches at the top so Admin & Merchant can always assign available riders.
    let agents = await this.agentsCollection
      .find({ status: "approved" })
      .sort({ is_online: -1, rating: -1 })
      .toArray();

    if (agents.length === 0) {
      agents = await this.agentsCollection
        .find({ status: { $ne: "rejected" } })
        .sort({ is_online: -1, rating: -1 })
        .toArray();
    }

    // 2. Populate user information and evaluate zone matches
    try {
      const usersCol = getDb().collection("users");
      const userIds = agents.map((a) => (typeof a.user_id === "string" ? new ObjectId(a.user_id) : a.user_id));
      const users = await usersCol.find({ _id: { $in: userIds } }).toArray();
      const userMap = new Map(users.map((u) => [u._id.toString(), u]));

      const targetCity = (city || "").trim().toLowerCase();
      const targetZone = (zone || "").trim().toLowerCase();

      const populated: DeliveryAgent[] = agents.map((a) => {
        const u = userMap.get(a.user_id.toString());
        const riderCity = (a.service_city || "").toLowerCase();
        const riderZones = (a.delivery_zones || []).map((z: string) => (z || "").toLowerCase());

        const isZoneMatch = Boolean(
          (targetCity && (
            riderCity.includes(targetCity) ||
            targetCity.includes(riderCity) ||
            riderZones.some((z: string) => z.includes(targetCity) || targetCity.includes(z))
          )) ||
          (targetZone && (
            riderZones.some((z: string) => z.includes(targetZone) || targetZone.includes(z))
          ))
        );

        return {
          ...a,
          user_name: u ? `${u.first_name} ${u.last_name}`.trim() : "Delivery Rider",
          phone: u?.phone || a.phone || "",
          email: u?.email || a.email || "",
          delivery_zones: a.delivery_zones && a.delivery_zones.length > 0
            ? a.delivery_zones
            : ["Dhaka", "Gulshan", "Banani", "Uttara", "Dhanmondi"],
          service_city: a.service_city || "Dhaka",
          is_zone_match: isZoneMatch,
        };
      });

      // 3. Sort: zone matches first, then online status, then highest rating
      return populated.sort((a: any, b: any) => {
        if (a.is_zone_match && !b.is_zone_match) return -1;
        if (!a.is_zone_match && b.is_zone_match) return 1;
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        return (b.rating || 0) - (a.rating || 0);
      });
    } catch {
      return agents;
    }
  }

  async updateAgentStatus(agentId: ObjectId | string, status: RiderStatus): Promise<boolean> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    const res = await this.agentsCollection.updateOne(
      { _id: objId },
      { $set: { status, updated_at: new Date() } }
    );
    return res.modifiedCount > 0;
  }

  // TASK OPERATIONS
  async createTask(data: Partial<DeliveryTask>): Promise<DeliveryTask> {
    const now = new Date();
    const doc: DeliveryTask = {
      task_number: data.task_number || `DLV-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      sub_order_id: data.sub_order_id!,
      order_id: data.order_id!,
      seller_id: data.seller_id!,
      customer_id: data.customer_id!,
      delivery_agent_id: data.delivery_agent_id || null,
      status: data.status || "unassigned",
      pickup_address: data.pickup_address!,
      delivery_address: data.delivery_address!,
      estimated_pickup: null,
      estimated_delivery: null,
      actual_pickup: null,
      actual_delivery: null,
      rider_earnings: data.rider_earnings || 500, // $5.00 default base payout
      assignment_attempts: data.assignment_attempts || 0,
      failure_reason: null,
      created_at: now,
      updated_at: now,
    };

    const res = await this.tasksCollection.insertOne(doc);
    return { ...doc, _id: res.insertedId };
  }

  async findTaskById(taskId: ObjectId | string): Promise<DeliveryTask | null> {
    const objId = typeof taskId === "string" ? new ObjectId(taskId) : taskId;
    return this.tasksCollection.findOne({ _id: objId });
  }

  async findTaskBySubOrderId(subOrderId: ObjectId | string): Promise<DeliveryTask | null> {
    const objId = typeof subOrderId === "string" ? new ObjectId(subOrderId) : subOrderId;
    return this.tasksCollection.findOne({ sub_order_id: objId });
  }

  async findTasksByAgent(
    agentId: ObjectId | string,
    status?: DeliveryTaskStatus
  ): Promise<DeliveryTask[]> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    const query: any = { delivery_agent_id: objId };
    if (status) query.status = status;
    return this.tasksCollection.find(query).sort({ created_at: -1 }).toArray();
  }

  async assignRiderToTask(
    taskId: ObjectId | string,
    agentId: ObjectId | string
  ): Promise<boolean> {
    const taskObjId = typeof taskId === "string" ? new ObjectId(taskId) : taskId;
    const agentObjId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;

    const res = await this.tasksCollection.updateOne(
      { _id: taskObjId, status: { $in: ["unassigned", "assigned"] } },
      {
        $set: {
          delivery_agent_id: agentObjId,
          status: "assigned",
          updated_at: new Date(),
        },
        $inc: {
          assignment_attempts: 1,
        },
      }
    );
    return res.modifiedCount > 0;
  }

  async updateTaskStatus(
    taskId: ObjectId | string,
    newStatus: DeliveryTaskStatus,
    additionalUpdates: Partial<DeliveryTask> = {}
  ): Promise<boolean> {
    const taskObjId = typeof taskId === "string" ? new ObjectId(taskId) : taskId;
    const res = await this.tasksCollection.updateOne(
      { _id: taskObjId },
      {
        $set: {
          status: newStatus,
          ...additionalUpdates,
          updated_at: new Date(),
        },
      }
    );
    return res.modifiedCount > 0;
  }

  async adminListTasks(
    skip = 0,
    limit = 20,
    status?: DeliveryTaskStatus
  ): Promise<{ tasks: DeliveryTask[]; total: number }> {
    const query: any = {};
    if (status) query.status = status;

    const [tasks, total] = await Promise.all([
      this.tasksCollection.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.tasksCollection.countDocuments(query),
    ]);

    return { tasks, total };
  }

  async deductPendingEarnings(agentId: ObjectId | string, amountCents: number): Promise<boolean> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    const res = await this.agentsCollection.updateOne(
      { _id: objId },
      { $inc: { pending_earnings: -amountCents } }
    );
    return res.modifiedCount > 0;
  }

  async recordPayout(payoutRecord: any): Promise<any> {
    await getDb().collection("delivery_payouts").insertOne(payoutRecord);
    return payoutRecord;
  }

  async findPayoutsByAgentId(agentId: ObjectId | string): Promise<any[]> {
    const objId = typeof agentId === "string" ? new ObjectId(agentId) : agentId;
    return await getDb()
      .collection("delivery_payouts")
      .find({ agent_id: objId })
      .sort({ created_at: -1 })
      .toArray();
  }
}

export const deliveryRepository = new DeliveryRepository();
