import { Collection, ObjectId } from "mongodb";
import { getDb } from "../../infrastructure/db/client";
import { Review } from "./reviews.types";

export class ReviewsRepository {
  private get collection(): Collection<Review> {
    return getDb().collection<Review>("reviews");
  }

  async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex(
        { user_id: 1, product_id: 1, order_id: 1 },
        { unique: true, background: true }
      );
      await this.collection.createIndex(
        { product_id: 1, created_at: -1 },
        { background: true }
      );
      await this.collection.createIndex(
        { seller_id: 1, created_at: -1 },
        { background: true }
      );
    } catch {
      // Ignore during initial test if DB not connected
    }
  }

  async create(review: Omit<Review, "_id">): Promise<Review> {
    const res = await this.collection.insertOne(review as any);
    return { ...review, _id: res.insertedId };
  }

  async findById(id: string | ObjectId): Promise<Review | null> {
    const _id = typeof id === "string" ? new ObjectId(id) : id;
    return this.collection.findOne({ _id });
  }

  async findExistingUserReview(
    userId: ObjectId,
    productId: ObjectId,
    orderId: ObjectId
  ): Promise<Review | null> {
    return this.collection.findOne({
      user_id: userId,
      product_id: productId,
      order_id: orderId,
    });
  }

  async findDeliveredSubOrder(
    subOrderId: ObjectId,
    orderId: ObjectId,
    productId: string
  ): Promise<any | null> {
    const subOrdersCollection = getDb().collection("sub_orders");
    return subOrdersCollection.findOne({
      _id: subOrderId,
      order_id: orderId,
      status: "delivered",
      "items.product_id": productId,
    });
  }

  async findByProduct(
    productId: ObjectId,
    limit = 20,
    skip = 0
  ): Promise<{ reviews: Review[]; total: number }> {
    const query = { product_id: productId };
    const [reviews, total] = await Promise.all([
      this.collection.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(query),
    ]);
    return { reviews, total };
  }

  async calculateProductRatingStats(
    productId: ObjectId
  ): Promise<{ averageRating: number; totalCount: number }> {
    const result = await this.collection
      .aggregate<{ _id: null; avgRating: number; count: number }>([
        { $match: { product_id: productId } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    if (result.length === 0) {
      return { averageRating: 0, totalCount: 0 };
    }

    const avg = Math.round((result[0].avgRating || 0) * 10) / 10;
    return { averageRating: avg, totalCount: result[0].count || 0 };
  }

  async addSellerReply(
    reviewId: ObjectId,
    replyText: string,
    sellerId: ObjectId
  ): Promise<Review | null> {
    return this.collection.findOneAndUpdate(
      { _id: reviewId },
      {
        $set: {
          seller_reply: {
            text: replyText,
            replied_at: new Date(),
            seller_id: sellerId,
          },
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" }
    );
  }

  async delete(id: ObjectId): Promise<boolean> {
    const res = await this.collection.deleteOne({ _id: id });
    return res.deletedCount > 0;
  }
}

export const reviewsRepository = new ReviewsRepository();
