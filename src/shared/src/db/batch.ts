import type { Database } from "./index";

/**
 * The single batch chokepoint (plans/postgres-port.md). Query modules must
 * never call `db.batch` directly — they go through `batchAll`, so the
 * Postgres cutover swaps ONE implementation (D1/libSQL native batch →
 * `db/pg` runBatch transaction) instead of touching thirty call sites.
 * Executes the statements atomically and returns per-statement results in
 * order, matching D1 semantics.
 */
export async function batchAll<T = unknown>(
  db: Database,
  statements: readonly unknown[],
): Promise<T[]> {
  return (db as unknown as { batch: (s: readonly unknown[]) => Promise<T[]> }).batch(statements);
}
