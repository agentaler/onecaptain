import { createDb, type Database } from "@onecaptain/shared"

export { withD1Retry } from "@onecaptain/shared"

export function getDb(d1: D1Database): Database {
  const session = d1.withSession("first-unconstrained")
  return createDb(session as unknown as Parameters<typeof createDb>[0])
}
