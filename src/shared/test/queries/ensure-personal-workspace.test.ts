import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { createNodeClient, createNodeDb, applyMigrations } from "../../src/db/node";
import type { Database } from "../../src/db";
import { ensurePersonalWorkspace, listWorkspaces } from "../../src/db/queries/workspace";
import { user, member, workspace } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../web/migrations");

let db: Database;

beforeAll(async () => {
  const client = createNodeClient(":memory:");
  await applyMigrations(client, MIGRATIONS_DIR);
  db = createNodeDb(client);
}, 120_000);

describe("ensurePersonalWorkspace", () => {
  it("creates '<name>'s Workspace' with owner membership on first call", async () => {
    await db.insert(user).values({ id: "u_alice", email: "alice@example.com", name: "Alice" });
    const result = await ensurePersonalWorkspace(db, "u_alice", "Alice");
    expect(result.created).toBe(true);

    const [ws] = await db.select().from(workspace).where(eq(workspace.id, result.id));
    expect(ws.name).toBe("Alice's Workspace");

    const memberships = await db.select().from(member).where(eq(member.userId, "u_alice"));
    expect(memberships).toHaveLength(1);
    expect(memberships[0].role).toBe("owner");
    expect(memberships[0].workspaceId).toBe(result.id);
  });

  it("is idempotent — second call returns the same workspace without creating", async () => {
    const again = await ensurePersonalWorkspace(db, "u_alice", "Alice");
    expect(again.created).toBe(false);
    const memberships = await db.select().from(member).where(eq(member.userId, "u_alice"));
    expect(memberships).toHaveLength(1);
  });

  it("does not create when the user already has any membership", async () => {
    await db.insert(user).values({ id: "u_bob", email: "bob@example.com", name: "Bob" });
    const [ws] = await db
      .insert(workspace)
      .values({ name: "Existing", slug: "existing-team" })
      .returning();
    await db.insert(member).values({ workspaceId: ws.id, userId: "u_bob", role: "member" });

    const result = await ensurePersonalWorkspace(db, "u_bob", "Bob");
    expect(result.created).toBe(false);
    expect(result.id).toBe(ws.id);
  });

  it("falls back to 'My Workspace' for empty names and appears in listWorkspaces", async () => {
    await db.insert(user).values({ id: "u_anon", email: "anon@example.com", name: "" });
    const result = await ensurePersonalWorkspace(db, "u_anon", "  ");
    expect(result.created).toBe(true);
    const [ws] = await db.select().from(workspace).where(eq(workspace.id, result.id));
    expect(ws.name).toBe("My Workspace");

    const listed = await listWorkspaces(db, "u_anon");
    expect(listed.map((w) => w.id)).toContain(result.id);
  });
});
