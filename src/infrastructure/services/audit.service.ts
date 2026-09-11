import { ObjectId } from "mongodb";
import { getDb } from "../db/client";
import { logger } from "../logger";

export interface AuditLogEntry {
  userId?: string | ObjectId;
  action: string;
  resourceType: string;
  resourceId?: string | ObjectId;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export class AuditService {
  public static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const db = getDb();
      await db.collection("audit_logs").insertOne({
        user_id: entry.userId ? new ObjectId(entry.userId) : null,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId ? String(entry.resourceId) : null,
        metadata: entry.metadata || {},
        ip: entry.ip || null,
        user_agent: entry.userAgent || null,
        created_at: new Date(),
      });
    } catch (error) {
      // Audit failure should not break user requests, but must be logged
      logger.error({ err: error, entry }, "Failed to persist audit log entry");
    }
  }
}
