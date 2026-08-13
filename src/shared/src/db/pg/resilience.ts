/**
 * Postgres flavor of ../resilience.ts (plans/postgres-port.md). Same contract:
 * classify → retry with jittered backoff → readOrStale laundering ONLY
 * retryable shapes. At cutover the query modules swap withD1Retry for
 * withPgRetry; until then this ships alongside the pg db layer.
 */
import { DrizzleQueryError } from "drizzle-orm/errors"
import { createLogger, type Logger } from "../../logger"
import type { RetryOpts } from "../resilience"

type ReadOrStaleOpts = RetryOpts & { category?: string }

const DEFAULT_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 100

const defaultLogger: Logger = createLogger({ service: "pg-resilience" })

/**
 * Postgres error codes that are transient by definition:
 * - class 08 (connection exceptions)
 * - 40001 serialization_failure, 40P01 deadlock_detected
 * - 55P03 lock_not_available, 53300 too_many_connections (pool churn)
 * - 57P03 cannot_connect_now (server starting/restarting)
 */
const RETRYABLE_PG_CODES = new Set([
  "08000", "08003", "08006", "08001", "08004",
  "40001", "40P01",
  "55P03", "53300",
  "57P03",
])

const RETRYABLE_SIGNATURES = [
  // node-postgres / socket transients
  "Connection terminated",
  "connection reset",
  "Client has encountered a connection error",
  "timeout exceeded when trying to connect",
  "fetch failed",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "EPIPE",
  "socket hang up",
  " timed out",
  "network timeout",
]

function peelDrizzle(err: unknown): { peeled: unknown; bareWrapper: boolean } {
  if (!(err instanceof DrizzleQueryError)) return { peeled: err, bareWrapper: false }
  let cur: unknown = err
  while (cur instanceof DrizzleQueryError) {
    if (!cur.cause) return { peeled: cur, bareWrapper: true }
    cur = cur.cause
  }
  return { peeled: cur, bareWrapper: false }
}

export function isRetryablePgError(err: unknown): boolean {
  const { peeled, bareWrapper } = peelDrizzle(err)
  // A DrizzleQueryError with no `.cause` hides the transient shape — retry
  // conservatively rather than fail-fast (same rule as the D1 layer).
  if (bareWrapper) return true
  if (!(peeled instanceof Error)) return false
  const code = (peeled as { code?: unknown }).code
  if (typeof code === "string" && RETRYABLE_PG_CODES.has(code)) return true
  const msg = peeled.message
  if (typeof msg !== "string") return false
  for (const sig of RETRYABLE_SIGNATURES) {
    if (msg.includes(sig)) return true
  }
  return false
}

export async function withPgRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const attempts = opts.attempts ?? DEFAULT_ATTEMPTS
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const route = opts.route
  let lastErr: unknown
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryablePgError(err)) throw err
      if (i === attempts) break
      const cap = baseDelayMs * 2 ** i
      const delay = Math.floor(Math.random() * cap)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  defaultLogger.warn("pg_retry_exhausted", {
    category: "pg_retry_exhausted",
    route,
    err: lastErr instanceof Error ? lastErr : new Error(String(lastErr)),
  })
  throw lastErr
}

export async function readOrStalePg<T extends Record<string, unknown>>(
  fn: () => Promise<T>,
  fallback: T,
  opts: ReadOrStaleOpts = {},
): Promise<{ value: T; stale: boolean }> {
  try {
    const value = await withPgRetry(fn, opts)
    return { value, stale: false }
  } catch (err) {
    // Only launder RETRYABLE-shaped failures into `stale` — constraint
    // violations and broken queries must surface as 500s, not empty UI.
    if (!isRetryablePgError(err)) throw err
    defaultLogger.warn("pg_fail_closed", {
      category: opts.category ?? "pg_fail_closed",
      route: opts.route,
      err: err instanceof Error ? err : new Error(String(err)),
    })
    return { value: fallback, stale: true }
  }
}
