/**
 * Direct HTTP clients for the cloud LLM providers an agent can run against,
 * plus the error classification the wake consumer needs to decide retry-vs-ack.
 *
 * Deliberately `fetch` and hand-written request/response shapes rather than
 * `@anthropic-ai/sdk` / `openai`: both pull Node-only transitive dependencies
 * that do not belong in a Workers bundle, and this module needs exactly two
 * request shapes and three response fields. See `plans/cloud-hosted-agents.md`.
 *
 * Three of the four supported providers speak the OpenAI chat-completions
 * shape (OpenAI itself, OpenRouter, and any DeepSeek-style custom endpoint), so
 * they share one client. Anthropic's Messages API is the odd one out: a
 * top-level `system` string instead of a system message, `max_tokens` required,
 * and `usage.input_tokens` / `output_tokens` instead of `prompt_tokens` /
 * `completion_tokens`.
 */

import type { ProviderConfig } from "../runtime-config";

/** One turn of conversation handed to a provider. */
export interface ProviderRequest {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model: string;
  maxTokens: number;
}

export interface ProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** The model the provider says it actually served, when it reports one. */
  model: string;
}

/**
 * Why a provider call failed, in the only two flavours the caller acts on.
 *
 * `transient` — rate limit or provider-side fault. The wake consumer must
 * `retry()`; the agent will answer late rather than not at all.
 * `permanent` — the request or the credential is wrong (bad key, revoked key,
 * unknown model, malformed request). Retrying cannot fix it, so the consumer
 * must `ack()` and surface it, or a single bad key retries forever.
 */
export type ProviderFailureKind = "transient" | "permanent";

export class ProviderCallError extends Error {
  readonly kind: ProviderFailureKind;
  readonly status: number | null;
  constructor(kind: ProviderFailureKind, message: string, status: number | null) {
    super(message);
    this.name = "ProviderCallError";
    this.kind = kind;
    this.status = status;
  }
}

/**
 * HTTP status → retry-or-not.
 *
 * 408/409/429 and every 5xx are transient. Everything else in 4xx is the
 * caller's fault and will fail identically forever — 401/403 (bad or revoked
 * key) most importantly, because that is the case a user actually hits and
 * must be told about rather than silently retried.
 */
export function classifyProviderStatus(status: number): ProviderFailureKind {
  if (status === 408 || status === 409 || status === 429) return "transient";
  if (status >= 500) return "transient";
  return "permanent";
}

const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Join a user-supplied API URL to the path we need.
 *
 * The field is documented as a BASE url, but people paste whatever their
 * provider's docs showed them — which is nearly always the full endpoint. Naive
 * concatenation then produced a doubled path. Confirmed against a live provider:
 *
 *   base  `https://api.fireworks.ai/inference`                        -> 200
 *   full  `https://api.fireworks.ai/inference/v1/chat/completions`    -> 404
 *         (…/v1/chat/completions/v1/chat/completions)
 *
 * A 404 classifies as `permanent`, so the agent just never replied and the user
 * was told nothing — the worst possible shape for a configuration mistake. So
 * accept both: strip any endpoint suffix the user included, then append ours.
 */
function joinApiUrl(base: string, path: string): string {
  let trimmed = base.trim().replace(/\/+$/, "");
  // Longest first — `/v1/chat/completions` must win over `/chat/completions`.
  for (const suffix of ["/v1/chat/completions", "/chat/completions", "/v1/messages", "/messages"]) {
    if (trimmed.toLowerCase().endsWith(suffix)) {
      trimmed = trimmed.slice(0, -suffix.length).replace(/\/+$/, "");
      break;
    }
  }
  return `${trimmed}${path}`;
}

