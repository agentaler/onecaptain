"use client"

import { useMemo } from "react"
import {
  listCommunityLlmProviders,
  saveCommunityLlmProvider,
  removeCommunityLlmProvider,
  verifyCommunityLlmProvider,
} from "@/lib/api"
import { LlmProviderPanel } from "@/components/community/llm/llm-provider-panel"
import { useBreakpoint } from "@/hooks/use-mobile"
import { useUiHandlers } from "@/stores/community"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

/**
 * Where agents get their LLM key, sitting exactly where `/c/me/machines` does —
 * because it is the thing that replaces it. An agent needs a key here, not a
 * machine there.
 */
export default function MeLlmPage() {
  const bp = useBreakpoint()
  const uiHandlers = useUiHandlers()
  const api = useMemo(
    () => ({
      list: () => listCommunityLlmProviders().then((r) => r.providers),
      save: saveCommunityLlmProvider,
      remove: removeCommunityLlmProvider,
      verify: verifyCommunityLlmProvider,
    }),
    [],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border/50 px-3 sm:px-4 py-2">
        {bp === "mobile" && (
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => uiHandlers.goBackMobile?.()}
            aria-label="Back"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <h1 className="text-sm font-medium">LLM provider</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto thin-scrollbar p-4 sm:p-6">
        <LlmProviderPanel api={api} />
      </div>
    </div>
  )
}
