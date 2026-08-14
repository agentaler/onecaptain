import { beforeAll, describe, expect, it } from "vitest";
import { resolve, join } from "node:path";
import { mkdtempSync, readdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { eq, sql } from "drizzle-orm";
import { createNodeClient, createNodeDb, applyMigrations } from "../../src/db/node";
import type { Database } from "../../src/db";
import { member, user, workspace } from "../../src/db/schema";
import { communityBotBinding } from "../../src/db/community-machine-schema";

/**
 * Migration 0091 backfills `community_bot_binding.workspace_id` from the bot
 * owner's oldest workspace membership. A backfill is the kind of statement that
 * is never exercised by the app afterwards — it runs once, against rows the
 * test suite normally creates *after* migrating — so a wrong column name or
 * join can sit in it indefinitely. (`user` is quoted and its owner column is
 * camelCase while `member` is snake_case; the first draft of this migration got
 * that wrong.)
 *
 * So this suite migrates to the revision BEFORE 0091, writes the pre-migration
 * rows, then applies 0091 and asserts what it did.
 */
const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../web/migrations");

/**
 * `applyMigrations` has no "stop at" option and does not need one — so stage a
 * directory holding only the migrations up to `last` and point it there. The
 * shared `d1_migrations` bookkeeping then makes the second, full-directory call
 * apply exactly the remainder.
 */
function migrationsThrough(last: string): string {
  const dir = mkdtempSync(join(tmpdir(), "oc-migrations-"));
  for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    if (f > last) break;
    copyFileSync(join(MIGRATIONS_DIR, f), join(dir, f));
  }
  return dir;
}

let db: Database;

const iso = (d: string) => new Date(d).toISOString();

beforeAll(async () => {
  const client = createNodeClient(":memory:");
  await applyMigrations(client, migrationsThrough("0090_bot_binding_optional_machine.sql"));
  db = createNodeDb(client);

  const [owner] = await db
    .insert(user)
    .values({
      id: "u_owner",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: false,
      createdAt: iso("2026-01-01"),
      updatedAt: iso("2026-01-01"),
    })
    .returning();

  // Two workspaces: the backfill must pick the OLDER membership, not whichever
  // row the scan happens to reach first.
  const [older] = await db
    .insert(workspace)
    .values({ name: "Personal", slug: "personal" })
    .returning();
  const [newer] = await db
    .insert(workspace)
    .values({ name: "Team", slug: "team" })
    .returning();
  await db.insert(member).values([
    { workspaceId: newer.id, userId: owner.id, createdAt: iso("2026-06-01") },
    { workspaceId: older.id, userId: owner.id, createdAt: iso("2026-01-02") },
  ]);

  await db.insert(user).values([
    {
      id: "u_bot_owned",
      name: "Owned bot",
      email: "owned@example.com",
      emailVerified: false,
      isBot: true,
      ownerUserId: owner.id,
      createdAt: iso("2026-02-01"),
      updatedAt: iso("2026-02-01"),
    },
    // An orphan: a bot whose owner has no workspace membership at all. The
    // migration must leave it NULL rather than fail — that is why the column
    // is nullable instead of NOT NULL.
    {
      id: "u_owner_no_ws",
      name: "Ownerless",
      email: "nows@example.com",
      emailVerified: false,
      createdAt: iso("2026-02-01"),
      updatedAt: iso("2026-02-01"),
    },
    {
      id: "u_bot_orphan",
      name: "Orphan bot",
      email: "orphan@example.com",
      emailVerified: false,
      isBot: true,
      ownerUserId: "u_owner_no_ws",
      createdAt: iso("2026-02-01"),
      updatedAt: iso("2026-02-01"),
    },
  ]);
  // Raw SQL on purpose: the Drizzle model already carries `workspace_id`, and
  // Drizzle emits every column it knows about, so an ORM insert here would
  // reference a column the pre-0091 table does not have yet.
  await db.run(sql`
    INSERT INTO community_bot_binding (user_id, machine_id, runtime, created_at)
    VALUES ('u_bot_owned', NULL, 'claude', ${iso("2026-02-01")}),
           ('u_bot_orphan', NULL, 'claude', ${iso("2026-02-01")})
  `);

  (globalThis as Record<string, unknown>).__olderWorkspaceId = older.id;

  const applied = await applyMigrations(client, MIGRATIONS_DIR);
  // Guard the premise: if 0091 was already applied by the first call, the
  // backfill would have run against an empty table and every assertion below
  // would pass while testing nothing.
  expect(applied).toContain("0091_bot_binding_workspace.sql");
}, 120_000);

describe("0091 workspace backfill", () => {
  it("attaches an existing bot to its owner's oldest workspace", async () => {
    const [row] = await db
      .select()
      .from(communityBotBinding)
      .where(eq(communityBotBinding.userId, "u_bot_owned"));
    expect(row.workspaceId).toBe((globalThis as Record<string, unknown>).__olderWorkspaceId);
  });

  it("leaves a bot whose owner has no workspace unattached rather than failing", async () => {
    const [row] = await db
      .select()
      .from(communityBotBinding)
      .where(eq(communityBotBinding.userId, "u_bot_orphan"));
    expect(row.workspaceId).toBeNull();
  });

  it("indexes the new column", async () => {
    const rows = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'community_bot_binding'`
    );
    expect(rows.map((r) => r.name)).toContain("idx_community_bot_binding_workspace");
  });
});
