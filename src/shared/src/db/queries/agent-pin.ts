import { eq, and, asc, sql } from "drizzle-orm";
import { agentPin } from "../schema";
import type { Database } from "../index";
import { batchAll } from "../batch";

export async function listPins(db: Database, workspaceId: string, userId: string) {
  return db
    .select()
    .from(agentPin)
    .where(and(eq(agentPin.workspaceId, workspaceId), eq(agentPin.userId, userId)))
    .orderBy(asc(agentPin.position));
}

export async function pinAgent(db: Database, data: { agentId: string; workspaceId: string; userId: string }) {
  const [maxRow] = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(${agentPin.position}), -1)` })
    .from(agentPin)
    .where(and(eq(agentPin.workspaceId, data.workspaceId), eq(agentPin.userId, data.userId)));
  const nextPos = (maxRow?.maxPos ?? -1) + 1;
  const rows = await db
    .insert(agentPin)
    .values({ ...data, position: nextPos })
    .onConflictDoNothing()
    .returning();
  return rows[0] ?? null;
}

export async function unpinAgent(db: Database, agentId: string, workspaceId: string, userId: string) {
  const rows = await db
    .delete(agentPin)
    .where(
      and(
        eq(agentPin.agentId, agentId),
        eq(agentPin.workspaceId, workspaceId),
        eq(agentPin.userId, userId),
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function reorderPins(
  db: Database,
  workspaceId: string,
  userId: string,
  orderedAgentIds: string[],
) {
  await batchAll(db, 
    orderedAgentIds.map((id, i) =>
      db
        .update(agentPin)
        .set({ position: i })
        .where(
          and(
            eq(agentPin.agentId, id),
            eq(agentPin.workspaceId, workspaceId),
            eq(agentPin.userId, userId),
          )
        )
    )
  );
}
