import { Router } from "express";
import { HealthController } from "./health.controller";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = Router();

router.get("/live", HealthController.live);
router.get("/ready", asyncHandler(HealthController.ready));

export const healthRouter = router;
