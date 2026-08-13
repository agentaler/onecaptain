import {
  callProvider,
  currentUsagePeriodEnd,
  currentUsagePeriodStart,
  getPlanLimits,
  ProviderCallError,
  queries,
  resolveAgentProvider,
  type AgentProviderEnv,
  type Database,
} from "@onecaptain/shared"
import { createCommunityMessage } from "@/lib/community/message-handler"

/**
 * Run ONE turn of a cloud-hosted agent: resolve its credential, ask the
 * provider, post the reply, meter the call.
 *
 * This is the half of the cloud runtime that must live in `src/web`, because
 * posting goes through `createCommunityMessage` — the same path a human send
 * and a daemon send take, so mentions, WS fan-out, read-state and audit rows
 * all behave identically for a cloud agent. Reimplementing any of that against
 * the raw `createMessage` query would produce an agent whose messages are
 * subtly different from everyone else's. The pure pieces it composes
 * (`resolveAgentProvider`, `callProvider`) live in `src/shared` and are tested
 * there without any web dependency.
 *
 * Deliberately a single provider call, not an agentic loop: no tool use, no
 * multi-turn. This step is about removing the machine requirement end to end.
 */

/** Room the reply gets. Small on purpose — a chat reply, not an essay. */
const MAX_OUTPUT_TOKENS = 1024
/** How much recent channel history the agent sees. */
const CONTEXT_MESSAGE_LIMIT = 20

export type CloudAgentRunResult =
  | { ok: true; messageId: string; inputTokens: number; outputTokens: number; billable: boolean }
  | {
      ok: false
      kind: "no_credential" | "permanent" | "transient" | "empty_reply" | "over_allowance"
      error: string
    }

export interface CloudAgentRunInput {
  db: Database
  env: AgentProviderEnv
  botUserId: string
  channelId: string
  serverId: string
}

function systemPromptFor(name: string, handle: string, description: string): string {
  return [
    `You are ${name} (${handle}), an agent in a OneCaptain community channel.`,
    description.trim().length > 0 ? `Your purpose: ${description.trim()}` : "",
    "Reply as a participant in the conversation. Be concise and concrete.",
    "You are replying in a chat channel, so do not restate the question or add a sign-off.",
  ]
    .filter((line) => line.length > 0)
    .join("\n")
}

