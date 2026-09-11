import { Router } from "express";
import { InventoryController } from "./inventory.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  updateStockSchema,
  setThresholdSchema,
} from "./inventory.validator";

const router = Router();

// Seller inventory routes
router.get(
  "/seller/me",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(InventoryController.listSellerInventory)
);

router.get(
  "/seller/me/transactions",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(InventoryController.listTransactions)
);

router.get(
  "/seller/me/:sku",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(InventoryController.getBySku)
);

router.patch(
  "/seller/me/:sku",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  validate(updateStockSchema),
  asyncHandler(InventoryController.updateStock)
);

router.patch(
  "/seller/me/:sku/threshold",
  authenticate,
  authorize("SELLER", "ADMIN", "SUPER_ADMIN"),
  validate(setThresholdSchema),
  asyncHandler(InventoryController.setThreshold)
);

// Admin route
router.get(
  "/admin",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  asyncHandler(InventoryController.adminListAll)
);

export const inventoryRouter = router;
