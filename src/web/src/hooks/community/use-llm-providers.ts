"use client"

import { useQuery } from "@tanstack/react-query"
import { listCommunityLlmProviders, type CommunityLlmProviders } from "@/lib/api"

/**
 * The workspace's configured LLM providers, as the community surface sees them.
 * Returns `last4` only — the key itself never reaches the client.
 *
 * `platformFallback` defaults to FALSE while the query is in flight, which is
 * the safe direction: it can briefly show a key as needed when one is not, but
 * it can never invite someone to create an agent that would have nothing to run
 * on.
 */
export function useLlmProviders() {
  const query = useQuery<CommunityLlmProviders>({
    queryKey: ["community", "llm-providers"],
    queryFn: listCommunityLlmProviders,
    staleTime: 30_000,
  })
  return {
    providers: query.data?.providers ?? [],
    platformFallback: query.data?.platformFallback ?? false,
    isLoading: query.isLoading,
  }
}
