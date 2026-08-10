/**
 * Node-platform database construction — the libSQL twin of `createDb`.
 *
 * Lives in its own subpath export (`@onecaptain/shared/db-node`), NOT the
 * barrel: `@libsql/client` carries Node-native dependencies that must never
 * reach a Workers or browser bundle. Only Node-platform code (Railway `web`
 * service, the Node migrator, tests) imports this module.
 *
 * The returned instance is cast to the shared `Database` type: both
 * drizzle-orm/d1 and drizzle-orm/libsql produce async sqlite databases over
 * the same schema and dialect, so every shared query module (including
 * `db.batch(...)` call sites) behaves identically. The cast is the single
 * seam where the two drivers meet.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";
import * as communitySchema from "./community-schema";
import * as communityMachineSchema from "./community-machine-schema";
import type { Database } from "./index";

const allSchema = { ...schema, ...communitySchema, ...communityMachineSchema };

export function createNodeClient(url: string): Client {
  return createClient({ url });
}

export function createNodeDb(urlOrClient: string | Client): Database {
  const client = typeof urlOrClient === "string" ? createNodeClient(urlOrClient) : urlOrClient;
  return drizzle(client, { schema: allSchema }) as unknown as Database;
}

/**
 * Replay the wrangler-managed migration directory against a libSQL database,
 * mirroring `wrangler d1 migrations apply` semantics: files run in filename
 * order, each applied at most once, tracked in the same `d1_migrations`
 * table wrangler uses — so a database created by wrangler (dev state) and one
 * created by this runner agree on what "applied" means.
 *
 * Statements within one migration run in a single batch (atomic per
 * migration). Returns the names applied in this invocation.
 */
export async function applyMigrations(client: Client, migrationsDir: string): Promise<string[]> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS d1_migrations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT UNIQUE,
       applied_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now'))
     )`,
  );
  const appliedRows = await client.execute("SELECT name FROM d1_migrations");
  const applied = new Set(appliedRows.rows.map((r) => String(r.name)));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const statements = splitSqlStatements(sql);
    await client.batch(
      [
        ...statements.map((s) => ({ sql: s, args: [] as never[] })),
        { sql: "INSERT INTO d1_migrations (name) VALUES (?)", args: [file] as never[] },
      ],
      "write",
    );
    newlyApplied.push(file);
  }
  return newlyApplied;
}

/**
 * Split a migration file into individual statements. Semicolons inside
 * single-quoted strings and `--` line comments are not separators, and a
 * `CREATE TRIGGER … BEGIN … END;` block (the FTS sync triggers in
 * migrations 0044/0059/0068) stays one statement — its internal semicolons
 * only terminate it when the token before `;` is `END`. A trailing
 * statement without a semicolon still runs.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inString = false;
  let inLineComment = false;

  const isTriggerBlock = () =>
    /^\s*CREATE\s+TRIGGER/i.test(stripComments(current));
  const endsWithEnd = () => /\bEND\s*$/i.test(stripComments(current));

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      current += ch;
      continue;
    }
    if (inString) {
      current += ch;
      if (ch === "'" && sql[i + 1] === "'") {
        current += sql[++i];
      } else if (ch === "'") {
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      inLineComment = true;
      current += ch;
      continue;
    }
    if (ch === ";") {
      if (isTriggerBlock() && !endsWithEnd()) {
        current += ch;
        continue;
      }
      const trimmed = current.trim();
      if (stripComments(trimmed).length > 0) statements.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (stripComments(tail).length > 0) statements.push(tail);
  return statements;
}

function stripComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}
