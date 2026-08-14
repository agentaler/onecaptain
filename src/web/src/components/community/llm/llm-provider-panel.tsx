"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BOT_PROVIDER_KINDS, BOT_PROVIDER_LABELS } from "@onecaptain/shared";
import type { LlmProviderEntry } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Where a workspace brings its own LLM key.
 *
 * Mounted twice: in workspace settings, which knows its workspace id, and on
 * the community surface, which does not and resolves the caller's primary
 * workspace server-side. The only difference is which endpoints it calls, so
 * that is the only thing injected — duplicating this form for the two surfaces
 * would guarantee they drift.
 *
 * An agent resolves its credential in this order: its own key, then this
 * workspace key, then OneCaptain's managed key. So a key saved here powers
 * every agent that has not been pinned to something else.
 *
 * The Test connection button is not decoration. Every way a key can be wrong —
 * a typo, a revoked key, a pasted endpoint that 404s, a model the account
 * cannot reach — otherwise surfaces as an agent that simply never replies, with
 * nothing telling the user why. Verifying here turns all of it into one message
 * while they are still looking at the field.
 */

/** Sensible starting model per provider — editable, not enforced. */
const DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-opus-4-6",
  openai: "gpt-5",
  openrouter: "anthropic/claude-opus-4.6",
  custom: "",
};

/** Shown under the URL field so the format is obvious before they paste. */
const URL_HINT: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  openrouter: "https://openrouter.ai/api",
  custom: "https://api.your-provider.com",
};

type VerifyState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ok"; model: string; inputTokens: number; outputTokens: number }
  | { status: "failed"; error: string };

/** The four calls the panel needs, so each surface supplies its own endpoints. */
export interface LlmProviderApi {
  list: () => Promise<LlmProviderEntry[]>;
  save: (kind: string, data: { apiKey: string; apiUrl?: string | null }) => Promise<unknown>;
  remove: (kind: string) => Promise<unknown>;
  verify: (kind: string, model: string) => Promise<
    | { ok: true; model: string; inputTokens: number; outputTokens: number }
    | { ok: false; kind: string; status: number | null; error: string }
  >;
}

export function LlmProviderPanel({ api }: { api: LlmProviderApi }) {

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<LlmProviderEntry[]>([]);
  const [kind, setKind] = useState<string>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL.anthropic);
  const [saving, setSaving] = useState(false);
  const [verify, setVerify] = useState<VerifyState>({ status: "idle" });

  const current = saved.find((p) => p.kind === kind) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSaved(await api.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load providers");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  // Switching provider resets the transient fields: a key and a verification
  // result belong to the provider they were entered for.
  useEffect(() => {
    setApiKey("");
    setVerify({ status: "idle" });
    setModel(DEFAULT_MODEL[kind] ?? "");
    setApiUrl(saved.find((p) => p.kind === kind)?.apiUrl ?? "");
  }, [kind, saved]);

  const onSave = async () => {
    if (apiKey.trim().length < 8) {
      toast.error("That doesn't look like an API key");
      return;
    }
    setSaving(true);
    try {
      await api.save(kind, { apiKey: apiKey.trim(), apiUrl: apiUrl.trim() || null });
      setApiKey("");
      setVerify({ status: "idle" });
      await load();
      toast.success(`${BOT_PROVIDER_LABELS[kind as keyof typeof BOT_PROVIDER_LABELS]} key saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the key");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    try {
      await api.remove(kind);
      setVerify({ status: "idle" });
      await load();
      toast.success("Key removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the key");
    }
  };

  const onVerify = async () => {
    if (!model.trim()) {
      toast.error("Enter a model to test with");
      return;
    }
    setVerify({ status: "running" });
    try {
      const result = await api.verify(kind, model.trim());
      setVerify(
        result.ok
          ? {
              status: "ok",
              model: result.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
            }
          : { status: "failed", error: result.error },
      );
    } catch (err) {
      setVerify({
        status: "failed",
        error: err instanceof Error ? err.message : "The test call didn't complete",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-xl">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-xl" data-testid="llm-settings">
      <div className="space-y-2">
        <h2 className="text-sm font-medium">LLM provider</h2>
        <p className="text-sm text-muted-foreground">
          Agents in this workspace run on this key. An agent with its own key keeps using
          that one.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Provider</Label>
        <div className="flex flex-wrap gap-2">
          {BOT_PROVIDER_KINDS.map((k) => {
            const configured = saved.some((p) => p.kind === k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                data-testid={`llm-provider-${k}`}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  kind === k
                    ? "border-primary bg-accent text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {BOT_PROVIDER_LABELS[k]}
                {/* Never colour alone — the dot is paired with the label. */}
                {configured && <span className="ml-2 inline-block size-1.5 rounded-full bg-status-online align-middle" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="llm-key">API key</Label>
        <Input
          id="llm-key"
          type="password"
          autoComplete="off"
          data-testid="llm-api-key"
          placeholder={current ? `Saved — ending ${current.last4}` : "Paste your key"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          {current
            ? `A key ending ${current.last4} is saved. Entering a new one replaces it.`
            : "Stored encrypted. It is never shown again after saving."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="llm-url">API base URL</Label>
        <Input
          id="llm-url"
          data-testid="llm-api-url"
          placeholder={URL_HINT[kind] ?? ""}
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          Optional. Leave blank for the provider default — pasting the full endpoint works too.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="llm-model">Model</Label>
        <Input
          id="llm-model"
          data-testid="llm-model"
          placeholder="Model id"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={saving || apiKey.trim().length === 0}>
          {saving ? "Saving…" : current ? "Replace key" : "Save key"}
        </Button>
        <Button
          variant="secondary"
          onClick={onVerify}
          disabled={!current || verify.status === "running"}
          data-testid="llm-test-connection"
        >
          {verify.status === "running" ? "Testing…" : "Test connection"}
        </Button>
        {current && (
          <Button variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>

      {verify.status === "ok" && (
        <div
          className="rounded-lg border border-border bg-card p-4 text-sm"
          data-testid="llm-test-result"
        >
          <p className="font-medium">Connected</p>
          <p className="text-muted-foreground">
            {verify.model} answered — {verify.inputTokens} tokens in, {verify.outputTokens} out.
          </p>
        </div>
      )}

      {verify.status === "failed" && (
        <div
          className="rounded-lg border border-destructive/40 bg-card p-4 text-sm"
          data-testid="llm-test-result"
        >
          <p className="font-medium text-destructive">Couldn&rsquo;t reach the model</p>
          {/* The provider's own words — "model does not exist" or "insufficient
              quota" tells the user what to fix; a generic message does not. */}
          <p className="text-muted-foreground wrap-break-word">{verify.error}</p>
        </div>
      )}
    </div>
  );
}
