import { Router } from "express";
import { ProductsController } from "./products.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  createProductSchema,
  updateProductSchema,
  addVariantSchema,
  rejectProductSchema,
} from "./products.validator";

const router = Router();

// Public routes
router.get("/", asyncHandler(ProductsController.browse));
router.get("/:id", asyncHandler(ProductsController.getPublicDetail));

// Seller product management routes
router.get(
  "/seller/me",
  authenticate,
  authorize("SELLER"),
  asyncHandler(ProductsController.listMine)
);

router.get(
  "/seller/:id",
  authenticate,
  authorize("SELLER"),
  asyncHandler(ProductsController.getMine)
);

router.post(
  "/seller",
  authenticate,
  authorize("SELLER"),
  validate(createProductSchema),
  asyncHandler(ProductsController.create)
);

router.patch(
  "/seller/:id",
  authenticate,
  authorize("SELLER"),
  validate(updateProductSchema),
  asyncHandler(ProductsController.update)
);

router.delete(
  "/seller/:id",
  authenticate,
  authorize("SELLER"),
  asyncHandler(ProductsController.delete)
);

router.post(
  "/seller/:id/variants",
  authenticate,
  authorize("SELLER"),
  validate(addVariantSchema),
  asyncHandler(ProductsController.addVariant)
);

router.patch(
  "/seller/:id/status",
  authenticate,
  authorize("SELLER"),
  asyncHandler(ProductsController.submitForReview)
);

// Admin Moderation routes
router.get(
  "/admin/all",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(ProductsController.adminList)
);

router.patch(
  "/admin/:id/approve",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(ProductsController.adminApprove)
);

router.patch(
  "/admin/:id/reject",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(rejectProductSchema),
  asyncHandler(ProductsController.adminReject)
);

export const productsRouter = router;
