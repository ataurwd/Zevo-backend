import { Router } from "express";
import { CategoriesController } from "./categories.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { createCategorySchema, updateCategorySchema } from "./categories.validator";

const router = Router();

// Public routes
router.get("/", asyncHandler(CategoriesController.getTree));
router.get("/:slug", asyncHandler(CategoriesController.getBySlug));

// Admin management routes
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(createCategorySchema),
  asyncHandler(CategoriesController.create)
);

router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(updateCategorySchema),
  asyncHandler(CategoriesController.update)
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(CategoriesController.delete)
);

export const categoriesRouter = router;
