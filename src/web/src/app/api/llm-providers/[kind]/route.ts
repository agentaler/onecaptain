import { NextRequest } from "next/server"
import { queries, isBotProviderKind, LlmProviderUpsertSchema } from "@onecaptain/shared"
import { encrypt } from "@onecaptain/shared/crypto"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { withWorkspaceRole } from "@/lib/middleware/workspace"
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers"

/**
 * Set or remove the workspace's key for one provider.
 *
 * Admin-gated, not member-gated: a provider key is a spending instrument — with
 * a managed key it bills the workspace, and with a BYO key it spends the
 * workspace's own provider budget. Reading which providers are configured is a
 * member-level concern (see the parent route); changing them is not.
 */
function kindOf(ctx: { params?: Record<string, string> }): string | null {
  const kind = ctx.params?.kind
  return kind && isBotProviderKind(kind) ? kind : null
}

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceRole(req, ctx, "admin")
  if (ws instanceof Response) return ws

  const kind = kindOf(ctx)
  if (!kind) return writeError("unknown provider", 400)

  const [body, err] = await parseBody(req, LlmProviderUpsertSchema)
  if (err) return err

  const secret = ctx.env.ENCRYPTION_KEY
  if (!secret) return writeError("provider keys are not configurable on this deployment", 503)

  const apiKey = body.apiKey.trim()
  const db = getDb(ctx.env.DB)
  await queries.providerCredential.upsertCredential(db, {
    workspaceId: ws.workspaceId,
    kind,
    apiUrl: body.apiUrl?.trim() || null,
    apiKeyEnc: encrypt(apiKey, secret),
    // Display only. Enough to recognise which key is stored without being
    // enough to use it.
    last4: apiKey.slice(-4),
    createdBy: ctx.userId,
  })

  return writeJSON({ kind, last4: apiKey.slice(-4) })
})

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceRole(req, ctx, "admin")
  if (ws instanceof Response) return ws

  const kind = kindOf(ctx)
  if (!kind) return writeError("unknown provider", 400)

  const db = getDb(ctx.env.DB)
  await queries.providerCredential.deleteCredential(db, ws.workspaceId, kind)
  return writeJSON({ kind, removed: true })
})
