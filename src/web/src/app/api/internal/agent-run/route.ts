import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { queries, createLogger, InternalAgentRunRequestSchema } from "@onecaptain/shared"
import { getDb } from "@/lib/db"
import { runCloudAgentTurn } from "@/lib/community/cloud-agent-run"

const log = createLogger({ service: "internal-agent-run" })

/**
 * Service-to-service door: run one cloud agent turn on behalf of the wake
 * worker.
 *
 * This exists because a cloud agent's reply must go through
 * `createCommunityMessage`, and that funnel reaches `getCloudflareContext()`
 * (five call sites in `fanout.ts`), so it only runs inside the Next/OpenNext
 * runtime. The wake worker owns the queue semantics; this owns the message
 * path. The alternative — lifting the funnel into `src/shared` — needs the
 * platform seam the Postgres cutover requires, which is a separate project.
 *
 * NOT a user-facing route. It carries no session and must never be reachable
 * with one: authorization is a shared secret, compared in constant time, and
 * absent-secret means closed rather than open. The wake worker has already
 * established from current D1 state WHICH agent may speak in WHICH channel
 * (membership, read-state, access — see `buildUnreadWakeCommand`), so this
 * route deliberately does not redo that; it authenticates the caller, not the
 * agent.
 */
function secretsMatch(a: string, b: string): boolean {
  // Length is not secret (both sides are fixed-length config), but the
  // comparison still must not exit early on the first differing byte.
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function POST(request: NextRequest): Promise<Response> {
  const { env } = getCloudflareContext()
  const expected = env.INTERNAL_RUN_SECRET
  const presented = request.headers.get("x-onecaptain-internal")

  // Fail closed when unconfigured. An empty expected secret matching an empty
  // header would turn this into an open door on any deploy that forgot to set
  // it — the exact failure mode worth being paranoid about.
  if (!expected || !presented || !secretsMatch(presented, expected)) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const parsed = InternalAgentRunRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 })
  }
  const { botUserId, channelId } = parsed.data

  const db = getDb(env.DB)
  const channel = await queries.communityChannel.getChannel(db, channelId)
  if (!channel?.serverId) {
    return NextResponse.json({ error: "channel not found" }, { status: 400 })
  }

  const result = await runCloudAgentTurn({
    db,
    env,
    botUserId,
    channelId,
    serverId: channel.serverId,
  })

  if (!result.ok) {
    log.warn("internal_agent_run_failed", {
      category: "internal_agent_run_failed",
      botUserId,
      channelId,
      kind: result.kind,
    })
    // The status IS the queue contract: 503 tells the wake worker to retry,
    // anything else tells it to ack. Getting this backwards either loses a
    // reply or retries a bad key forever.
    const status = result.kind === "transient" ? 503 : 422
    return NextResponse.json({ error: result.error, kind: result.kind }, { status })
  }

  return NextResponse.json({ messageId: result.messageId })
}
