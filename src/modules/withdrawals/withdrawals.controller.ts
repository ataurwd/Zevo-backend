import { Request, Response, NextFunction } from "express";
import { withdrawalsService, WithdrawalsService } from "./withdrawals.service";
import { SellersRepository } from "../sellers/sellers.repository";

export class WithdrawalsController {
  constructor(private service: WithdrawalsService = withdrawalsService) {}

  requestWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;

      const seller = await SellersRepository.findByUserId(userId);
      if (!seller || !seller._id) {
        return res.status(403).json({
          success: false,
          error: { message: "Seller profile required to request withdrawal" },
        });
      }

      const withdrawal = await this.service.requestWithdrawal(
        seller._id.toString(),
        seller.business_name || user.email,
        req.body,
        {
          email: user.email,
          ip: req.ip,
        }
      );

      return res.status(201).json({
        success: true,
        data: withdrawal,
      });
    } catch (error) {
      next(error);
    }
  };

  getMyWithdrawals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;

      const seller = await SellersRepository.findByUserId(userId);
      if (!seller || !seller._id) {
        return res.status(403).json({
          success: false,
          error: { message: "Seller profile required" },
        });
      }

      const withdrawals = await this.service.getSellerWithdrawals(seller._id.toString());

      return res.status(200).json({
        success: true,
        data: withdrawals,
      });
    } catch (error) {
      next(error);
    }
  };

  adminList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as any;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;

      const result = await this.service.listAll(status, limit, skip);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  adminApprove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const adminId = user._id || user.id;
      const { id } = req.params;

      const updated = await this.service.approveWithdrawal(id, adminId, user.email, req.ip);

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  adminReject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const adminId = user._id || user.id;
      const { id } = req.params;

      const updated = await this.service.rejectWithdrawal(id, adminId, user.email, req.body, req.ip);

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const withdrawalsController = new WithdrawalsController();