export async function runCloudAgentTurn(input: CloudAgentRunInput): Promise<CloudAgentRunResult> {
  const { db, env, botUserId, channelId, serverId } = input

  const bot = await queries.communityBot.getBotWakeContext(db, botUserId)
  if (bot.state !== "ready") return { ok: false, kind: "permanent", error: `agent is ${bot.state}` }

  const resolution = await resolveAgentProvider(
    db,
    {
      workspaceId: bot.workspaceId,
      providerKind: bot.providerKind,
      providerApiUrl: bot.providerApiUrl,
      providerApiKeyEnc: bot.providerApiKeyEnc,
    },
    env,
  )
  if (resolution.state !== "ready") {
    return {
      ok: false,
      kind: "no_credential",
      error: "no provider key for this agent or its workspace",
    }
  }

  // `listMessages` returns newest-first; a conversation reads oldest-first.
  // Spend gate. Only calls WE pay for are capped — a workspace on its own key
  // costs us nothing, and counting those against an allowance would be charging
  // someone for spending their own money. Checked BEFORE the provider call, so
  // an over-allowance workspace cannot run up cost and be refused afterwards.
  if (resolution.billable) {
    const over = await isOverIncludedAllowance(db, bot.workspaceId)
    if (over) {
      // Say so in the channel rather than going quiet. Silence is the failure
      // mode this whole change exists to remove — an agent that stops answering
      // for an invisible reason is indistinguishable from a broken one.
      //
      // `skipWake` is load-bearing, not tidiness: a bot's message can wake
      // another bot, so two over-allowance agents in one channel would answer
      // each other's notices forever.
      await createCommunityMessage({
        db,
        authorId: botUserId,
        target: { kind: "channel", channelId, serverId },
        body: {
          content:
            "I'm out of included AI usage for this month. Add your own provider key in settings, or upgrade the plan, and I'll pick straight back up.",
        },
        skipWake: true,
      }).catch(() => {
        // Best-effort. Failing to explain must not turn into failing to stop.
      })
      return {
        ok: false,
        kind: "over_allowance",
        error: "this workspace has used its included AI usage for the month",
      }
    }
  }

  const history = (
    await queries.communityMessage.listMessages(db, {
      channelId,
      limit: CONTEXT_MESSAGE_LIMIT,
    })
  ).slice().reverse()
  if (history.length === 0) {
    return { ok: false, kind: "permanent", error: "nothing to reply to" }
  }

  // The agent's own past messages are its assistant turns; everyone else's are
  // user turns. Without this the model cannot tell its own voice from the room's.
  const messages = history.map((row) => ({
    role: row.authorId === botUserId ? ("assistant" as const) : ("user" as const),
    content: row.authorId === botUserId ? row.content : `${row.authorName ?? "someone"}: ${row.content}`,
  }))
  // A provider rejects a conversation that opens on an assistant turn, which is
  // exactly what happens when the agent spoke last in the window.
  while (messages.length > 0 && messages[0]!.role === "assistant") messages.shift()
  if (messages.length === 0) {
    return { ok: false, kind: "permanent", error: "nothing to reply to" }
  }

  let result: Awaited<ReturnType<typeof callProvider>>
  try {
    result = await callProvider(resolution.config, {
      system: systemPromptFor(bot.name, `@${bot.name}`, ""),
      messages,
      model: bot.modelName ?? defaultModelFor(resolution.kind),
      maxTokens: MAX_OUTPUT_TOKENS,
    })
  } catch (err) {
    if (err instanceof ProviderCallError) {
      return { ok: false, kind: err.kind, error: err.message }
    }
    return { ok: false, kind: "transient", error: String(err) }
  }

  const reply = result.text.trim()
  if (reply.length === 0) {
    // Meter it anyway — the provider charged for it either way, and a silent
    // agent with no usage row looks like it never ran.
    await recordTurnUsage(db, bot.workspaceId, botUserId, resolution, result)
    return { ok: false, kind: "empty_reply", error: "provider returned an empty reply" }
  }

  const created = await createCommunityMessage({
    db,
    authorId: botUserId,
    target: { kind: "channel", channelId, serverId },
    body: { content: reply },
  })
  if (!created.ok) {
    return { ok: false, kind: "permanent", error: created.error }
  }

  await recordTurnUsage(db, bot.workspaceId, botUserId, resolution, result)

  return {
    ok: true,
    messageId: created.row.id,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    billable: resolution.billable,
  }
}

/**
 * Has this workspace spent its monthly included allowance on OneCaptain-paid
 * calls?
 *
 * Sums the period's BILLABLE usage only — `summarizeUsage` returns both totals
 * precisely so a limit can read the billable one without a second query. A
 * workspace with no id cannot be metered or billed, so it has no allowance to
 * spend and is refused rather than given a free uncapped ride.
 */
async function isOverIncludedAllowance(
  db: Database,
  workspaceId: string | null,
): Promise<boolean> {
  if (!workspaceId) return true

  const plan = await queries.workspace.getWorkspacePlan(db, workspaceId)
  const allowance = getPlanLimits(plan).includedTokensPerMonth
  if (allowance === Number.POSITIVE_INFINITY) return false

  const usage = await queries.providerCredential.summarizeUsage(
    db,
    workspaceId,
    currentUsagePeriodStart(),
    currentUsagePeriodEnd(),
  )
  // Tokens in AND out — both are billed by every provider, so counting only one
  // would let an agent that writes long answers run at roughly double the
  // intended allowance.
  return usage.inputTokens + usage.outputTokens >= allowance
}

/**
 * `cost_micros` is left at 0 until per-model list prices land with the billing
 * step. Writing a made-up figure now would put a number nobody can defend into
 * a ledger that invoices read from; a zero is visibly incomplete instead. The
 * token counts, which are the part that has to be captured at call time, are
 * recorded here and the cost can be derived from them later.
 */
async function recordTurnUsage(
  db: Database,
  workspaceId: string | null,
  botUserId: string,
  resolution: Extract<Awaited<ReturnType<typeof resolveAgentProvider>>, { state: "ready" }>,
  result: Awaited<ReturnType<typeof callProvider>>,
): Promise<void> {
  if (!workspaceId) return
  await queries.providerCredential.recordUsage(db, {
    workspaceId,
    agentUserId: botUserId,
    provider: resolution.kind,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costMicros: 0,
    billable: resolution.billable,
  })
}

function defaultModelFor(kind: string): string {
  if (kind === "openai") return "gpt-5"
  if (kind === "openrouter") return "anthropic/claude-opus-4.6"
  return "claude-opus-4-6"
}
