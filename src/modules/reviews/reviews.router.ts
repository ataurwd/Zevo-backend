import { Router } from "express";
import { reviewsController } from "./reviews.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";

const router = Router();

// Public review retrieval
router.get("/products/:productId", reviewsController.getProductReviews);

// Authenticated customer review creation
router.post("/", authenticate, reviewsController.createReview);

// Seller response to review
router.patch("/:id/reply", authenticate, authorize("SELLER", "ADMIN", "SUPER_ADMIN"), reviewsController.replyToReview);

// Admin review deletion
router.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), reviewsController.deleteReview);

export const reviewsRouter = router;
