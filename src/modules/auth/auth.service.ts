import crypto from "crypto";
import { UsersRepository } from "../users/users.repository";
import { AuthRepository } from "./auth.repository";
import {
  RegisterDTO,
  LoginDTO,
  UserResponse,
  AuthTokens,
} from "./auth.types";
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from "../../shared/errors/errors";
import { hashPassword, comparePassword } from "../../shared/utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../shared/utils/jwt";
import { emailQueue } from "../../infrastructure/queue/queues";
import { AuditService } from "../../infrastructure/services/audit.service";
import { logger } from "../../infrastructure/logger";

export class AuthService {
  public static async register(dto: RegisterDTO, ip?: string): Promise<{ user: UserResponse }> {
    const existing = await UsersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError("An account with this email address already exists");
    }

    const hashedPassword = await hashPassword(dto.password);
    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto
      .createHash("sha256")
      .update(rawVerificationToken)
      .digest("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const now = new Date();
    const createdUser = await UsersRepository.create({
      email: dto.email,
      password_hash: hashedPassword,
      role: dto.role || "CUSTOMER",
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone || null,
      avatar_url: null,
      is_email_verified: false,
      email_verification_token: hashedVerificationToken,
      email_verification_expires: verificationExpires,
      password_reset_token: null,
      password_reset_expires: null,
      is_active: true,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    });

        if (createdUser.role === "SELLER") {
      try {
        const { SellersRepository } = await import("../sellers/sellers.repository");
        const { StoresRepository } = await import("../stores/stores.repository");
        const existingSeller = await SellersRepository.findByUserId(createdUser._id);
        if (!existingSeller) {
          const businessName =
            dto.business_name?.trim() || `${createdUser.first_name} ${createdUser.last_name}'s Store`;
          const createdSeller = await SellersRepository.create({
            user_id: createdUser._id,
            business_name: businessName,
            business_type: "individual",
            status: "pending",
            stripe_account_id: null,
            stripe_onboarding_complete: false,
            bank_verified: false,
            total_earnings: 0,
            total_commission_paid: 0,
            pending_balance: 0,
            created_at: now,
            updated_at: now,
          });
          logger.info({ userId: createdUser._id, businessName }, "Seller profile auto-provisioned with status pending");

          // Also auto-provision storefront in stores collection
          const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "store";
          const uniqueStoreSlug = `${baseSlug}-${createdSeller._id.toString().slice(-4)}`;
          await StoresRepository.create({
            seller_id: createdSeller._id,
            name: businessName,
            slug: uniqueStoreSlug,
            description: `Official storefront for ${businessName}`,
            logo_url: null,
            banner_url: null,
            contact_email: createdUser.email,
            contact_phone: createdUser.phone || null,
            address: {
              line1: "Main Office",
              city: "Dhaka",
              state: "Dhaka",
              postal_code: "1200",
              country: "Bangladesh",
            },
            location: null,
            rating_avg: 0,
            rating_count: 0,
            is_open: false,
            created_at: now,
            updated_at: now,
          });
          logger.info({ sellerId: createdSeller._id, storeSlug: uniqueStoreSlug }, "Store profile auto-provisioned with status pending");
        }
      } catch (err) {
        logger.warn({ err }, "Failed to auto-register seller profile");
      }
    }

    if (createdUser.role === "DELIVERY_AGENT") {
      try {
        const { deliveryService } = await import("../delivery/delivery.service");
        await deliveryService.registerOrGetAgent(createdUser._id.toString(), {
          vehicle_type: dto.vehicle_type || "motorcycle",
          vehicle_number: dto.vehicle_number || "NX-" + Math.floor(1000 + Math.random() * 9000),
          license_number: dto.license_number || "LIC-" + Math.floor(100000 + Math.random() * 900000),
          delivery_zones: dto.delivery_zones || (dto.service_city ? [dto.service_city] : ["Dhaka", "Gulshan", "Banani", "Uttara", "Dhanmondi"]),
          service_city: dto.service_city || "Dhaka",
          phone: dto.phone || undefined,
        });
      } catch (err) {
        logger.warn({ err }, "Failed to auto-register delivery agent profile");
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verificationUrl = `${frontendUrl}/verify-email?token=${rawVerificationToken}`;

    // Enqueue verification email job via BullMQ
    try {
      await emailQueue.add("email.verify", {
        to: createdUser.email,
        name: `${createdUser.first_name} ${createdUser.last_name}`,
        verificationUrl,
      });
    } catch (err) {
      logger.warn({ err }, "Could not enqueue verification email; user was created");
    }

    await AuditService.log({
      userId: createdUser._id,
      action: "user.registered",
      resourceType: "user",
      resourceId: createdUser._id,
      ip,
    });

    return { user: UsersRepository.toResponse(createdUser) };
  }

  public static async verifyEmail(token: string): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await UsersRepository.findByVerificationToken(hashedToken);

    if (!user) {
      throw new BadRequestError("Invalid or expired verification token");
    }

    const updatedUser = await UsersRepository.update(user._id, {
      is_email_verified: true,
      email_verification_token: null,
      email_verification_expires: null,
    });

    if (!updatedUser) {
      throw new BadRequestError("Failed to verify email");
    }

    const access = generateAccessToken({
      id: updatedUser._id.toString(),
      email: updatedUser.email,
      role: updatedUser.role,
    });
    const refresh = generateRefreshToken(updatedUser._id.toString());

    await AuditService.log({
      userId: updatedUser._id,
      action: "user.verified",
      resourceType: "user",
      resourceId: updatedUser._id,
    });

    return {
      user: UsersRepository.toResponse(updatedUser),
      tokens: {
        accessToken: access.token,
        refreshToken: refresh.token,
        refreshJti: refresh.jti,
      },
    };
  }

  public static async login(
    dto: LoginDTO,
    ip?: string,
    userAgent?: string
  ): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const user = await UsersRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!user.is_active) {
      throw new ForbiddenError("Your account has been deactivated. Please contact support.");
    }

