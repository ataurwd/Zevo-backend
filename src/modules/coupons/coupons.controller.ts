import { Request, Response, NextFunction } from "express";
import { couponsService, CouponsService } from "./coupons.service";
import { SellersRepository } from "../sellers/sellers.repository";

export class CouponsController {
  constructor(private service: CouponsService = couponsService) {}

  createCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;

      let sellerId: string | null = null;
      if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        const seller = await SellersRepository.findByUserId(userId);
        if (!seller || !seller._id) {
          return res.status(403).json({
            success: false,
            error: { message: "Only registered sellers can create coupons" },
          });
        }
        sellerId = seller._id.toString();
      }

      const coupon = await this.service.createCoupon(sellerId, req.body);

      return res.status(201).json({
        success: true,
        data: coupon,
      });
    } catch (error) {
      next(error);
    }
  };

  validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.validateCoupon(req.body);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getMyCoupons = async (req: Request, res: Response, next: NextFunction) => {
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

      const coupons = await this.service.getSellerCoupons(seller._id.toString());

      return res.status(200).json({
        success: true,
        data: coupons,
      });
    } catch (error) {
      next(error);
    }
  };

  toggleStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;
      const { id } = req.params;
      const { is_active } = req.body;

      const seller = await SellersRepository.findByUserId(userId);
      if (!seller || !seller._id) {
        return res.status(403).json({
          success: false,
          error: { message: "Seller profile required" },
        });
      }

      const updated = await this.service.toggleStatus(id, seller._id.toString(), Boolean(is_active));

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;
      const { id } = req.params;

      const seller = await SellersRepository.findByUserId(userId);
      if (!seller || !seller._id) {
        return res.status(403).json({
          success: false,
          error: { message: "Seller profile required" },
        });
      }

      const success = await this.service.deleteCoupon(id, seller._id.toString());

      return res.status(200).json({
        success,
        message: success ? "Coupon deleted" : "Coupon not found",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const couponsController = new CouponsController();
