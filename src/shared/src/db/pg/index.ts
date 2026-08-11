/**
 * Postgres database layer (plans/postgres-port.md). Exposed only via the
 * `@onecaptain/shared/db-pg` subpath — deliberately NOT re-exported from the
 * package barrel, so `pg`'s Node-native dependency tree never reaches
 * Workers/browser bundles (same isolation rule as ./node.ts).
 *
 * The schema twins live in ./pg/ (pg-core ports of the sqlite originals).
 * `PgAppDatabase` is the drizzle PgDatabase over that schema; both the
 * node-postgres production driver and the PGlite test driver satisfy it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as communitySchema from "./community-schema";
import * as communityMachineSchema from "./community-machine-schema";

export const pgSchema = { ...schema, ...communitySchema, ...communityMachineSchema };

export type PgAppDatabase = NodePgDatabase<typeof pgSchema>;

export function createPgPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export function createPgDb(urlOrPool: string | Pool): PgAppDatabase {
  const pool = typeof urlOrPool === "string" ? createPgPool(urlOrPool) : urlOrPool;
  return drizzle(pool, { schema: pgSchema });
}

/**
 * Applies every migration in `dir` (drizzle-kit output: *.sql files split on
 * `--> statement-breakpoint`) that is not yet recorded in pg_migrations.
 * Ordered by filename; each file runs atomically. Safe to run on every boot.
 */
export async function applyPgMigrations(db: PgAppDatabase, dir: string): Promise<string[]> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS pg_migrations (
    id serial PRIMARY KEY,
    name text NOT NULL UNIQUE,
    applied_at text NOT NULL DEFAULT (now()::text)
  )`);
  const applied = new Set(
    (await db.execute(sql`SELECT name FROM pg_migrations`)).rows.map((r) => String(r.name)),
  );
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const statements = readFileSync(join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    await db.transaction(async (tx) => {
      for (const stmt of statements) {
        await tx.execute(sql.raw(stmt));
      }
      await tx.execute(sql`INSERT INTO pg_migrations (name) VALUES (${file})`);
    });
    ran.push(file);
  }
  return ran;
}

/**
 * D1's `db.batch(stmts)` has no drizzle-pg equivalent. The pg replacement for
 * the 30 batch call sites: build the statements against the transaction handle
 * (NOT the outer db — statements bound to the pool would escape the
 * transaction) and get per-statement results back in order, atomically.
 */
export async function runBatch<T>(
  db: PgAppDatabase,
  build: (tx: PgAppDatabase) => ReadonlyArray<PromiseLike<T>>,
): Promise<T[]> {
  return db.transaction(async (tx) => {
    const results: T[] = [];
    for (const stmt of build(tx as unknown as PgAppDatabase)) {
      results.push(await stmt);
    }
    return results;
  });
}

export { withPgRetry, readOrStalePg, isRetryablePgError } from "./resilience";
