import { describe, it, expect } from "vitest";
import { resolveProviderConfig, isBotProviderKind, BOT_PROVIDER_KINDS } from "./bot-provider";

describe("resolveProviderConfig", () => {
  it("null/empty kind → undefined (runtime default)", () => {
    expect(resolveProviderConfig({ providerKind: null, providerApiUrl: null, apiKey: "sk-x" })).toBeUndefined();
    expect(resolveProviderConfig({ providerKind: "", providerApiUrl: null, apiKey: "sk-x" })).toBeUndefined();
    expect(resolveProviderConfig({ providerKind: "  ", providerApiUrl: null, apiKey: "sk-x" })).toBeUndefined();
  });

  it("a kind without a key degrades to undefined, never a broken config", () => {
    expect(resolveProviderConfig({ providerKind: "anthropic", providerApiUrl: null, apiKey: null })).toBeUndefined();
    expect(resolveProviderConfig({ providerKind: "anthropic", providerApiUrl: null, apiKey: "  " })).toBeUndefined();
  });

  for (const id of ["anthropic", "openai", "openrouter"] as const) {
    it(`${id} + key → cloud config`, () => {
      expect(
        resolveProviderConfig({ providerKind: id, providerApiUrl: null, apiKey: "sk-live" })
      ).toEqual({ kind: "cloud", providerId: id, apiKey: "sk-live", apiUrl: undefined });
    });
  }

  it("cloud kind carries an explicit apiUrl through", () => {
    expect(
      resolveProviderConfig({
        providerKind: "openrouter",
        providerApiUrl: "https://openrouter.example/api",
        apiKey: "sk-or",
      })
    ).toEqual({
      kind: "cloud",
      providerId: "openrouter",
      apiKey: "sk-or",
      apiUrl: "https://openrouter.example/api",
    });
  });

  it("custom requires apiUrl — with it → custom config, without → undefined", () => {
    expect(
      resolveProviderConfig({ providerKind: "custom", providerApiUrl: "https://proxy.example", apiKey: "k" })
    ).toEqual({ kind: "custom", apiUrl: "https://proxy.example", apiKey: "k" });
    expect(
      resolveProviderConfig({ providerKind: "custom", providerApiUrl: null, apiKey: "k" })
    ).toBeUndefined();
    expect(
      resolveProviderConfig({ providerKind: "custom", providerApiUrl: "  ", apiKey: "k" })
    ).toBeUndefined();
  });

  it("an unknown stored kind resolves to undefined", () => {
    expect(
      resolveProviderConfig({ providerKind: "mystery", providerApiUrl: null, apiKey: "k" })
    ).toBeUndefined();
  });

  it("values are trimmed", () => {
    expect(
      resolveProviderConfig({ providerKind: "anthropic", providerApiUrl: " ", apiKey: " sk " })
    ).toEqual({ kind: "cloud", providerId: "anthropic", apiKey: "sk", apiUrl: undefined });
  });
});

describe("isBotProviderKind", () => {
  it("accepts every storable kind and rejects the rest", () => {
    for (const k of BOT_PROVIDER_KINDS) expect(isBotProviderKind(k)).toBe(true);
    expect(isBotProviderKind("google")).toBe(false);
    expect(isBotProviderKind("")).toBe(false);
  });
});
