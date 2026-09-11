import { Router } from "express";
import { healthRouter } from "../modules/health/health.router";

import { authRouter } from "../modules/auth/auth.router";
import { usersRouter } from "../modules/users/users.router";
import { sellersRouter } from "../modules/sellers/sellers.router";
import { storesRouter } from "../modules/stores/stores.router";
import { categoriesRouter } from "../modules/categories/categories.router";
import { productsRouter } from "../modules/products/products.router";
import { inventoryRouter } from "../modules/inventory/inventory.router";
import { cartRouter } from "../modules/cart/cart.router";
import { ordersRouter } from "../modules/orders/order.router";
import { paymentRouter } from "../modules/payments/payment.router";

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

// Phase 6: Inventory Management
router.use("/inventory", inventoryRouter);

// Phase 7: Redis-Primary Cart
router.use("/cart", cartRouter);

// Phase 8: Orders & Sub-Orders
router.use("/orders", ordersRouter);

// Phase 9: Payments & Webhooks
router.use("/payments", paymentRouter);

export const apiRouter = router;
