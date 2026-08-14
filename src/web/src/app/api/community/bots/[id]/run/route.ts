import { NextRequest } from "next/server"
import { queries, createLogger, CommunityAgentRunRequestSchema } from "@onecaptain/shared"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers"
import { requireChannelMember } from "@/lib/community/permissions"
import { runCloudAgentTurn } from "@/lib/community/cloud-agent-run"

const log = createLogger({ service: "community-agent-run" })

/**
 * Run one turn of a cloud-hosted agent in a channel, on demand.
 *
 * The first surface where an agent answers with NO machine connected: the reply
 * is produced server-side from a provider API key. Automatic runs (waking on a
 * mention) come next and reuse `runCloudAgentTurn` unchanged; this route exists
 * so the path is exercisable — and so a user can test an agent right after
 * pasting a key, instead of waiting to find out whether it works.
 *
 * Two independent gates, because the agent and the caller are different
 * principals: the caller must own the agent (`getBotOwnedBy` scopes on owner in
 * its WHERE clause), AND the agent itself must be able to post in the target
 * channel. Checking only the first would let an owner make their agent speak
 * in a channel it was never added to.
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const botId = ctx.params?.id as string
  const [body, err] = await parseBody(req, CommunityAgentRunRequestSchema)
  if (err) return err

  const db = getDb(ctx.env.DB)

  const bot = await queries.communityBot.getBotOwnedBy(db, botId, ctx.userId)
  if (!bot) return writeError("agent not found", 404)

  const access = await requireChannelMember(db, body.channelId, botId)
  if (!access.ok) return writeError("agent cannot post in this channel", access.status)
  const channel = access.value
  if (!channel.serverId) return writeError("agent cannot post in this channel", 403)

  const result = await runCloudAgentTurn({
    db,
    env: ctx.env,
    botUserId: botId,
    channelId: body.channelId,
    serverId: channel.serverId,
  })

  if (!result.ok) {
    log.warn("cloud_agent_run_failed", {
      category: "cloud_agent_run_failed",
      botId,
      channelId: body.channelId,
      kind: result.kind,
    })
    // A missing key is the caller's to fix and says so plainly; a provider
    // outage is 503 so a client can distinguish "try again" from "fix this".
    const status = result.kind === "transient" ? 503 : 422
    return writeError(result.error, status)
  }

  return writeJSON({
    messageId: result.messageId,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      billable: result.billable,
    },
  })
})
