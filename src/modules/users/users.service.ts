import { ObjectId } from "mongodb";
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
import { NotFoundError, UnauthorizedError } from "../../shared/errors/errors";
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
}
