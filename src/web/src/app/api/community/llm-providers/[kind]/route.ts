import { NextRequest } from "next/server"
import { queries, isBotProviderKind, LlmProviderUpsertSchema } from "@onecaptain/shared"
import { encrypt } from "@onecaptain/shared/crypto"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers"
import { primaryWorkspaceIdForUser } from "@/lib/community/primary-workspace"

/**
 * Set or remove the key from the community surface.
 *
 * No role gate here, unlike the workspace-settings twin: `/c` resolves the
 * caller's OWN primary workspace, so a member can only ever act on a workspace
 * they belong to, and the personal workspace every user gets at signup is one
 * they own. A member of someone else's team who should not be changing its
 * billing-bearing key uses the workspace settings surface, which is role-gated.
 */
export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const kind = ctx.params?.kind
  if (!kind || !isBotProviderKind(kind)) return writeError("unknown provider", 400)

  const [body, err] = await parseBody(req, LlmProviderUpsertSchema)
  if (err) return err

  const secret = ctx.env.ENCRYPTION_KEY
  if (!secret) return writeError("provider keys are not configurable on this deployment", 503)

  const db = getDb(ctx.env.DB)
  const workspaceId = await primaryWorkspaceIdForUser(db, ctx.userId)
  if (!workspaceId) return writeError("no workspace to attach this key to", 400)

  const apiKey = body.apiKey.trim()
  await queries.providerCredential.upsertCredential(db, {
    workspaceId,
    kind,
    apiUrl: body.apiUrl?.trim() || null,
    apiKeyEnc: encrypt(apiKey, secret),
    last4: apiKey.slice(-4),
    createdBy: ctx.userId,
  })

  return writeJSON({ kind, last4: apiKey.slice(-4) })
})

export const DELETE = withAuth(async (_req: NextRequest, ctx) => {
  const kind = ctx.params?.kind
  if (!kind || !isBotProviderKind(kind)) return writeError("unknown provider", 400)

  const db = getDb(ctx.env.DB)
  const workspaceId = await primaryWorkspaceIdForUser(db, ctx.userId)
  if (!workspaceId) return writeError("no workspace", 400)

  await queries.providerCredential.deleteCredential(db, workspaceId, kind)
  return writeJSON({ kind, removed: true })
})
