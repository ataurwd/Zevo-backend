import { ObjectId } from "mongodb";
import { reviewsRepository, ReviewsRepository } from "./reviews.repository";
import { ProductsRepository } from "../products/products.repository";
import { OrderRepository } from "../orders/order.repository";
import { Review, CreateReviewDTO, ReplyReviewDTO } from "./reviews.types";

export class ReviewsService {
  constructor(private repo: ReviewsRepository = reviewsRepository) {}

  async createReview(
    userId: string,
    userName: string,
    dto: CreateReviewDTO
  ): Promise<Review> {
    const userObjId = new ObjectId(userId);
    const productObjId = new ObjectId(dto.product_id);
    const orderObjId = new ObjectId(dto.order_id);
    const subOrderObjId = new ObjectId(dto.sub_order_id);

    // 1. Check if already reviewed for this order
    const existing = await this.repo.findExistingUserReview(userObjId, productObjId, orderObjId);
    if (existing) {
      throw new Error("You have already reviewed this product for this order");
    }

    // 2. Validate eligibility: must be a delivered sub_order containing this product
    const subOrder = await this.repo.findDeliveredSubOrder(
      subOrderObjId,
      orderObjId,
      dto.product_id
    );

    if (!subOrder) {
      throw new Error("Only delivered orders containing this product can be reviewed");
    }

    const sellerObjId = new ObjectId(subOrder.seller_id);

    // 3. Create review
    const now = new Date();
    const review: Omit<Review, "_id"> = {
      user_id: userObjId,
      user_name: userName,
      product_id: productObjId,
      order_id: orderObjId,
      sub_order_id: subOrderObjId,
      seller_id: sellerObjId,
      rating: Math.max(1, Math.min(5, Math.round(dto.rating))),
      title: dto.title?.trim(),
      comment: dto.comment.trim(),
      images: dto.images || [],
      seller_reply: null,
      created_at: now,
      updated_at: now,
    };

    const savedReview = await this.repo.create(review);

    // 4. Atomically recalculate product rating stats
    const stats = await this.repo.calculateProductRatingStats(productObjId);
    await ProductsRepository.update(productObjId, {
      rating_average: stats.averageRating,
      rating_count: stats.totalCount,
    } as any);

    return savedReview;
  }

  async getProductReviews(
    productId: string,
    limit = 20,
    skip = 0
  ): Promise<{ reviews: Review[]; total: number }> {
    const productObjId = new ObjectId(productId);
    return this.repo.findByProduct(productObjId, limit, skip);
  }

  async replyToReview(
    reviewId: string,
    sellerId: string,
    dto: ReplyReviewDTO
  ): Promise<Review> {
    const revObjId = new ObjectId(reviewId);
    const sellerObjId = new ObjectId(sellerId);

    const review = await this.repo.findById(revObjId);
    if (!review) {
      throw new Error("Review not found");
    }

    if (!review.seller_id.equals(sellerObjId)) {
      throw new Error("Unauthorized to reply to another merchant's review");
    }

    const updated = await this.repo.addSellerReply(revObjId, dto.reply.trim(), sellerObjId);
    if (!updated) {
      throw new Error("Failed to add seller reply");
    }

    return updated;
  }

  async deleteReview(reviewId: string): Promise<boolean> {
    const revObjId = new ObjectId(reviewId);
    const review = await this.repo.findById(revObjId);
    if (!review) {
      throw new Error("Review not found");
    }

    const success = await this.repo.delete(revObjId);
    if (success) {
      const stats = await this.repo.calculateProductRatingStats(review.product_id);
      await ProductsRepository.update(review.product_id, {
        rating_average: stats.averageRating,
        rating_count: stats.totalCount,
      } as any);
    }

    return success;
  }
}

export const reviewsService = new ReviewsService();
