import { Router } from "express";
import { UsersController } from "./users.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadAvatar } from "../../infrastructure/storage/upload";
import {
  updateProfileSchema,
  changeUserPasswordSchema,
  createAddressSchema,
  updateAddressSchema,
  adminCreateUserSchema,
  adminUpdateUserSchema,
} from "./users.validator";

const router = Router();

// All routes require authentication
router.use(authenticate);


// Admin User Management Routes (Placed before /me to prevent conflicts)
router.get("/admin", authorize("ADMIN", "SUPER_ADMIN"), asyncHandler(UsersController.adminListUsers));
router.post("/admin", authorize("ADMIN", "SUPER_ADMIN"), validate(adminCreateUserSchema), asyncHandler(UsersController.adminCreateUser));
router.patch("/admin/:id", authorize("ADMIN", "SUPER_ADMIN"), validate(adminUpdateUserSchema), asyncHandler(UsersController.adminUpdateUser));

// Profile
router.get("/me", asyncHandler(UsersController.getProfile));
router.patch("/me", validate(updateProfileSchema), asyncHandler(UsersController.updateProfile));
router.patch("/me/password", validate(changeUserPasswordSchema), asyncHandler(UsersController.changePassword));
router.post("/me/avatar", uploadAvatar.single("avatar"), asyncHandler(UsersController.uploadAvatar));

// Address book
router.get("/me/addresses", asyncHandler(UsersController.getAddresses));
router.post("/me/addresses", validate(createAddressSchema), asyncHandler(UsersController.createAddress));
router.get("/me/addresses/:id", asyncHandler(UsersController.getAddressById));
router.put("/me/addresses/:id", validate(updateAddressSchema), asyncHandler(UsersController.updateAddress));
router.patch("/me/addresses/:id/default", asyncHandler(UsersController.setDefaultAddress));
router.delete("/me/addresses/:id", asyncHandler(UsersController.deleteAddress));

export const usersRouter = router;
