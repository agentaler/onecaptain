import { NextRequest } from "next/server"
import {
  callProvider,
  isBotProviderKind,
  ProviderCallError,
  queries,
  resolveProviderConfig,
  createLogger,
  LlmProviderVerifySchema,
} from "@onecaptain/shared"
import { decrypt } from "@onecaptain/shared/crypto"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { withWorkspaceRole } from "@/lib/middleware/workspace"
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers"

const log = createLogger({ service: "llm-provider-verify" })

/**
 * Prove the stored key actually works, by making a real call.
 *
 * This exists because every way a provider key can be wrong — a typo, a revoked
 * key, a pasted endpoint that resolves to 404, a model the account cannot reach
 * — otherwise shows up as an agent that simply never replies, with nothing
 * anywhere telling the user why. A 404 from a mis-pasted URL classifies as
 * `permanent`, so it does not even retry. Verifying at save time converts all of
 * that into one legible message while the user is still looking at the field.
 *
 * The provider's own error text is returned verbatim rather than replaced with
 * something friendlier: "model `x` does not exist" or "insufficient quota" tells
 * the user what to do, and a generic "couldn't connect" does not.
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceRole(req, ctx, "admin")
  if (ws instanceof Response) return ws

  const kind = ctx.params?.kind
  if (!kind || !isBotProviderKind(kind)) return writeError("unknown provider", 400)

  const [body, err] = await parseBody(req, LlmProviderVerifySchema)
  if (err) return err

  const secret = ctx.env.ENCRYPTION_KEY
  if (!secret) return writeError("provider keys are not configurable on this deployment", 503)

  const db = getDb(ctx.env.DB)
  const stored = await queries.providerCredential.getCredentialSecret(db, ws.workspaceId, kind)
  if (!stored) return writeError("no key saved for this provider", 404)

  let apiKey: string
  try {
    apiKey = decrypt(stored.apiKeyEnc, secret)
  } catch {
    // A key that cannot be decrypted is unusable and unrecoverable — say so
    // rather than reporting it as a provider failure the user might retry.
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
      // A verification call should cost approximately nothing.
      maxTokens: 16,
    })
    return writeJSON({
      ok: true,
      // What the provider actually served, which is not always what was asked
      // for — an alias or a routed model shows up here.
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })
  } catch (e) {
    const providerError = e instanceof ProviderCallError
    log.warn("llm_provider_verify_failed", {
      category: "llm_provider_verify_failed",
      workspaceId: ws.workspaceId,
      kind,
      status: providerError ? e.status : null,
    })
    return writeJSON(
      {
        ok: false,
        kind: providerError ? e.kind : "transient",
        status: providerError ? e.status : null,
        error: e instanceof Error ? e.message : String(e),
      },
      // 200 with ok:false — the verification RAN and produced a result. A 4xx
      // here would make a failed check indistinguishable from a broken route.
      200,
    )
  }
})
