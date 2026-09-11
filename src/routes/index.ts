import { Router } from "express";
import { healthRouter } from "../modules/health/health.router";

import { authRouter } from "../modules/auth/auth.router";
import { usersRouter } from "../modules/users/users.router";

const router = Router();

// Infrastructure & Monitoring Routes
router.use("/health", healthRouter);

// Authentication & Identity
router.use("/auth", authRouter);

// User Profiles & Addresses
router.use("/users", usersRouter);
// router.use("/products", productsRouter);
// router.use("/orders", ordersRouter);
// router.use("/cart", cartRouter);

export const apiRouter = router;
