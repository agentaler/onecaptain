"use client"

import type { CommunityMachineSummary } from "@onecaptain/shared"

import { ProviderLogo } from "@/components/provider-logo"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ModelField } from "./model-field"

export type BotRuntimeOption = {
  id: string
  unhealthy: boolean
}

/**
 * Normalize a machine's runtimes into `{ id, unhealthy }`, healthy-first.
 *
 * A legacy CommunityMachineSummary cached client-side may still be missing
 * availableRuntimes, or a runtime entry may still be a bare string
 * (pre-health-status shape). Normalize both instead of hiding unhealthy
 * runtimes outright, so the radio card can show *why* an option is disabled.
 * Available runtimes sort first — the ones you can actually pick should never
 * be buried below ones you can't.
 */
export function normalizeRuntimes(machine: CommunityMachineSummary | undefined): BotRuntimeOption[] {
  const rt = machine?.availableRuntimes ?? []
  const normalized = rt.map((r) =>
    typeof r === "string"
      ? { id: r, unhealthy: false }
      : { id: (r as { id: string }).id, unhealthy: (r as { status?: string }).status === "unhealthy" },
  )
  return normalized.sort((a, b) => Number(a.unhealthy) - Number(b.unhealthy))
}

export function BotRuntimeFields({
  options,
  runtime,
  model,
  onRuntimeChange,
  onModelChange,
  radioName = "edit-bot-runtime",
  motionTargetPrefix,
  modelMotionTarget,
  runtimeOptionClassName,
  modelClassName,
  runtimeError,
  disableUnhealthyOptions = false,
}: {
  options: BotRuntimeOption[]
  runtime: string
  model: string | null
  onRuntimeChange: (runtime: string) => void
  onModelChange: (model: string | null) => void
  radioName?: string
  motionTargetPrefix?: string
  modelMotionTarget?: string
  runtimeOptionClassName?: (runtime: string) => string | undefined
  modelClassName?: string
  runtimeError?: string
  disableUnhealthyOptions?: boolean
}) {
  function selectRuntime(next: string) {
    if (next === runtime) return
    onRuntimeChange(next)
    onModelChange(null)
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Runtime</Label>
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            This machine has no runtimes installed.
          </p>
        ) : (
          <div
            className="flex flex-col gap-2"
            role="radiogroup"
            aria-label="Runtime"
            data-testid="bot-provider-picker"
          >
            {options.map((option) => {
              const selected = runtime === option.id
              const disabled = option.unhealthy && (disableUnhealthyOptions || !selected)
              return (
                <label
                  key={option.id}
                  data-motion-target={
                    motionTargetPrefix ? `${motionTargetPrefix}-${option.id}` : undefined
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-foreground/20",
                    disabled && "opacity-40 pointer-events-none",
                    runtimeOptionClassName?.(option.id),
                  )}
                >
                  <input
                    type="radio"
                    name={radioName}
                    value={option.id}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => selectRuntime(option.id)}
                    className="accent-primary size-3.5"
                  />
                  <ProviderLogo provider={option.id} className="size-4 shrink-0" />
                  <span className="text-sm">{option.id}</span>
                  {option.unhealthy && (
                    <span className="ml-auto text-xs text-muted-foreground">unavailable</span>
                  )}
                </label>
              )
            })}
          </div>
        )}
        {runtimeError ? <p className="text-xs text-destructive">{runtimeError}</p> : null}
      </div>
      {runtime ? (
        <div data-motion-target={modelMotionTarget} className={modelClassName}>
          <ModelField runtime={runtime} value={model} onChange={onModelChange} />
        </div>
      ) : null}
    </>
  )
}
