import { eq, and, asc } from "drizzle-orm";
import { workspace, member } from "../schema";
import type { Database } from "../index";
import { generateWorkspaceSlug, slugSuffix } from "../../utils/slug";
import { isUniqueConstraintError } from "../../utils/db-errors";

export async function getWorkspace(db: Database, id: string, userId: string) {
  const rows = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      onboarded: workspace.onboarded,
      plan: workspace.plan,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    })
    .from(workspace)
    .innerJoin(member, eq(member.workspaceId, workspace.id))
    .where(and(eq(workspace.id, id), eq(member.userId, userId)));
  return rows[0] ?? null;
}

/** Plan lookup by workspace id — for quota checks on already-authorized routes. */
export async function getWorkspacePlan(db: Database, id: string): Promise<string | null> {
  const rows = await db
    .select({ plan: workspace.plan })
    .from(workspace)
    .where(eq(workspace.id, id));
  return rows[0]?.plan ?? null;
}

export async function getWorkspaceBySlug(db: Database, slug: string) {
  const rows = await db.select().from(workspace).where(eq(workspace.slug, slug));
  return rows[0] ?? null;
}

export async function listWorkspaces(db: Database, userId: string) {
  return db
    .select({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      onboarded: workspace.onboarded,
      plan: workspace.plan,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    })
    .from(workspace)
    .innerJoin(member, eq(member.workspaceId, workspace.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(workspace.createdAt));
}

export async function createWorkspace(
  db: Database,
  data: { name: string; slug: string }
) {
  const rows = await db
    .insert(workspace)
    .values({ name: data.name, slug: data.slug })
    .returning();
  return rows[0]!;
}

export async function updateWorkspace(db: Database, id: string, data: { name?: string; slug?: string }) {
  const rows = await db
    .update(workspace)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(workspace.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function markOnboarded(db: Database, id: string) {
  await db
    .update(workspace)
    .set({ onboarded: 1, updatedAt: new Date().toISOString() })
    .where(eq(workspace.id, id));
}

export async function deleteWorkspace(db: Database, id: string) {
  const rows = await db.delete(workspace).where(eq(workspace.id, id)).returning();
  return rows[0] ?? null;
}

/**
 * Auto-provisioning (plans/saas-completion.md P2): every user always has at
 * least one workspace they own. Called from the auth user-create hook for new
 * signups and lazily from the workspace list route for pre-existing users
 * (DECISIONS.md #6). Returns the user's first workspace, creating
 * "<name>'s Workspace" + owner membership when none exists. Slug collisions
 * retry with random suffixes, mirroring POST /api/workspaces.
 */
export async function ensurePersonalWorkspace(
  db: Database,
  userId: string,
  displayName: string,
): Promise<{ id: string; slug: string; created: boolean }> {
  const existing = await db
    .select({ id: workspace.id, slug: workspace.slug })
    .from(member)
    .innerJoin(workspace, eq(member.workspaceId, workspace.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(1);
  if (existing[0]) return { ...existing[0], created: false };

  const trimmed = displayName.trim();
  const name = trimmed ? `${trimmed}'s Workspace` : "My Workspace";
  const base = generateWorkspaceSlug();
  const suffixLengths = [4, 4, 8, 8, 16];
  let candidate = base;
  for (let attempt = 0; ; attempt++) {
    try {
      const ws = await createWorkspace(db, { name, slug: candidate });
      await db.insert(member).values({ workspaceId: ws.id, userId, role: "owner" });
      return { id: ws.id, slug: ws.slug, created: true };
    } catch (err) {
      if (!isUniqueConstraintError(err) || attempt >= suffixLengths.length) throw err;
      candidate = `${base}-${slugSuffix(suffixLengths[attempt])}`;
    }
  }
}
