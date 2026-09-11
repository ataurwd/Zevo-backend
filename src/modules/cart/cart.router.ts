import { Router } from "express";
import { CartController } from "./cart.controller";
import { authenticate, optionalAuthenticate } from "../../shared/middleware/authenticate";
import { validate } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  addItemSchema,
  updateQuantitySchema,
  applyCouponSchema,
  mergeCartSchema,
} from "./cart.validator";

const router = Router();

router.get(
  "/",
  optionalAuthenticate,
  asyncHandler(CartController.getCart)
);

router.post(
  "/items",
  optionalAuthenticate,
  validate(addItemSchema),
  asyncHandler(CartController.addItem)
);

router.patch(
  "/items/:variantId",
  optionalAuthenticate,
  validate(updateQuantitySchema),
  asyncHandler(CartController.updateQuantity)
);

router.delete(
  "/items/:variantId",
  optionalAuthenticate,
  asyncHandler(CartController.removeItem)
);

router.delete(
  "/",
  optionalAuthenticate,
  asyncHandler(CartController.clearCart)
);

router.post(
  "/merge",
  authenticate,
  validate(mergeCartSchema),
  asyncHandler(CartController.mergeCart)
);

router.post(
  "/validate",
  optionalAuthenticate,
  asyncHandler(CartController.validateCart)
);

router.post(
  "/apply-coupon",
  optionalAuthenticate,
  validate(applyCouponSchema),
  asyncHandler(CartController.applyCoupon)
);

router.delete(
  "/coupon",
  optionalAuthenticate,
  asyncHandler(CartController.removeCoupon)
);

export const cartRouter = router;
