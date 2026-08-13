import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { createNodeClient, createNodeDb, applyMigrations } from "../../src/db/node";
import type { Database } from "../../src/db";
import { user } from "../../src/db/schema";
import { communityBotBinding, communityMachine } from "../../src/db/community-machine-schema";

/**
 * Migration 0090 rebuilds `community_bot_binding` to make `machine_id`
 * nullable — a cloud-run agent has no machine. A SQLite table rebuild silently
 * drops anything not restated in the new DDL, so these assert the properties
 * that would be lost without a word of warning: the RESTRICT foreign key, the
 * machine index, and the existing columns.
 */
const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../web/migrations");

/** Flatten an error and every `cause` beneath it into one searchable string. */
function causeChain(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  while (cur instanceof Error) {
    parts.push(cur.message);
    cur = cur.cause;
  }
  if (cur !== undefined && cur !== null) parts.push(String(cur));
  return parts.join(" | ");
}

let db: Database;
let ownerId: string;
let machineId: string;

beforeAll(async () => {
  const client = createNodeClient(":memory:");
  await applyMigrations(client, MIGRATIONS_DIR);
  db = createNodeDb(client);

  const [owner] = await db
    .insert(user)
    .values({
      id: "user_owner_1",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();
  ownerId = owner.id;

  const [machine] = await db
    .insert(communityMachine)
    .values({ userId: ownerId, displayName: "Laptop" })
    .returning();
  machineId = machine.id;
}, 120_000);

describe("community_bot_binding after 0090", () => {
  it("accepts a binding with no machine — the cloud-run agent", async () => {
    await db.insert(communityBotBinding).values({
      userId: "user_owner_1",
      machineId: null,
      runtime: "cloud",
      providerKind: "anthropic",
    });

    const [row] = await db
      .select()
      .from(communityBotBinding)
      .where(eq(communityBotBinding.userId, "user_owner_1"));
    expect(row.machineId).toBeNull();
    expect(row.runtime).toBe("cloud");
    // Columns added by 0064 / 0085 survived the rebuild.
    expect(row.providerKind).toBe("anthropic");
    expect(row.modelName).toBeNull();
  });

  it("still blocks deleting a machine that has bots bound to it", async () => {
    const [bot] = await db
      .insert(user)
      .values({
        id: "user_bot_1",
        name: "Bot",
        email: "bot@example.com",
        emailVerified: false,
        isBot: true,
        ownerUserId: ownerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await db
      .insert(communityBotBinding)
      .values({ userId: bot.id, machineId, runtime: "claude" });

    // RESTRICT is the whole reason the rebuild had to restate the FK: without
    // it this delete would succeed and orphan the binding.
    await db.run(sql`PRAGMA foreign_keys=ON`);
    // Assert the REASON, not merely that something threw — a rebuild that
    // dropped the FK would still throw here for some unrelated reason and the
    // test would pass while the constraint was gone. Drizzle wraps the driver
    // error in a `Failed query: …` shell, so the SQLite message is down the
    // `cause` chain, not on the top-level error.
    const err = await db
      .delete(communityMachine)
      .where(eq(communityMachine.id, machineId))
      .then(() => null as unknown, (e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(causeChain(err)).toMatch(/FOREIGN KEY constraint failed/i);
  });

  it("keeps the machine index the wake-dispatch lookups rely on", async () => {
    const rows = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'community_bot_binding'`
    );
    expect(rows.map((r) => r.name)).toContain("idx_community_bot_binding_machine");
  });

  it("left no rebuild scaffolding behind", async () => {
    const rows = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'community_bot_binding_new'`
    );
    expect(rows).toHaveLength(0);
  });
});
