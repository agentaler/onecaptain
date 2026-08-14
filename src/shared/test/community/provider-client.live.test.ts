import { describe, expect, it } from "vitest";
import { callProvider } from "../../src/community/provider-client";
import type { ProviderConfig } from "../../src/runtime-config";

/**
 * The one test that proves the shipped client really talks to an LLM.
 *
 * Everything else in this suite mocks `fetch`, which verifies the request we
 * BUILD and the response we PARSE but can never catch the class of bug that
 * only a real provider reveals — a wrong path, a rejected parameter name, an
 * auth header the vendor does not accept. The doubled-URL bug that motivated
 * this file passed every mocked test in the suite.
 *
 * Skipped unless a real endpoint is configured, so CI without a key stays
 * green. It is deliberately NOT a fixture or a recorded cassette: the point is
 * to hit the network.
 *
 * Configure with:
 *   AGENTALER_LLM_API_URL   base or full endpoint (both must work — that IS the test)
 *   AGENTALER_LLM_API_KEY
 *   AGENTALER_LLM_MODEL
 */
const apiUrl = process.env.AGENTALER_LLM_API_URL;
const apiKey = process.env.AGENTALER_LLM_API_KEY;
const model = process.env.AGENTALER_LLM_MODEL;
const configured = Boolean(apiUrl && apiKey && model);

describe.skipIf(!configured)("callProvider against a real provider", () => {
  const config: ProviderConfig = { kind: "custom", apiUrl: apiUrl!, apiKey: apiKey! };

  it("returns a real reply and the provider's own token counts", async () => {
    const result = await callProvider(config, {
      system: "You are a test fixture. Answer in at most three words.",
      messages: [{ role: "user", content: "Say hello." }],
      model: model!,
      maxTokens: 32,
    });

    expect(result.text.trim().length).toBeGreaterThan(0);
    // Non-zero counts are what makes the usage ledger meaningful. Zeros here
    // would mean we are parsing the wrong field off a real response — exactly
    // the mistake a mocked test cannot catch, since the mock supplies the
    // shape we already assumed.
    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.outputTokens).toBeGreaterThan(0);
    expect(result.model.length).toBeGreaterThan(0);
  }, 60_000);

  it("reaches the same endpoint whether the URL is a base or the full path", async () => {
    // The regression this file exists for. Both spellings must resolve to one
    // working endpoint; before the fix the pasted-full form 404'd.
    const base = apiUrl!.replace(/\/(v1\/)?chat\/completions\/?$/i, "");
    const full = `${base}/v1/chat/completions`;

    for (const candidate of [base, full]) {
      const result = await callProvider(
        { kind: "custom", apiUrl: candidate, apiKey: apiKey! },
        {
          system: "You are a test fixture.",
          messages: [{ role: "user", content: "Reply with the word ok." }],
          model: model!,
          maxTokens: 16,
        },
      );
      expect(result.outputTokens).toBeGreaterThan(0);
    }
  }, 90_000);

  it("surfaces a rejected key as a permanent failure, not a retry loop", async () => {
    // The other half of "does it really call the provider": a bad credential
    // must come back classified so the wake consumer acks instead of retrying
    // a key that will never work.
    const err = await callProvider(
      { kind: "custom", apiUrl: apiUrl!, apiKey: "sk-definitely-not-a-real-key" },
      {
        system: "x",
        messages: [{ role: "user", content: "x" }],
        model: model!,
        maxTokens: 8,
      },
    ).catch((e: unknown) => e as Error);

    expect(err).toBeInstanceOf(Error);
    expect((err as { kind?: string }).kind).toBe("permanent");
  }, 60_000);
});
