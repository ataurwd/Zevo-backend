import { Collection, ObjectId } from "mongodb";
import { getDb, isDbConnected } from "../../infrastructure/db/client";
import { AuditLogEntry } from "./audit.types";

export class AuditRepository {
  private get collection(): Collection<AuditLogEntry> {
    return getDb().collection<AuditLogEntry>("audit_logs");
  }

  async ensureIndexes(): Promise<void> {
    if (!isDbConnected()) return;
    try {
      await this.collection.createIndex({ created_at: -1 }, { background: true });
      await this.collection.createIndex({ actor_id: 1, created_at: -1 }, { background: true });
      await this.collection.createIndex({ action: 1 }, { background: true });
    } catch {
      // Ignore during initial test
    }
  }

  async create(log: Omit<AuditLogEntry, "_id">): Promise<AuditLogEntry> {
    if (!isDbConnected()) {
      return { ...log, _id: new ObjectId() };
    }
    try {
      const res = await this.collection.insertOne(log as any);
      return { ...log, _id: res.insertedId };
    } catch {
      return { ...log, _id: new ObjectId() };
    }
  }

  async queryLogs(
    filter: { action?: string; actor_id?: ObjectId },
    limit = 50,
    skip = 0
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const query: any = {};
    if (filter.action) query.action = filter.action;
    if (filter.actor_id) query.actor_id = filter.actor_id;

    const [logs, total] = await Promise.all([
      this.collection.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.collection.countDocuments(query),
    ]);

    return { logs, total };
  }
}

export const auditRepository = new AuditRepository();
