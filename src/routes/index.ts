import { Router } from "express";
import { healthRouter } from "../modules/health/health.router";

import { authRouter } from "../modules/auth/auth.router";
import { usersRouter } from "../modules/users/users.router";
import { sellersRouter } from "../modules/sellers/sellers.router";
import { storesRouter } from "../modules/stores/stores.router";
import { categoriesRouter } from "../modules/categories/categories.router";
import { productsRouter } from "../modules/products/products.router";

const router = Router();

// Infrastructure & Monitoring Routes
router.use("/health", healthRouter);

// Phase 2: Authentication & Identity
router.use("/auth", authRouter);

// Phase 3: User Profiles & Addresses
router.use("/users", usersRouter);

// Phase 4: Sellers & Stores
router.use("/sellers", sellersRouter);
router.use("/stores", storesRouter);

// Phase 5: Categories & Products
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);

export const apiRouter = router;
