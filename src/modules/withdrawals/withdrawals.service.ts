import { ObjectId } from "mongodb";
import { withdrawalsRepository, WithdrawalsRepository } from "./withdrawals.repository";
import { SellersRepository } from "../sellers/sellers.repository";
import { auditService } from "../audit/audit.service";
import {
  Withdrawal,
  WithdrawalStatus,
  RequestWithdrawalDTO,
  RejectWithdrawalDTO,
} from "./withdrawals.types";

export class WithdrawalsService {
  constructor(private repo: WithdrawalsRepository = withdrawalsRepository) {}

  async requestWithdrawal(
    sellerId: string,
    sellerName: string,
    dto: RequestWithdrawalDTO,
    actorInfo: { email: string; ip?: string }
  ): Promise<Withdrawal> {
    const sellerObjId = new ObjectId(sellerId);
    const amount = Math.round(dto.amount);

    if (amount < 2000) {
      throw new Error("Minimum withdrawal amount is $20.00");
    }

    const seller = await SellersRepository.findById(sellerObjId);
    if (!seller) {
      throw new Error("Seller not found");
    }

    if (seller.total_earnings < amount) {
      throw new Error(
        `Insufficient balance. Available: $${(seller.total_earnings / 100).toFixed(2)}, Requested: $${(amount / 100).toFixed(2)}`
      );
    }

    // Deduct available earnings atomically
    await SellersRepository.update(sellerObjId, {
      total_earnings: seller.total_earnings - amount,
    } as any);

    const now = new Date();
    const withdrawal: Omit<Withdrawal, "_id"> = {
      seller_id: sellerObjId,
      seller_name: sellerName,
      amount,
      status: "pending",
      notes: dto.notes?.trim() || null,
      admin_notes: null,
      processed_at: null,
      created_at: now,
      updated_at: now,
    };

    const saved = await this.repo.create(withdrawal);

    // Audit log
    await auditService.log({
      actor_id: sellerObjId,
      actor_email: actorInfo.email,
      actor_role: "SELLER",
      action: "payout.request",
      target_resource: "withdrawal",
      target_id: saved._id?.toString(),
      details: { amount, balanceRemaining: seller.total_earnings - amount },
      ip_address: actorInfo.ip,
    });

    return saved;
  }

  async getSellerWithdrawals(sellerId: string): Promise<Withdrawal[]> {
    const sellerObjId = new ObjectId(sellerId);
    return this.repo.findBySeller(sellerObjId);
  }

  async listAll(status?: WithdrawalStatus, limit = 20, skip = 0) {
    return this.repo.listAll(status, limit, skip);
  }

  async approveWithdrawal(
    id: string,
    adminId: string,
    adminEmail: string,
    adminIp?: string
  ): Promise<Withdrawal> {
    const withdrawalObjId = new ObjectId(id);
    const withdrawal = await this.repo.findById(withdrawalObjId);
    if (!withdrawal) {
      throw new Error("Withdrawal request not found");
    }

    if (withdrawal.status !== "pending") {
      throw new Error(`Cannot approve a withdrawal that is already ${withdrawal.status}`);
    }

    const updated = await this.repo.updateStatus(
      withdrawalObjId,
      "approved",
      "Disbursement authorized by administrator"
    );

    if (!updated) {
      throw new Error("Failed to update withdrawal status");
    }

    await auditService.log({
      actor_id: adminId,
      actor_email: adminEmail,
      actor_role: "ADMIN",
      action: "payout.approve",
      target_resource: "withdrawal",
      target_id: id,
      details: { amount: withdrawal.amount, sellerId: withdrawal.seller_id.toString() },
      ip_address: adminIp,
    });

    return updated;
  }

  async rejectWithdrawal(
    id: string,
    adminId: string,
    adminEmail: string,
    dto: RejectWithdrawalDTO,
    adminIp?: string
  ): Promise<Withdrawal> {
    const withdrawalObjId = new ObjectId(id);
    const withdrawal = await this.repo.findById(withdrawalObjId);
    if (!withdrawal) {
      throw new Error("Withdrawal request not found");
    }

    if (withdrawal.status !== "pending") {
      throw new Error(`Cannot reject a withdrawal that is already ${withdrawal.status}`);
    }

    // Refund amount back to seller's total_earnings
    const seller = await SellersRepository.findById(withdrawal.seller_id);
    if (seller) {
      await SellersRepository.update(withdrawal.seller_id, {
        total_earnings: (seller.total_earnings || 0) + withdrawal.amount,
      } as any);
    }

    const updated = await this.repo.updateStatus(
      withdrawalObjId,
      "rejected",
      dto.reason.trim()
    );

    if (!updated) {
      throw new Error("Failed to reject withdrawal");
    }

    await auditService.log({
      actor_id: adminId,
      actor_email: adminEmail,
      actor_role: "ADMIN",
      action: "payout.reject",
      target_resource: "withdrawal",
      target_id: id,
      details: { reason: dto.reason, amountRefunded: withdrawal.amount },
      ip_address: adminIp,
    });

    return updated;
  }
}

export const withdrawalsService = new WithdrawalsService();
