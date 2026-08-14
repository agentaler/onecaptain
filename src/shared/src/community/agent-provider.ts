/**
 * Which credential does this agent's provider call use, and who pays for it.
 *
 * One function owns the whole answer so the runtime cannot resolve a key by one
 * rule and bill by another. Resolution order, most specific first:
 *
 *   1. the agent's own key (`community_bot_binding.provider_*`) — an agent
 *      pinned to a particular provider keeps working after its workspace adds a
 *      different one;
 *   2. the workspace credential (`workspace_provider_credential`) — the key a
 *      workspace brings once instead of pasting into every agent;
 *   3. the platform key, when OneCaptain runs the agent on its own account.
 *
 * `billable` is decided here and nowhere else. A call paid for by a key the
 * user supplied — at either level — is metered but never invoiced
 * (`billable: false`); only a platform-key call is billable. Getting this wrong
 * in either direction is a billing bug, so it is one expression in one place.
 */

import { resolveProviderConfig } from "./bot-provider";
import { getCredentialSecret } from "../db/queries/provider-credential";
import type { Database } from "../db/index";
import type { ProviderConfig } from "../runtime-config";

/** Where the key came from — carried for audit and for the usage row. */
export type AgentProviderSource = "bot" | "workspace" | "platform";

export type AgentProviderResolution =
  | {
      state: "ready";
      config: ProviderConfig;
      /** The stored `provider_kind`, recorded on the usage event. */
      kind: string;
      source: AgentProviderSource;
      billable: boolean;
    }
  /**
   * No usable credential anywhere. Permanent by construction: retrying without
   * a key cannot succeed, so the caller must surface it rather than loop.
   */
  | { state: "no_credential" };

export interface AgentProviderEnv {
  /** Secret for decrypting stored keys. Without it, no stored key is usable. */
  ENCRYPTION_KEY?: string;
  /** Keyring, for deployments that have rotated past the single legacy key. */
  ENCRYPTION_KEYS?: string;
  ENCRYPTION_KEY_ACTIVE?: string;
  /** OneCaptain's own key, used when the workspace brings none. */
  PLATFORM_PROVIDER_KIND?: string;
  PLATFORM_PROVIDER_API_KEY?: string;
  PLATFORM_PROVIDER_API_URL?: string;
}

export interface AgentProviderBinding {
  workspaceId: string | null;
  providerKind: string | null;
  providerApiUrl: string | null;
  providerApiKeyEnc: string | null;
}

/**
 * Decrypt lazily so this module stays importable from a browser bundle through
 * the shared barrel — only server-side callers ever reach the import, and only
 * they hold the keys. A decrypt failure yields null (and falls through
 * to the next source) rather than throwing: a corrupt stored key must not take
 * an agent down when a workspace or platform key could still serve it.
 *
 * Goes through the keyring so a value written under a rotated-out key still
 * opens. A deployment that sets only ENCRYPTION_KEY gets a one-key ring and the
 * original behavior.
 */
async function decryptOrNull(ciphertext: string, env: AgentProviderEnv): Promise<string | null> {
  try {
    const [{ decryptWithKeyring }, { parseKeyring }] = await Promise.all([
      import("../utils/crypto"),
      import("../utils/keyring"),
    ]);
    return decryptWithKeyring(ciphertext, parseKeyring(env));
  } catch {
    return null;
  }
}

export async function resolveAgentProvider(
  db: Database,
  binding: AgentProviderBinding,
  env: AgentProviderEnv,
): Promise<AgentProviderResolution> {
  // 1. The agent's own key.
  if (binding.providerKind && binding.providerApiKeyEnc && env.ENCRYPTION_KEY) {
    const apiKey = await decryptOrNull(binding.providerApiKeyEnc, env);
    const config = resolveProviderConfig({
      providerKind: binding.providerKind,
      providerApiUrl: binding.providerApiUrl,
      apiKey,
    });
    if (config) {
      return { state: "ready", config, kind: binding.providerKind, source: "bot", billable: false };
    }
  }

  // 2. The workspace credential. Scoped by workspaceId in the query itself —
  // an agent with no workspace simply has no fallback to reach, which is why
  // this is a guard rather than a post-hoc ownership check.
  if (binding.workspaceId && env.ENCRYPTION_KEY) {
    const kinds = binding.providerKind ? [binding.providerKind] : PREFERRED_WORKSPACE_KINDS;
    for (const kind of kinds) {
      const stored = await getCredentialSecret(db, binding.workspaceId, kind);
      if (!stored) continue;
      const apiKey = await decryptOrNull(stored.apiKeyEnc, env);
      const config = resolveProviderConfig({
        providerKind: stored.kind,
        providerApiUrl: stored.apiUrl,
        apiKey,
      });
      if (config) {
        return { state: "ready", config, kind: stored.kind, source: "workspace", billable: false };
      }
    }
  }

  // 3. The platform key — the only source that produces a billable call.
  if (env.PLATFORM_PROVIDER_KIND && env.PLATFORM_PROVIDER_API_KEY) {
    const config = resolveProviderConfig({
      providerKind: env.PLATFORM_PROVIDER_KIND,
      providerApiUrl: env.PLATFORM_PROVIDER_API_URL ?? null,
      apiKey: env.PLATFORM_PROVIDER_API_KEY,
    });
    if (config) {
      return {
        state: "ready",
        config,
        kind: env.PLATFORM_PROVIDER_KIND,
        source: "platform",
        billable: true,
      };
    }
  }

  return { state: "no_credential" };
}

/**
 * Which workspace credential to try when the agent names no provider of its
 * own. Ordered, not arbitrary: the first configured one wins, so a workspace
 * that stores several keys gets a stable choice instead of one that depends on
 * row order.
 */
const PREFERRED_WORKSPACE_KINDS = ["anthropic", "openai", "openrouter", "custom"] as const;
