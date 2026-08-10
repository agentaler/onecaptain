"use client"

import { useEffect, useState } from "react"
import {
  BOT_PROVIDER_KINDS,
  BOT_PROVIDER_LABELS,
  PROVIDER_KIND_CUSTOM,
  type BotProviderKind,
} from "@onecaptain/shared"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/select"

const PROVIDER_SELECT_DEFAULT = "__default__"

/**
 * What the sheet submits for the provider attachment.
 * `undefined` — untouched (omit from the PATCH);
 * `null` — clear the attachment;
 * object — set/replace it (requires a freshly typed key).
 */
export type CloudProviderPatch =
  | { kind: BotProviderKind; apiKey: string; apiUrl?: string }
  | null
  | undefined

/**
 * Per-bot cloud LLM provider picker: runtime's own auth (default), a
 * first-party cloud provider (Anthropic / OpenAI / OpenRouter), or a custom
 * Anthropic-compatible endpoint. The API key is write-only — a saved key is
 * indicated, never displayed — so the key input always starts empty and an
 * untouched form submits `undefined` (no PATCH field).
 */
export function CloudProviderField({
  savedKind,
  hasSavedKey,
  onChange,
  disabled,
}: {
  savedKind: string | null
  hasSavedKey: boolean
  onChange: (patch: CloudProviderPatch) => void
  disabled?: boolean
}) {
  const seedKind = savedKind && hasSavedKey ? savedKind : PROVIDER_SELECT_DEFAULT
  const [selectValue, setSelectValue] = useState(seedKind)
  const [apiKey, setApiKey] = useState("")
  const [apiUrl, setApiUrl] = useState("")

  // Re-seed when the edit target's saved state changes externally.
  useEffect(() => {
    setSelectValue(seedKind)
    setApiKey("")
    setApiUrl("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKind, hasSavedKey])

  function emit(kind: string, key: string, url: string) {
    if (kind === PROVIDER_SELECT_DEFAULT) {
      // Selecting Default over a saved attachment clears it; over nothing,
      // it's a no-op.
      onChange(savedKind && hasSavedKey ? null : undefined)
      return
    }
    const trimmedKey = key.trim()
    if (trimmedKey.length === 0) {
      // Same kind, no new key typed → keep the saved key untouched. A new
      // kind without a key is incomplete — submit validation catches it.
      onChange(undefined)
      return
    }
    const trimmedUrl = url.trim()
    onChange({
      kind: kind as BotProviderKind,
      apiKey: trimmedKey,
      ...(trimmedUrl.length > 0 ? { apiUrl: trimmedUrl } : {}),
    })
  }

  const isCustom = selectValue === PROVIDER_KIND_CUSTOM
  const isConfigured = selectValue !== PROVIDER_SELECT_DEFAULT
  const keyPlaceholder =
    hasSavedKey && selectValue === savedKind
      ? "Key saved — enter a new key to replace it"
      : "API key"

  const items = [
    { value: PROVIDER_SELECT_DEFAULT, label: "Runtime default (local auth)" },
    ...BOT_PROVIDER_KINDS.map((k) => ({ value: k, label: BOT_PROVIDER_LABELS[k] })),
  ]

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs text-muted-foreground">Cloud LLM provider</Label>
      <Select
        items={items}
        value={selectValue}
        onValueChange={(next: string | null) => {
          const nextValue = next ?? PROVIDER_SELECT_DEFAULT
          setSelectValue(nextValue)
          emit(nextValue, apiKey, apiUrl)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          data-testid="bot-cloud-provider-select"
          className="w-full data-[size=default]:h-11 sm:data-[size=default]:h-8"
        >
          <SelectValue placeholder="Runtime default (local auth)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PROVIDER_SELECT_DEFAULT}>
            Runtime default (local auth)
          </SelectItem>
          <SelectSeparator />
          {BOT_PROVIDER_KINDS.map((k) => (
            <SelectItem key={k} value={k}>
              {BOT_PROVIDER_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isConfigured && (
        <Input
          data-testid="bot-cloud-provider-key-input"
          type="password"
          autoComplete="off"
          value={apiKey}
          disabled={disabled}
          placeholder={keyPlaceholder}
          onChange={(e) => {
            setApiKey(e.target.value)
            emit(selectValue, e.target.value, apiUrl)
          }}
          className="h-11 font-mono sm:h-8"
        />
      )}
      {isCustom && (
        <Input
          data-testid="bot-cloud-provider-url-input"
          value={apiUrl}
          disabled={disabled}
          placeholder="https://api.example.com (Anthropic-compatible)"
          onChange={(e) => {
            setApiUrl(e.target.value)
            emit(selectValue, apiKey, e.target.value)
          }}
          className="h-11 font-mono sm:h-8"
        />
      )}
      {isConfigured && (
        <p className="text-xs text-muted-foreground">
          The key is encrypted at rest and applied on the bot&rsquo;s next wake.
        </p>
      )}
    </div>
  )
}
