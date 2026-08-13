import { apiFetch, wsQuery } from "./client";

/** A configured provider as the UI sees it — `last4` only, never the key. */
export interface LlmProviderEntry {
  id: string;
  kind: string;
  apiUrl: string | null;
  last4: string;
  createdAt: string;
  updatedAt: string;
}

export const listLlmProviders = (workspaceId: string) =>
  apiFetch<{ providers: LlmProviderEntry[] }>(`/api/llm-providers${wsQuery(workspaceId)}`).then(
    (r) => r.providers,
  );

export const saveLlmProvider = (
  workspaceId: string,
  kind: string,
  data: { apiKey: string; apiUrl?: string | null },
) =>
  apiFetch<{ kind: string; last4: string }>(
    `/api/llm-providers/${encodeURIComponent(kind)}${wsQuery(workspaceId)}`,
    { method: "PUT", body: JSON.stringify(data) },
  );

export const removeLlmProvider = (workspaceId: string, kind: string) =>
  apiFetch<{ kind: string; removed: boolean }>(
    `/api/llm-providers/${encodeURIComponent(kind)}${wsQuery(workspaceId)}`,
    { method: "DELETE" },
  );

/**
 * Result of a real call to the provider. `ok: false` is a SUCCESSFUL request
 * that produced a failing check — the route answers 200 either way, so a failed
 * key is distinguishable from a broken endpoint.
 */
export type LlmProviderVerifyResult =
  | { ok: true; model: string; inputTokens: number; outputTokens: number }
  | { ok: false; kind: string; status: number | null; error: string };

export const verifyLlmProvider = (workspaceId: string, kind: string, model: string) =>
  apiFetch<LlmProviderVerifyResult>(
    `/api/llm-providers/${encodeURIComponent(kind)}/verify${wsQuery(workspaceId)}`,
    { method: "POST", body: JSON.stringify({ model }) },
  );
