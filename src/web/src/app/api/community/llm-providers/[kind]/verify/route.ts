import { NextRequest } from "next/server"
import {
  callProvider,
  isBotProviderKind,
  ProviderCallError,
  queries,
  resolveProviderConfig,
  LlmProviderVerifySchema,
} from "@onecaptain/shared"
import { decrypt } from "@onecaptain/shared/crypto"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers"
import { primaryWorkspaceIdForUser } from "@/lib/community/primary-workspace"

/** Community-surface twin of the workspace verify route. Same contract: a real call. */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const kind = ctx.params?.kind
  if (!kind || !isBotProviderKind(kind)) return writeError("unknown provider", 400)

  const [body, err] = await parseBody(req, LlmProviderVerifySchema)
  if (err) return err

  const secret = ctx.env.ENCRYPTION_KEY
  if (!secret) return writeError("provider keys are not configurable on this deployment", 503)

  const db = getDb(ctx.env.DB)
  const workspaceId = await primaryWorkspaceIdForUser(db, ctx.userId)
  if (!workspaceId) return writeError("no workspace", 400)

  const stored = await queries.providerCredential.getCredentialSecret(db, workspaceId, kind)
  if (!stored) return writeError("no key saved for this provider", 404)

  let apiKey: string
  try {
    apiKey = decrypt(stored.apiKeyEnc, secret)
  } catch {
    return writeError("stored key could not be decrypted — re-enter it", 422)
  }

  const config = resolveProviderConfig({
    providerKind: kind,
    providerApiUrl: stored.apiUrl,
    apiKey,
  })
  if (!config) return writeError("provider is not fully configured", 422)

  try {
    const result = await callProvider(config, {
      system: "You are a connectivity check. Reply with the single word: ok.",
      messages: [{ role: "user", content: "ok" }],
      model: body.model,
      maxTokens: 16,
    })
    return writeJSON({
      ok: true,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })
  } catch (e) {
    const providerError = e instanceof ProviderCallError
    // 200 with ok:false — the check RAN. See the workspace twin for why.
    return writeJSON({
      ok: false,
      kind: providerError ? e.kind : "transient",
      status: providerError ? e.status : null,
      error: e instanceof Error ? e.message : String(e),
    })
  }
})
