import { describe, expect, it, vi } from "vitest";
import {
  callProvider,
  classifyProviderStatus,
  ProviderCallError,
} from "../../src/community/provider-client";
import type { ProviderConfig } from "../../src/runtime-config";

const anthropic: ProviderConfig = { kind: "cloud", providerId: "anthropic", apiKey: "sk-ant-x" };
const openai: ProviderConfig = { kind: "cloud", providerId: "openai", apiKey: "sk-oai-x" };

const request = {
  system: "You are Ada.",
  messages: [{ role: "user" as const, content: "hi" }],
  model: "claude-opus-4-6",
  maxTokens: 512,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("callProvider", () => {
  it("reads Anthropic's reply and its own token counts", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        content: [{ type: "text", text: "Hello." }],
        model: "claude-opus-4-6-20260101",
        usage: { input_tokens: 12, output_tokens: 4 },
      }),
    );

    const result = await callProvider(anthropic, request, fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({
      text: "Hello.",
      inputTokens: 12,
      outputTokens: 4,
      model: "claude-opus-4-6-20260101",
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-x");
    expect(headers["anthropic-version"]).toBeTruthy();
    // Anthropic takes the system prompt at the top level, NOT as a message.
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe("You are Ada.");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.max_tokens).toBe(512);
  });

  it("reads an OpenAI-shaped reply and folds the system prompt into messages", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: "Hi there." } }],
        model: "gpt-5",
        usage: { prompt_tokens: 20, completion_tokens: 7 },
      }),
    );

    const result = await callProvider(openai, request, fetchImpl as unknown as typeof fetch);

    expect(result).toMatchObject({ text: "Hi there.", inputTokens: 20, outputTokens: 7 });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-oai-x");
    const body = JSON.parse(init.body as string);
    expect(body.system).toBeUndefined();
    expect(body.messages[0]).toEqual({ role: "system", content: "You are Ada." });
  });

  it("routes OpenRouter to its own host but keeps the OpenAI shape", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    await callProvider(
      { kind: "cloud", providerId: "openrouter", apiKey: "k" },
      request,
      fetchImpl as unknown as typeof fetch,
    );
    expect((fetchImpl.mock.calls[0] as [string, RequestInit])[0]).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
  });

  it("honours an apiUrl override, which is how a DeepSeek-style endpoint is reached", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    await callProvider(
      { kind: "custom", apiUrl: "https://api.deepseek.com/", apiKey: "k" },
      request,
      fetchImpl as unknown as typeof fetch,
    );
    expect((fetchImpl.mock.calls[0] as [string, RequestInit])[0]).toBe(
      "https://api.deepseek.com/v1/chat/completions",
    );
  });

  it("reports zero rather than a guess when the provider omits usage", async () => {
    // A missing meter reading is not a free call. Zeros are visibly wrong;
    // an invented number would quietly become someone's invoice.
    const fetchImpl = vi.fn(async () => jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    const result = await callProvider(openai, request, fetchImpl as unknown as typeof fetch);
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });

  it("classifies a bad key as permanent so it cannot retry forever", async () => {
    const fetchImpl = vi.fn(async () => new Response("invalid api key", { status: 401 }));
    const err = await callProvider(anthropic, request, fetchImpl as unknown as typeof fetch).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ProviderCallError);
    expect((err as ProviderCallError).kind).toBe("permanent");
    expect((err as ProviderCallError).status).toBe(401);
  });

  it("classifies a rate limit and a provider fault as transient", async () => {
    for (const status of [429, 503]) {
      const fetchImpl = vi.fn(async () => new Response("busy", { status }));
      const err = await callProvider(openai, request, fetchImpl as unknown as typeof fetch).catch(
        (e: unknown) => e,
      );
      expect((err as ProviderCallError).kind).toBe("transient");
    }
  });

  it("treats a thrown fetch as transient — a network fault is not a bad request", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const err = await callProvider(openai, request, fetchImpl as unknown as typeof fetch).catch(
      (e: unknown) => e,
    );
    expect((err as ProviderCallError).kind).toBe("transient");
    expect((err as ProviderCallError).status).toBeNull();
  });

  it("does not leak the API key into the error message", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 403 }));
    const err = (await callProvider(anthropic, request, fetchImpl as unknown as typeof fetch).catch(
      (e: unknown) => e,
    )) as ProviderCallError;
    expect(err.message).not.toContain("sk-ant-x");
  });
});

describe("classifyProviderStatus", () => {
  it("splits retryable from terminal", () => {
    expect(classifyProviderStatus(429)).toBe("transient");
    expect(classifyProviderStatus(408)).toBe("transient");
    expect(classifyProviderStatus(500)).toBe("transient");
    expect(classifyProviderStatus(401)).toBe("permanent");
    expect(classifyProviderStatus(403)).toBe("permanent");
    expect(classifyProviderStatus(404)).toBe("permanent");
    expect(classifyProviderStatus(400)).toBe("permanent");
  });
});
