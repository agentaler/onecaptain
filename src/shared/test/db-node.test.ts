import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import {
  createNodeDb,
  applyMigrations,
  splitSqlStatements,
} from "../src/db/node";
import * as workspaceQueries from "../src/db/queries/workspace";
import * as memberQueries from "../src/db/queries/member";
import * as workspaceAuditQueries from "../src/db/queries/workspace-audit";
import type { Database } from "../src/db/index";

const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../web/migrations");

describe("splitSqlStatements", () => {
  it("splits on semicolons but not inside strings or comments", () => {
    const parts = splitSqlStatements(
      "-- lead comment; with semicolon\n" +
        "CREATE TABLE a (x TEXT DEFAULT 'a;b');\n" +
        "UPDATE a SET x = 'it''s;fine';\n" +
        "DROP TABLE a",
    );
    expect(parts).toHaveLength(3);
    expect(parts[0]).toContain("'a;b'");
    expect(parts[1]).toContain("it''s;fine");
    expect(parts[2]).toBe("DROP TABLE a");
  });

  it("returns nothing for comment-only input", () => {
    expect(splitSqlStatements("-- only a comment\n")).toEqual([]);
  });

  it("keeps a CREATE TRIGGER BEGIN…END block as one statement", () => {
    const parts = splitSqlStatements(
      "CREATE TABLE t (x TEXT);\n" +
        "CREATE TRIGGER trg AFTER INSERT ON t BEGIN\n" +
        "  INSERT INTO t (x) VALUES (new.x);\n" +
        "  DELETE FROM t WHERE x = 'gone';\n" +
        "END;\n" +
        "DROP TABLE t;",
    );
    expect(parts).toHaveLength(3);
    expect(parts[1]).toMatch(/^CREATE TRIGGER/);
    expect(parts[1]).toMatch(/END$/);
  });
});

describe("Node libSQL database — full migration replay + shared queries", () => {
  const client = createClient({ url: ":memory:" });
  let db: Database;

  beforeAll(async () => {
    const applied = await applyMigrations(client, MIGRATIONS_DIR);
    // Every migration on disk applies to a fresh DB, including 0006's
    // data backfill and 0084-0086.
    expect(applied.length).toBeGreaterThanOrEqual(86);
    db = createNodeDb(client);
  });

  it("is idempotent — a second run applies nothing", async () => {
    expect(await applyMigrations(client, MIGRATIONS_DIR)).toEqual([]);
  });

  it("runs the workspace/member/audit shared queries end to end", async () => {
    const ws = await workspaceQueries.createWorkspace(db, {
      name: "Acme",
      slug: "acme",
    });
    expect(ws.plan).toBe("free");
    expect(await workspaceQueries.getWorkspacePlan(db, ws.id)).toBe("free");

    await db.insert((await import("../src/db/schema")).user).values({
      id: "u1",
      name: "Alice",
      email: "alice@example.com",
      emailVerified: false,
      discriminator: "0001",
    });
    await memberQueries.createMember(db, {
      workspaceId: ws.id,
      userId: "u1",
      role: "owner",
    });
    expect(await memberQueries.countMembers(db, ws.id)).toBe(1);

    const row = await workspaceAuditQueries.logAction(db, {
      workspaceId: ws.id,
      actorId: "u1",
      action: "workspace.member.joined",
      targetType: "member",
      targetId: "u1",
    });
    expect(row.id).toMatch(/^wal_/);
    const listed = await workspaceAuditQueries.listAuditLog(db, ws.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.action).toBe("workspace.member.joined");
  });

  it("supports the batch API shared queries rely on", async () => {
    const results = await db.batch([
      db.select().from((await import("../src/db/schema")).workspace),
      db.select().from((await import("../src/db/schema")).member),
    ]);
    expect(results).toHaveLength(2);
  });
});
