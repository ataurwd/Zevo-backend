import { Router } from "express";
import { auditController } from "./audit.controller";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";

const router = Router();

router.use(authenticate);

// Admin audit log query
router.get("/admin/logs", authorize("ADMIN", "SUPER_ADMIN"), auditController.adminListLogs);

export const auditRouter = router;
