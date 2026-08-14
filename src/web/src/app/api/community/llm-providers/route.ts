import { queries } from "@onecaptain/shared"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { writeJSON } from "@/lib/middleware/helpers"
import { primaryWorkspaceIdForUser } from "@/lib/community/primary-workspace"

/**
 * The community surface's view of the workspace's LLM providers.
 *
 * Exists separately from `/api/llm-providers` because `/c` has no workspace in
 * the request — see `primaryWorkspaceIdForUser`. The listing itself is the same
 * query, and it projects `last4` without selecting ciphertext.
 *
 * `platformFallback` answers the question the UI actually has: "can this
 * workspace run an agent right now?" A workspace with no key of its own still
 * can, on OneCaptain's — `resolveAgentProvider` falls back to the platform key
 * as its third source. Without this the client could only see the workspace's
 * own credentials and would block agent creation for someone who is entitled to
 * create one on the free tier. A boolean, never the key.
 */
function hasPlatformKey(env: { PLATFORM_PROVIDER_KIND?: string; PLATFORM_PROVIDER_API_KEY?: string }) {
  // Mirrors the platform branch of `resolveAgentProvider`: BOTH values, or that
  // branch produces nothing and the fallback does not exist.
  return Boolean(env.PLATFORM_PROVIDER_KIND && env.PLATFORM_PROVIDER_API_KEY)
}

export const GET = withAuth(async (_req, ctx) => {
  const db = getDb(ctx.env.DB)
  const platformFallback = hasPlatformKey(ctx.env)
  const workspaceId = await primaryWorkspaceIdForUser(db, ctx.userId)
  // No workspace is not an error here — it means "nothing configured", which is
  // exactly what the caller needs to know.
  if (!workspaceId) return writeJSON({ providers: [], platformFallback })

  const providers = await queries.providerCredential.listCredentials(db, workspaceId)
  return writeJSON({ providers, platformFallback })
})
