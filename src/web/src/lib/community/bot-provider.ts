import { decrypt } from "@onecaptain/shared/crypto"
import { resolveProviderConfig, createLogger } from "@onecaptain/shared"
import type { ProviderConfig } from "@onecaptain/shared/runtime-config"

const log = createLogger({ service: "bot-provider" })

/**
 * Decrypt + resolve a bot binding's stored cloud-provider attachment into the
 * `ProviderConfig` a RuntimeConfig push carries. Server-only (imports
 * node:crypto). Any decrypt failure degrades to `undefined` — the launch
 * falls back to the runtime's own auth rather than failing.
 */
export function resolveStoredProviderConfig(
  env: { ENCRYPTION_KEY: string },
  stored: {
    providerKind: string | null
    providerApiUrl: string | null
    providerApiKeyEnc: string | null
  },
): ProviderConfig | undefined {
  if (!stored.providerKind || !stored.providerApiKeyEnc) return undefined
  try {
    return resolveProviderConfig({
      providerKind: stored.providerKind,
      providerApiUrl: stored.providerApiUrl,
      apiKey: decrypt(stored.providerApiKeyEnc, env.ENCRYPTION_KEY),
    })
  } catch (err) {
    log.warn("bot_provider_key_decrypt_failed", { err: String(err) })
    return undefined
  }
}
