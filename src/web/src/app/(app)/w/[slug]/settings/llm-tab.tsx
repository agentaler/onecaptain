"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  listLlmProviders,
  saveLlmProvider,
  removeLlmProvider,
  verifyLlmProvider,
} from "@/lib/api";
import { LlmProviderPanel } from "@/components/community/llm/llm-provider-panel";

/**
 * Workspace-settings mount of the provider panel. Uses the workspace-scoped
 * endpoints, which take an explicit id and are role-gated — the right thing
 * when the user may belong to several workspaces and is administering one.
 */
export function LlmTab() {
  const { workspaceId } = useWorkspace();
  const api = useMemo(
    () => ({
      list: () => listLlmProviders(workspaceId),
      save: (kind: string, data: { apiKey: string; apiUrl?: string | null }) =>
        saveLlmProvider(workspaceId, kind, data),
      remove: (kind: string) => removeLlmProvider(workspaceId, kind),
      verify: (kind: string, model: string) => verifyLlmProvider(workspaceId, kind, model),
    }),
    [workspaceId],
  );
  return <LlmProviderPanel api={api} />;
}
