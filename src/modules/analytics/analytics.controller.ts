import { Request, Response, NextFunction } from "express";
import { analyticsService, AnalyticsService } from "./analytics.service";
import { SellersRepository } from "../sellers/sellers.repository";

export class AnalyticsController {
  constructor(private service: AnalyticsService = analyticsService) {}

  getSellerAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

      const seller = await SellersRepository.findByUserId(userId);
      if (!seller || !seller._id) {
        return res.status(403).json({
          success: false,
          error: { message: "Seller profile required" },
        });
      }

      const analytics = await this.service.getSellerAnalytics(seller._id.toString(), days);

      return res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  };

  getAdminAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const analytics = await this.service.getAdminAnalytics(days);

      return res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  };

  getAdminBadges = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const badges = await this.service.getAdminBadgeCounts();

      return res.status(200).json({
        success: true,
        data: badges,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const analyticsController = new AnalyticsController();
