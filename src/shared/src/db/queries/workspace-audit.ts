import { eq, and, desc, lt } from "drizzle-orm";
import { workspaceAuditLog } from "../schema";
import type { Database } from "../index";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function logAction(
  db: Database,
  data: {
    workspaceId: string;
    /** Null for system-initiated actions. */
    actorId: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    changes?: string;
  }
) {
  const [row] = await db
    .insert(workspaceAuditLog)
    .values({
      workspaceId: data.workspaceId,
      actorId: data.actorId,
      action: data.action,
      targetType: data.targetType ?? null,
      targetId: data.targetId ?? null,
      changes: data.changes ?? null,
    })
    .returning();
  return row!;
}

export async function listAuditLog(
  db: Database,
  workspaceId: string,
  opts?: { action?: string; before?: string; limit?: number }
) {
  const limit = Math.min(opts?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const conditions = [eq(workspaceAuditLog.workspaceId, workspaceId)];
  if (opts?.action) conditions.push(eq(workspaceAuditLog.action, opts.action));
  if (opts?.before) conditions.push(lt(workspaceAuditLog.createdAt, opts.before));
  return db
    .select()
    .from(workspaceAuditLog)
    .where(and(...conditions))
    .orderBy(desc(workspaceAuditLog.createdAt))
    .limit(limit);
}
