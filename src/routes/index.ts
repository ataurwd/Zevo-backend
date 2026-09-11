import { Router } from "express";
import { healthRouter } from "../modules/health/health.router";

const router = Router();

// Infrastructure & Monitoring Routes
router.use("/health", healthRouter);

// Application routes will be registered here as phases complete:
// router.use("/auth", authRouter);
// router.use("/users", usersRouter);
// router.use("/products", productsRouter);
// router.use("/orders", ordersRouter);
// router.use("/cart", cartRouter);

export const apiRouter = router;
