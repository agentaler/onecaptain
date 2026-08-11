import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { count, eq } from "drizzle-orm";
import {
  applyPgMigrations,
  pgSchema,
  runBatch,
  type PgAppDatabase,
} from "../src/db/pg";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations-pg");

// PGlite's drizzle flavor shares the PgDatabase query interface with
// node-postgres, so the production types are exercised against a real
// Postgres engine without a server.
let db: PgAppDatabase;

// WASM engine boot + a 64-table baseline replay are slow on loaded CI
// runners (every package tests in parallel there) — well past vitest's 5s
// default.
const SLOW = 120_000;

beforeAll(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema: pgSchema }) as unknown as PgAppDatabase;
}, SLOW);

describe("applyPgMigrations", () => {
  it("applies the baseline to an empty database", { timeout: SLOW }, async () => {
    const ran = await applyPgMigrations(db, MIGRATIONS_DIR);
    expect(ran.length).toBeGreaterThan(0);
  });

  it("is a no-op on the second run", async () => {
    const ran = await applyPgMigrations(db, MIGRATIONS_DIR);
    expect(ran).toEqual([]);
  });
});

describe("schema queries", () => {
  const { user, workspace, member, workspaceAuditLog, agent } = pgSchema;

  it("inserts and reads core tenancy rows", async () => {
    const [u] = await db
      .insert(user)
      .values({ email: "owner@example.com", name: "Owner" })
      .returning();
    const [ws] = await db
      .insert(workspace)
      .values({ name: "Acme", slug: "acme" })
      .returning();
    await db.insert(member).values({ workspaceId: ws.id, userId: u.id, role: "owner" });

    const members = await db
      .select({ email: user.email, role: member.role })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.workspaceId, ws.id));
    expect(members).toEqual([{ email: "owner@example.com", role: "owner" }]);
  });

  it("boolean columns round-trip as real booleans", async () => {
    const [bot] = await db
      .insert(user)
      .values({ email: "bot@example.com", name: "Bot", isBot: true })
      .returning();
    expect(bot.isBot).toBe(true);
    const [fetched] = await db.select().from(user).where(eq(user.id, bot.id));
    expect(fetched.isBot).toBe(true);
  });

  it("audit log rows survive without FK enforcement to tenants", async () => {
    await db.insert(workspaceAuditLog).values({
      workspaceId: "gone-workspace",
      actorId: "gone-user",
      action: "workspace.deleted",
      changes: "{}",
    });
    const [row] = await db
      .select({ n: count(workspaceAuditLog.id) })
      .from(workspaceAuditLog)
      .where(eq(workspaceAuditLog.workspaceId, "gone-workspace"));
    expect(row.n).toBe(1);
  });

  it("agents are workspace-scoped", async () => {
    const [ws] = await db
      .select()
      .from(workspace)
      .where(eq(workspace.name, "Acme"));
    await db.insert(agent).values({
      id: "agent-1",
      workspaceId: ws.id,
      name: "Captain",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const rows = await db.select().from(agent).where(eq(agent.workspaceId, ws.id));
    expect(rows.map((r) => r.name)).toEqual(["Captain"]);
  });
});

describe("runBatch", () => {
  const { user } = pgSchema;

  it("returns per-statement results in order", async () => {
    const results = await runBatch(db, (tx) => [
      tx.insert(user).values({ email: "b1@example.com", name: "B1" }).returning(),
      tx.insert(user).values({ email: "b2@example.com", name: "B2" }).returning(),
      tx.select().from(user).where(eq(user.email, "b1@example.com")),
    ]);
    expect(results).toHaveLength(3);
    expect((results[0] as Array<{ email: string }>)[0].email).toBe("b1@example.com");
    expect((results[2] as Array<{ email: string }>)[0].email).toBe("b1@example.com");
  });

  it("rolls back atomically when a statement fails", async () => {
    await expect(
      runBatch(db, (tx) => [
        tx.insert(user).values({ email: "atomic@example.com", name: "A" }).returning(),
        // duplicate email violates the unique constraint → whole batch aborts
        tx.insert(user).values({ email: "atomic@example.com", name: "A2" }).returning(),
      ]),
    ).rejects.toThrow();
    const rows = await db.select().from(user).where(eq(user.email, "atomic@example.com"));
    expect(rows).toEqual([]);
  });
});
