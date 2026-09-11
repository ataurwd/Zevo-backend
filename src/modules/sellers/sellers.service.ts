import crypto from "crypto";
import { ObjectId } from "mongodb";
import { SellersRepository } from "./sellers.repository";
import { UsersRepository } from "../users/users.repository";
import {
  OnboardSellerDTO,
  SellerResponse,
  SellerStatus,
} from "./sellers.types";
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "../../shared/errors/errors";
import { AuditService } from "../../infrastructure/services/audit.service";
import { emailQueue } from "../../infrastructure/queue/queues";
import { logger } from "../../infrastructure/logger";

export class SellersService {
  public static async startOnboarding(
    userId: string,
    dto: OnboardSellerDTO
  ): Promise<{ seller: SellerResponse; onboarding_url: string }> {
    const existing = await SellersRepository.findByUserId(userId);
    if (existing) {
      throw new ConflictError("Seller profile already initialized for this account");
    }

    // Mock Stripe Connect generation for dev/test environments
    const mockAccountId = `acct_mock_${crypto.randomBytes(8).toString("hex")}`;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const onboardingUrl = `${frontendUrl}/seller/onboard?account_id=${mockAccountId}`;

    const now = new Date();
    const created = await SellersRepository.create({
      user_id: new ObjectId(userId),
      stripe_account_id: mockAccountId,
      stripe_onboarding_complete: false,
      status: "pending",
      rejection_reason: null,
      approved_by: null,
      approved_at: null,
      business_name: dto.business_name,
      business_type: dto.business_type,
      tax_id: dto.tax_id || null,
      bank_verified: false,
      total_earnings: 0,
      total_commission_paid: 0,
      pending_balance: 0,
      created_at: now,
      updated_at: now,
    });

    // Ensure user role is SELLER
    await UsersRepository.update(userId, { role: "SELLER" });

    await AuditService.log({
      userId,
      action: "seller.onboarding_started",
      resourceType: "seller",
      resourceId: created._id,
    });

    return {
      seller: SellersRepository.toResponse(created),
      onboarding_url: onboardingUrl,
    };
  }

  public static async getProfile(userId: string): Promise<SellerResponse> {
    const seller = await SellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundError("Seller profile not found. Please complete onboarding first.");
    }
    return SellersRepository.toResponse(seller);
  }

  public static async getStripeStatus(
    userId: string
  ): Promise<{ complete: boolean; account_id: string | null }> {
    const seller = await SellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundError("Seller profile not found");
    }
    return {
      complete: seller.stripe_onboarding_complete,
      account_id: seller.stripe_account_id,
    };
  }

  public static async simulateOnboardingCompletion(
    userId: string
  ): Promise<SellerResponse> {
    const seller = await SellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundError("Seller profile not found");
    }

    const updated = await SellersRepository.update(seller._id, {
      stripe_onboarding_complete: true,
      bank_verified: true,
    });

    if (!updated) {
      throw new BadRequestError("Failed updating onboarding state");
    }

    return SellersRepository.toResponse(updated);
  }

  public static async refreshOnboardingLink(
    userId: string
  ): Promise<{ onboarding_url: string }> {
    const seller = await SellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundError("Seller profile not found");
    }
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const onboardingUrl = `${frontendUrl}/seller/onboard?account_id=${seller.stripe_account_id}`;
    return { onboarding_url: onboardingUrl };
  }

  // Admin Actions
  public static async adminListSellers(status?: SellerStatus): Promise<SellerResponse[]> {
    const list = await SellersRepository.listByStatus(status);
    return list.map(SellersRepository.toResponse);
  }

  public static async adminApproveSeller(
    sellerId: string,
    adminUserId: string
  ): Promise<SellerResponse> {
    const seller = await SellersRepository.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    const updated = await SellersRepository.update(sellerId, {
      status: "approved",
      approved_by: new ObjectId(adminUserId),
      approved_at: new Date(),
      rejection_reason: null,
    });

    if (!updated) {
      throw new BadRequestError("Failed approving seller");
    }

    // Lookup user to enqueue email notification
    const user = await UsersRepository.findById(seller.user_id);
    if (user) {
      try {
        await emailQueue.add("email.seller_approved", {
          to: user.email,
          sellerName: seller.business_name,
          dashboardUrl: "http://localhost:3000/seller/dashboard",
        });
      } catch (err) {
        logger.warn({ err }, "Could not enqueue seller approved email");
      }
    }

    await AuditService.log({
      userId: adminUserId,
      action: "seller.approved",
      resourceType: "seller",
      resourceId: sellerId,
    });

    return SellersRepository.toResponse(updated);
  }

  public static async adminRejectSeller(
    sellerId: string,
    adminUserId: string,
    reason: string
  ): Promise<SellerResponse> {
    const seller = await SellersRepository.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    const updated = await SellersRepository.update(sellerId, {
      status: "rejected",
      rejection_reason: reason,
    });

    if (!updated) {
      throw new BadRequestError("Failed rejecting seller");
    }

    await AuditService.log({
      userId: adminUserId,
      action: "seller.rejected",
      resourceType: "seller",
      resourceId: sellerId,
      metadata: { reason },
    });

    return SellersRepository.toResponse(updated);
  }
}
