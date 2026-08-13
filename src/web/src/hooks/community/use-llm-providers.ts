"use client"

import { useQuery } from "@tanstack/react-query"
import { listCommunityLlmProviders, type LlmProviderEntry } from "@/lib/api"

/**
 * The workspace's configured LLM providers, as the community surface sees them.
 * Returns `last4` only — the key itself never reaches the client.
 */
export function useLlmProviders() {
  const query = useQuery<LlmProviderEntry[]>({
    queryKey: ["community", "llm-providers"],
    queryFn: listCommunityLlmProviders,
    staleTime: 30_000,
  })
  return { providers: query.data ?? [], isLoading: query.isLoading }
}
