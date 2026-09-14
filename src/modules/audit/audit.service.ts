import { ObjectId } from "mongodb";
import { auditRepository, AuditRepository } from "./audit.repository";
import { AuditLogEntry, AuditAction } from "./audit.types";
import { logger } from "../../infrastructure/logger";

export class AuditService {
  constructor(private repo: AuditRepository = auditRepository) {}

  async log(data: {
    actor_id: string | ObjectId;
    actor_email: string;
    actor_role: string;
    action: AuditAction | string;
    target_resource: string;
    target_id?: string | null;
    details?: Record<string, any>;
    ip_address?: string | null;
  }): Promise<AuditLogEntry> {
    try {
      const entry: Omit<AuditLogEntry, "_id"> = {
        actor_id: typeof data.actor_id === "string" ? new ObjectId(data.actor_id) : data.actor_id,
        actor_email: data.actor_email,
        actor_role: data.actor_role,
        action: data.action,
        target_resource: data.target_resource,
        target_id: data.target_id || null,
        details: data.details || {},
        ip_address: data.ip_address || null,
        created_at: new Date(),
      };

      return await this.repo.create(entry);
    } catch (err) {
      logger.warn({ err }, "Failed to record audit log entry (database may be offline)");
      return {
        _id: new ObjectId(),
        actor_id: typeof data.actor_id === "string" ? new ObjectId(data.actor_id) : data.actor_id,
        actor_email: data.actor_email,
        actor_role: data.actor_role,
        action: data.action,
        target_resource: data.target_resource,
        target_id: data.target_id || null,
        details: data.details || {},
        ip_address: data.ip_address || null,
        created_at: new Date(),
      } as AuditLogEntry;
    }
  }

  async getLogs(filter: { action?: string; actor_id?: string }, limit = 50, skip = 0) {
    const queryFilter: any = {};
    if (filter.action) queryFilter.action = filter.action;
    if (filter.actor_id) queryFilter.actor_id = new ObjectId(filter.actor_id);

    return this.repo.queryLogs(queryFilter, limit, skip);
  }
}

export const auditService = new AuditService();
