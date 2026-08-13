import { eq, and, asc } from "drizzle-orm";
import { agentSidebarOrder } from "../schema";
import type { Database } from "../index";
import { batchAll } from "../batch";

export async function listOrder(db: Database, workspaceId: string, userId: string) {
  return db
    .select()
    .from(agentSidebarOrder)
    .where(and(eq(agentSidebarOrder.workspaceId, workspaceId), eq(agentSidebarOrder.userId, userId)))
    .orderBy(asc(agentSidebarOrder.position));
}

export async function reorder(
  db: Database,
  workspaceId: string,
  userId: string,
  orderedAgentIds: string[],
) {
  await batchAll(db, [
    db
      .delete(agentSidebarOrder)
      .where(
        and(
          eq(agentSidebarOrder.workspaceId, workspaceId),
          eq(agentSidebarOrder.userId, userId),
        )
      ),
    ...orderedAgentIds.map((agentId, i) =>
      db.insert(agentSidebarOrder).values({
        agentId,
        workspaceId,
        userId,
        position: i,
      })
    ),
  ]);
}