    const isMatch = await comparePassword(dto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    await UsersRepository.update(user._id, {
      last_login_at: new Date(),
    });

    const access = generateAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    const refresh = generateRefreshToken(user._id.toString());

    await AuditService.log({
      userId: user._id,
      action: "user.login",
      resourceType: "user",
      resourceId: user._id,
      ip,
      userAgent,
    });

    return {
      user: UsersRepository.toResponse(user),
      tokens: {
        accessToken: access.token,
        refreshToken: refresh.token,
        refreshJti: refresh.jti,
      },
    };
  }

  public static async refresh(refreshToken: string): Promise<{ tokens: AuthTokens; user: UserResponse }> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const isBlacklisted = await AuthRepository.isTokenBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new UnauthorizedError("Refresh token has been revoked");
    }

    const user = await UsersRepository.findById(payload.sub);
    if (!user || !user.is_active) {
      throw new UnauthorizedError("User is no longer active");
    }

    // Blacklist old refresh token for dual-token rotation
    await AuthRepository.blacklistToken(payload.jti, 60 * 60 * 24 * 7);

    // Issue new pair
    const access = generateAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    const newRefresh = generateRefreshToken(user._id.toString());

    return {
      user: UsersRepository.toResponse(user),
      tokens: {
        accessToken: access.token,
        refreshToken: newRefresh.token,
        refreshJti: newRefresh.jti,
      },
    };
  }

  public static async logout(
    refreshToken?: string,
    userId?: string,
    ip?: string
  ): Promise<void> {
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await AuthRepository.blacklistToken(payload.jti);
      } catch {
        // Ignore invalid token on logout
      }
    }

    if (userId) {
      await AuditService.log({
        userId,
        action: "user.logout",
        resourceType: "user",
        resourceId: userId,
        ip,
      });
    }
  }

  public static async forgotPassword(email: string, ip?: string): Promise<void> {
    const user = await UsersRepository.findByEmail(email);
    if (!user) {
      // Do not reveal email existence to prevent user enumeration
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await UsersRepository.update(user._id, {
      password_reset_token: hashedToken,
      password_reset_expires: expires,
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await emailQueue.add("email.password_reset", {
        to: user.email,
        name: `${user.first_name} ${user.last_name}`,
        resetUrl,
      });
    } catch (err) {
      logger.warn({ err }, "Could not enqueue password reset email");
    }

    await AuditService.log({
      userId: user._id,
      action: "user.forgot_password_requested",
      resourceType: "user",
      resourceId: user._id,
      ip,
    });
  }

  public static async resetPassword(token: string, newPassword: string, ip?: string): Promise<void> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await UsersRepository.findByResetToken(hashedToken);

    if (!user) {
      throw new BadRequestError("Invalid or expired password reset token");
    }

    const hashedPassword = await hashPassword(newPassword);

    await UsersRepository.update(user._id, {
      password_hash: hashedPassword,
      password_reset_token: null,
      password_reset_expires: null,
    });

    // Invalidate existing sessions in Redis
    await AuthRepository.forceUserLogout(user._id.toString());

    await AuditService.log({
      userId: user._id,
      action: "user.password_changed",
      resourceType: "user",
      resourceId: user._id,
      ip,
    });
  }
}
