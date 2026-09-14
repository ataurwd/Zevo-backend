import { ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { logger } from "../../infrastructure/logger";
import { UserRole } from "../../shared/types/express";
import { UsersRepository } from "./users.repository";
import { AddressesRepository } from "./addresses.repository";
import {
  UpdateProfileDTO,
  ChangePasswordDTO,
  CreateAddressDTO,
  UpdateAddressDTO,
  AddressResponse,
  AddressDocument,
} from "./users.types";
import { UserResponse } from "../auth/auth.types";
import { NotFoundError, UnauthorizedError, ConflictError } from "../../shared/errors/errors";
import { hashPassword, comparePassword } from "../../shared/utils/password";
import { AuditService } from "../../infrastructure/services/audit.service";

export class UsersService {
  public static async getProfile(userId: string): Promise<UserResponse> {
    const user = await UsersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return UsersRepository.toResponse(user);
  }

  public static async updateProfile(
    userId: string,
    dto: UpdateProfileDTO
  ): Promise<UserResponse> {
    const updated = await UsersRepository.update(userId, {
      ...(dto.first_name !== undefined ? { first_name: dto.first_name } : {}),
      ...(dto.last_name !== undefined ? { last_name: dto.last_name } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
    });

    if (!updated) {
      throw new NotFoundError("User not found");
    }

    return UsersRepository.toResponse(updated);
  }

  public static async updateAvatar(
    userId: string,
    avatarUrl: string
  ): Promise<UserResponse> {
    const updated = await UsersRepository.update(userId, {
      avatar_url: avatarUrl,
    });

    if (!updated) {
      throw new NotFoundError("User not found");
    }

    return UsersRepository.toResponse(updated);
  }

  public static async changePassword(
    userId: string,
    dto: ChangePasswordDTO
  ): Promise<void> {
    const user = await UsersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isMatch = await comparePassword(dto.current_password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError("Incorrect current password");
    }

    const newHash = await hashPassword(dto.new_password);
    await UsersRepository.update(userId, {
      password_hash: newHash,
    });

    await AuditService.log({
      userId,
      action: "user.password_changed",
      resourceType: "user",
      resourceId: userId,
    });
  }

  // Address operations
  public static async getAddresses(userId: string): Promise<AddressResponse[]> {
    const docs = await AddressesRepository.findByUserId(userId);
    return docs.map(AddressesRepository.toResponse);
  }

  public static async getAddressById(userId: string, addressId: string): Promise<AddressResponse> {
    const doc = await AddressesRepository.findById(addressId, userId);
    if (!doc) {
      throw new NotFoundError("Address not found");
    }
    return AddressesRepository.toResponse(doc);
  }

  public static async createAddress(
    userId: string,
    dto: CreateAddressDTO
  ): Promise<AddressResponse> {
    const now = new Date();
    const doc: Omit<AddressDocument, "_id"> = {
      user_id: new ObjectId(userId),
      label: dto.label || null,
      recipient_name: dto.recipient_name,
      phone: dto.phone,
      line1: dto.line1,
      line2: dto.line2 || null,
      city: dto.city,
      state: dto.state,
      postal_code: dto.postal_code,
      country: dto.country,
      location: dto.location
        ? {
            type: "Point",
            coordinates: [dto.location.lon, dto.location.lat],
          }
        : null,
      is_default: Boolean(dto.is_default),
      created_at: now,
      updated_at: now,
    };

    const created = await AddressesRepository.create(doc);
    return AddressesRepository.toResponse(created);
  }

  public static async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDTO
  ): Promise<AddressResponse> {
    const updateData: Partial<AddressDocument> = {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.recipient_name !== undefined ? { recipient_name: dto.recipient_name } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.line1 !== undefined ? { line1: dto.line1 } : {}),
      ...(dto.line2 !== undefined ? { line2: dto.line2 } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.state !== undefined ? { state: dto.state } : {}),
      ...(dto.postal_code !== undefined ? { postal_code: dto.postal_code } : {}),
      ...(dto.country !== undefined ? { country: dto.country } : {}),
      ...(dto.is_default !== undefined ? { is_default: dto.is_default } : {}),
      ...(dto.location !== undefined
        ? {
            location: {
              type: "Point",
              coordinates: [dto.location.lon, dto.location.lat],
            },
          }
        : {}),
    };

    const updated = await AddressesRepository.update(addressId, userId, updateData);
    if (!updated) {
      throw new NotFoundError("Address not found");
    }

    return AddressesRepository.toResponse(updated);
  }

  public static async setDefaultAddress(
    userId: string,
    addressId: string
  ): Promise<AddressResponse> {
    const updated = await AddressesRepository.setDefault(addressId, userId);
    if (!updated) {
      throw new NotFoundError("Address not found");
    }
    return AddressesRepository.toResponse(updated);
  }

  public static async deleteAddress(userId: string, addressId: string): Promise<void> {
    const success = await AddressesRepository.delete(addressId, userId);
    if (!success) {
      throw new NotFoundError("Address not found");
    }
  }

  public static async adminListUsers(options: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: any[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    const skip = (page - 1) * limit;

    const { users, total } = await UsersRepository.adminListUsers({
      role: options.role,
      search: options.search,
      skip,
      limit,
    });

    const db = getDb();
    const userIds = users.map((u) => u._id);

    // Fetch order counts and delivery agent profiles
    let orderCountMap = new Map<string, number>();
    try {
      const ordersCol = db.collection("orders");
      const agentsCol = db.collection("delivery_agents");

      const [orderCounts, agents] = await Promise.all([
        ordersCol
          .aggregate([
            { $match: { customer_id: { $in: userIds } } },
            { $group: { _id: "$customer_id", count: { $sum: 1 } } },
          ])
          .toArray(),
        agentsCol.find({ user_id: { $in: userIds } }).toArray(),
      ]);

      orderCounts.forEach((oc: any) => {
        orderCountMap.set(oc._id.toString(), oc.count);
      });

      const agentMap = new Map(agents.map((a) => [a.user_id.toString(), a]));

      const mappedUsers = users.map((u) => {
        const uId = u._id.toString();
        const agent = agentMap.get(uId);
        const ordersCount = orderCountMap.get(uId) || (agent?.total_deliveries || 0);

        return {
          id: uId,
          name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || "User",
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
          role: (u.role as string) === "DELIVERY_AGENT" ? "RIDER" : u.role,
          original_role: u.role,
          phone: u.phone || "",
          status: u.is_active !== false ? "ACTIVE" : "SUSPENDED",
          is_active: u.is_active !== false,
          ordersCount,
          joined: u.created_at
            ? new Date(u.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })
            : "Recent",
          created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
          rider_profile: agent
            ? {
                vehicle_type: agent.vehicle_type,
                vehicle_number: agent.vehicle_number,
                license_number: agent.license_number,
                service_city: agent.service_city,
                delivery_zones: agent.delivery_zones,
                is_online: agent.is_online,
                rating: agent.rating,
              }
            : null,
        };
      });

      return {
        users: mappedUsers,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch {
      const mappedUsers = users.map((u) => ({
        id: u._id.toString(),
        name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || "User",
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        role: (u.role as string) === "DELIVERY_AGENT" ? "RIDER" : u.role,
        original_role: u.role,
        phone: u.phone || "",
        status: u.is_active !== false ? "ACTIVE" : "SUSPENDED",
        is_active: u.is_active !== false,
        ordersCount: 0,
        joined: u.created_at
          ? new Date(u.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            })
          : "Recent",
        created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
        rider_profile: null,
      }));
      return {
        users: mappedUsers,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }
  }

  public static async adminCreateUser(data: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    phone?: string;
    password?: string;
    service_city?: string;
    delivery_zones?: string[];
  }): Promise<any> {
    const existing = await UsersRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError("A user with this email address already exists");
    }

    const defaultPassword = data.password || "Nexora@2026!";
    const passwordHash = await hashPassword(defaultPassword);

    let assignedRole: UserRole = "CUSTOMER";
    const r = data.role.toUpperCase();
    if (r === "RIDER" || r === "DELIVERY_AGENT") assignedRole = "DELIVERY_AGENT";
    else if (r === "SELLER") assignedRole = "SELLER";
    else if (r === "ADMIN") assignedRole = "ADMIN";
    else if (r === "SUPER_ADMIN") assignedRole = "SUPER_ADMIN";

    const now = new Date();
    const newUser = await UsersRepository.create({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email.toLowerCase().trim(),
      password_hash: passwordHash,
      role: assignedRole,
      phone: data.phone || null,
      avatar_url: null,
      is_email_verified: true,
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    if (assignedRole === "DELIVERY_AGENT") {
      try {
        const { deliveryService } = await import("../delivery/delivery.service");
        await deliveryService.registerOrGetAgent(newUser._id.toString(), {
          vehicle_type: "motorcycle",
          vehicle_number: "NX-" + Math.floor(1000 + Math.random() * 9000),
          license_number: "LIC-" + Math.floor(100000 + Math.random() * 900000),
          service_city: data.service_city || "Dhaka",
          delivery_zones: data.delivery_zones || ["Dhaka", "Gulshan", "Banani", "Uttara", "Dhanmondi"],
          phone: data.phone,
        });
      } catch (err) {
        logger.warn({ err }, "Could not create delivery agent profile for admin-created user");
      }
    }

    return UsersRepository.toResponse(newUser);
  }

  public static async adminUpdateUser(
    userId: string,
    data: { role?: string; is_active?: boolean; phone?: string; first_name?: string; last_name?: string }
  ): Promise<any> {
    let roleToUpdate: UserRole | undefined;
    if (data.role) {
      const r = data.role.toUpperCase();
      if (r === "RIDER" || r === "DELIVERY_AGENT") roleToUpdate = "DELIVERY_AGENT";
      else if (r === "SELLER") roleToUpdate = "SELLER";
      else if (r === "ADMIN") roleToUpdate = "ADMIN";
      else if (r === "CUSTOMER") roleToUpdate = "CUSTOMER";
    }

    const updated = await UsersRepository.adminUpdateUser(userId, {
      role: roleToUpdate,
      is_active: data.is_active,
      phone: data.phone,
      first_name: data.first_name,
      last_name: data.last_name,
    });

    if (!updated) {
      throw new NotFoundError("User not found");
    }

    if (roleToUpdate === "DELIVERY_AGENT") {
      try {
        const { deliveryService } = await import("../delivery/delivery.service");
        await deliveryService.registerOrGetAgent(userId);
      } catch {}
    }

    return UsersRepository.toResponse(updated);
  }

}
