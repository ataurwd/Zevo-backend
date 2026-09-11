import { Router } from "express";
import { StoresController } from "./stores.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadAvatar } from "../../infrastructure/storage/upload";
import { createStoreSchema, updateStoreSchema } from "./stores.validator";

const router = Router();

// Public routes
router.get("/", asyncHandler(StoresController.list));
router.get("/:slug", asyncHandler(StoresController.getBySlug));

// Seller routes
router.post(
  "/",
  authenticate,
  authorize("SELLER"),
  validate(createStoreSchema),
  asyncHandler(StoresController.create)
);

router.get("/seller/me", authenticate, authorize("SELLER"), asyncHandler(StoresController.getMine));
router.patch(
  "/seller/me",
  authenticate,
  authorize("SELLER"),
  validate(updateStoreSchema),
  asyncHandler(StoresController.updateMine)
);

router.post(
  "/seller/me/logo",
  authenticate,
  authorize("SELLER"),
  uploadAvatar.single("logo"),
  asyncHandler(StoresController.uploadLogo)
);

router.post(
  "/seller/me/banner",
  authenticate,
  authorize("SELLER"),
  uploadAvatar.single("banner"),
  asyncHandler(StoresController.uploadBanner)
);

export const storesRouter = router;
