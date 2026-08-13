/**
 * Escape user input destined for a SQL LIKE pattern.
 *
 * `%` and `_` are wildcards in LIKE; if user-supplied text isn't escaped,
 * a single character is enough to bypass intended search semantics
 * (e.g. searching for `%` matches every row). Drizzle parameterises the
 * value but not the wildcards inside it.
 *
 * Use with `like(col, `%${escapeLikePattern(input)}%`)` and pair with
 * the matching `ESCAPE '\\'` clause if your driver requires it (D1 / SQLite
 * supports the backslash escape natively via `LIKE ? ESCAPE '\\'`).
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (m) => "\\" + m)
}

import { sql, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

/**
 * Case-insensitive LIKE seam (plans/postgres-port.md). SQLite's LIKE is
 * ASCII case-insensitive by default; Postgres's is case-sensitive — at
 * cutover this ONE helper switches to ILIKE while every search call site
 * stays untouched. Pattern must already be escaped via escapeLikePattern.
 */
export function likeInsensitive(column: AnyColumn | SQL, pattern: string): SQL {
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}
