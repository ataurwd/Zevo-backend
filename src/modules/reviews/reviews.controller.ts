import { Request, Response, NextFunction } from "express";
import { reviewsService, ReviewsService } from "./reviews.service";
import { SellersRepository } from "../sellers/sellers.repository";

export class ReviewsController {
  constructor(private service: ReviewsService = reviewsService) {}

  createReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;
      const userName = user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.email;

      const review = await this.service.createReview(userId, userName, req.body);

      return res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error) {
      next(error);
    }
  };

  getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;

      const result = await this.service.getProductReviews(productId, limit, skip);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  replyToReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user._id || user.id;
      const { id } = req.params;

      const seller = await SellersRepository.findByUserId(userId);
      if (!seller || !seller._id) {
        return res.status(403).json({
          success: false,
          error: { message: "Only registered sellers can reply to reviews" },
        });
      }

      const updated = await this.service.replyToReview(id, seller._id.toString(), req.body);

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const success = await this.service.deleteReview(id);

      return res.status(200).json({
        success,
        message: success ? "Review deleted" : "Review not found",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const reviewsController = new ReviewsController();
