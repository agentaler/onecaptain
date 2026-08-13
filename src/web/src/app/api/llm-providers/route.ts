import { NextRequest } from "next/server"
import { queries } from "@onecaptain/shared"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { withWorkspaceMember } from "@/lib/middleware/workspace"
import { writeJSON } from "@/lib/middleware/helpers"

/**
 * The workspace's configured LLM providers.
 *
 * `listCredentials` projects `last4` and does not select the ciphertext column
 * at all, so this response cannot leak a key even by accident — the shape a
 * route returns is decided in the query, not filtered here.
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx)
  if (ws instanceof Response) return ws

  const db = getDb(ctx.env.DB)
  const providers = await queries.providerCredential.listCredentials(db, ws.workspaceId)
  return writeJSON({ providers })
})
