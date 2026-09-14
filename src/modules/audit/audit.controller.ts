import { Request, Response, NextFunction } from "express";
import { auditService, AuditService } from "./audit.service";

export class AuditController {
  constructor(private service: AuditService = auditService) {}

  adminListLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const action = req.query.action as string | undefined;
      const actor_id = req.query.actor_id as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;

      const result = await this.service.getLogs({ action, actor_id }, limit, skip);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const auditController = new AuditController();