function endpointFor(config: ProviderConfig): { url: string; shape: "anthropic" | "openai" } {
  if (config.kind === "cloud") {
    if (config.providerId === "anthropic") {
      return {
        url: joinApiUrl(config.apiUrl ?? "https://api.anthropic.com", "/v1/messages"),
        shape: "anthropic",
      };
    }
    if (config.providerId === "openrouter") {
      return {
        url: joinApiUrl(config.apiUrl ?? "https://openrouter.ai/api", "/v1/chat/completions"),
        shape: "openai",
      };
    }
    return {
      url: joinApiUrl(config.apiUrl ?? "https://api.openai.com", "/v1/chat/completions"),
      shape: "openai",
    };
  }
  if (config.kind === "custom") {
    // A custom endpoint is OpenAI-shaped by convention — that is what DeepSeek,
    // Fireworks, Together, Groq, vLLM and the rest expose. An Anthropic-compatible
    // custom endpoint should be stored as `anthropic` with an `apiUrl` override.
    return { url: joinApiUrl(config.apiUrl, "/v1/chat/completions"), shape: "openai" };
  }
  throw new ProviderCallError("permanent", `provider kind ${config.kind} cannot be called directly`, null);
}

/**
 * OpenAI renamed the output cap to `max_completion_tokens` and its newer
 * reasoning models REJECT `max_tokens` outright. Every other OpenAI-shaped
 * provider (OpenRouter, Fireworks, DeepSeek, Groq, vLLM…) still takes
 * `max_tokens`, and some do not recognise the new name — so this is keyed on
 * who we are actually talking to, not on the wire shape.
 */
function outputTokenField(config: ProviderConfig): "max_tokens" | "max_completion_tokens" {
  return config.kind === "cloud" && config.providerId === "openai"
    ? "max_completion_tokens"
    : "max_tokens";
}

function authHeaders(config: ProviderConfig, shape: "anthropic" | "openai"): Record<string, string> {
  const apiKey =
    config.kind === "cloud" || config.kind === "custom" || config.kind === "pi-builtin"
      ? config.apiKey
      : "";
  if (shape === "anthropic") {
    return { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION };
  }
  return { authorization: `Bearer ${apiKey}` };
}

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

type OpenAIResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/**
 * Call the provider and return its reply plus the token counts IT reports.
 *
 * The counts are never estimated locally: the provider's own numbers are what
 * a user can reconcile against their provider dashboard, and what a bill has to
 * be defensible against. A response without usage yields zeros rather than a
 * guess — a missing meter reading is not the same as a free call, and a zero is
 * visibly wrong in a way an invented number is not.
 */
export async function callProvider(
  config: ProviderConfig,
  request: ProviderRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult> {
  const { url, shape } = endpointFor(config);
  const body =
    shape === "anthropic"
      ? {
          model: request.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: request.messages,
        }
      : {
          model: request.model,
          [outputTokenField(config)]: request.maxTokens,
          messages: [{ role: "system", content: request.system }, ...request.messages],
        };

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders(config, shape) },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // A thrown fetch is a network fault, never a bad request — always worth
    // another attempt.
    throw new ProviderCallError("transient", `provider request failed: ${String(err)}`, null);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ProviderCallError(
      classifyProviderStatus(response.status),
      `provider returned ${response.status}: ${detail.slice(0, 500)}`,
      response.status,
    );
  }

  const json = (await response.json().catch(() => null)) as unknown;
  if (!json || typeof json !== "object") {
    throw new ProviderCallError("transient", "provider returned a non-JSON body", response.status);
  }

  if (shape === "anthropic") {
    const parsed = json as AnthropicResponse;
    const text = (parsed.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("");
    return {
      text,
      inputTokens: parsed.usage?.input_tokens ?? 0,
      outputTokens: parsed.usage?.output_tokens ?? 0,
      model: parsed.model ?? request.model,
    };
  }

  const parsed = json as OpenAIResponse;
  return {
    text: parsed.choices?.[0]?.message?.content ?? "",
    inputTokens: parsed.usage?.prompt_tokens ?? 0,
    outputTokens: parsed.usage?.completion_tokens ?? 0,
    model: parsed.model ?? request.model,
  };
}
