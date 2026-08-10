/**
 * The single owner of stored-provider ↔ `ProviderConfig` translation, the
 * provider sibling of `bot-model.ts`'s `resolveModelConfig`.
 *
 * Storage (`community_bot_binding.provider_kind` / `provider_api_url` /
 * `provider_api_key_enc`) speaks nullable strings; the API key is encrypted at
 * rest (AES-256-GCM, `@onecaptain/shared/crypto`) and decrypted only by the
 * caller at wake/switch time. `ProviderConfig` (the structured shape the
 * daemon consumes) is constructed in exactly ONE place — `resolveProviderConfig`
 * — so the wake dispatcher and every bot-mutating route cannot drift on how a
 * stored provider maps to `{ kind }`.
 *
 * This module is browser-safe on purpose: it never imports node:crypto. The
 * key crosses this boundary already decrypted (`apiKey` plaintext), and only
 * server-side callers hold `ENCRYPTION_KEY`.
 */

import type { ProviderConfig, CloudProviderId } from "../runtime-config";
import { CLOUD_PROVIDER_IDS } from "../runtime-config";

/** Stored kind for a custom Anthropic-compatible endpoint. */
export const PROVIDER_KIND_CUSTOM = "custom";

/** Every storable `provider_kind` value ("" / null means runtime default). */
export const BOT_PROVIDER_KINDS = [...CLOUD_PROVIDER_IDS, PROVIDER_KIND_CUSTOM] as const;
export type BotProviderKind = (typeof BOT_PROVIDER_KINDS)[number];

export function isBotProviderKind(v: string): v is BotProviderKind {
  return (BOT_PROVIDER_KINDS as readonly string[]).includes(v);
}

/** Human labels for the provider picker. */
export const BOT_PROVIDER_LABELS: Record<BotProviderKind, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  custom: "Custom endpoint",
};

/**
 * The ONLY place a `ProviderConfig` is constructed from stored binding state.
 * `null`/empty kind means the runtime's own auth (returns `undefined` so
 * `makeRuntimeConfig` omits `provider` entirely). A stored kind without a
 * decryptable key also resolves to `undefined` — a half-configured provider
 * must degrade to the runtime default, never to a broken launch.
 */
export function resolveProviderConfig(stored: {
  providerKind: string | null;
  providerApiUrl: string | null;
  apiKey: string | null;
}): ProviderConfig | undefined {
  const kind = (stored.providerKind ?? "").trim();
  if (kind.length === 0) return undefined;
  const apiKey = (stored.apiKey ?? "").trim();
  if (apiKey.length === 0) return undefined;
  const apiUrl = (stored.providerApiUrl ?? "").trim();

  if (kind === PROVIDER_KIND_CUSTOM) {
    if (apiUrl.length === 0) return undefined;
    return { kind: "custom", apiUrl, apiKey };
  }
  if ((CLOUD_PROVIDER_IDS as readonly string[]).includes(kind)) {
    return {
      kind: "cloud",
      providerId: kind as CloudProviderId,
      apiKey,
      apiUrl: apiUrl.length > 0 ? apiUrl : undefined,
    };
  }
  return undefined;
}
