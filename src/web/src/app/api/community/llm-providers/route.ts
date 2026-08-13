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
 */
export const GET = withAuth(async (_req, ctx) => {
  const db = getDb(ctx.env.DB)
  const workspaceId = await primaryWorkspaceIdForUser(db, ctx.userId)
  // No workspace is not an error here — it means "nothing configured", which is
  // exactly what the caller needs to know.
  if (!workspaceId) return writeJSON({ providers: [] })

  const providers = await queries.providerCredential.listCredentials(db, workspaceId)
  return writeJSON({ providers })
})
