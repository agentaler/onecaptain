import { describe, it, expect } from "vitest";
import { resolveLaunchFields } from "./runtimeConfig";
import { makeRuntimeConfig } from "./runtimeConfig";
import { buildAntigravityArgs } from "./drivers/antigravity";
import type { LaunchContext } from "./types";

describe("resolveLaunchFields — model id resolution across runtimes", () => {
  for (const runtime of ["claude", "codex", "gemini", "kimi"]) {
    it(`${runtime}: {kind:"named",name:"opus"} → f.model === "opus"`, () => {
      const f = resolveLaunchFields(makeRuntimeConfig({ runtime, model: { kind: "named", name: "opus" } }));
      expect(f.model).toBe("opus");
    });
  }

  it("claude: a custom model additionally sets ANTHROPIC_CUSTOM_MODEL_OPTION", () => {
    const f = resolveLaunchFields(makeRuntimeConfig({ runtime: "claude", model: { kind: "custom", name: "my-ft" } }));
    expect(f.model).toBe("my-ft");
    expect(f.providerEnv.ANTHROPIC_CUSTOM_MODEL_OPTION).toBe("my-ft");
  });

  it("codex: a custom model does NOT set the claude-specific env", () => {
    const f = resolveLaunchFields(makeRuntimeConfig({ runtime: "codex", model: { kind: "custom", name: "my-ft" } }));
    expect(f.model).toBe("my-ft");
    expect(f.providerEnv.ANTHROPIC_CUSTOM_MODEL_OPTION).toBeUndefined();
  });

  it("default model → f.model is undefined", () => {
    const f = resolveLaunchFields(makeRuntimeConfig({ runtime: "gemini" }));
    expect(f.model).toBeUndefined();
  });
});

describe("antigravity — discards the model at launch", () => {
  it("buildAntigravityArgs emits no model arg even when a model is set", () => {
    const ctx = {
      workingDirectory: "/tmp",
      agentId: "a1",
      standingPrompt: "",
      prompt: "hi",
      config: { runtimeConfig: makeRuntimeConfig({ runtime: "antigravity", model: { kind: "named", name: "opus" } }) },
    } as unknown as LaunchContext;
    const args = buildAntigravityArgs(ctx);
    expect(args).not.toContain("--model");
    expect(args.join(" ")).not.toContain("opus");
  });
});

describe("resolveLaunchFields — cloud provider env delivery", () => {
  it("anthropic key → ANTHROPIC_API_KEY in the protected providerEnv layer", () => {
    const f = resolveLaunchFields(
      makeRuntimeConfig({
        runtime: "claude",
        provider: { kind: "cloud", providerId: "anthropic", apiKey: "sk-ant" },
      })
    );
    expect(f.providerEnv.ANTHROPIC_API_KEY).toBe("sk-ant");
    expect(f.providerEnv.ANTHROPIC_BASE_URL).toBeUndefined();
  });

  it("anthropic with apiUrl also sets ANTHROPIC_BASE_URL", () => {
    const f = resolveLaunchFields(
      makeRuntimeConfig({
        runtime: "claude",
        provider: { kind: "cloud", providerId: "anthropic", apiKey: "sk-ant", apiUrl: "https://proxy.example" },
      })
    );
    expect(f.providerEnv.ANTHROPIC_BASE_URL).toBe("https://proxy.example");
  });

  it("openai / openrouter map to their key envs regardless of runtime", () => {
    const openai = resolveLaunchFields(
      makeRuntimeConfig({
        runtime: "codex",
        provider: { kind: "cloud", providerId: "openai", apiKey: "sk-oai" },
      })
    );
    expect(openai.providerEnv.OPENAI_API_KEY).toBe("sk-oai");

    const openrouter = resolveLaunchFields(
      makeRuntimeConfig({
        runtime: "opencode",
        provider: { kind: "cloud", providerId: "openrouter", apiKey: "sk-or" },
      })
    );
    expect(openrouter.providerEnv.OPENROUTER_API_KEY).toBe("sk-or");
  });

  it("host envVars cannot shadow cloud-provider-controlled keys", () => {
    const f = resolveLaunchFields(
      makeRuntimeConfig({
        runtime: "claude",
        provider: { kind: "cloud", providerId: "anthropic", apiKey: "sk-real" },
        envVars: {
          ANTHROPIC_API_KEY: "sk-evil",
          OPENAI_API_KEY: "sk-evil",
          OPENROUTER_API_KEY: "sk-evil",
          OPENAI_BASE_URL: "https://evil.example",
          HARMLESS: "ok",
        },
      })
    );
    expect(f.envVars.ANTHROPIC_API_KEY).toBeUndefined();
    expect(f.envVars.OPENAI_API_KEY).toBeUndefined();
    expect(f.envVars.OPENROUTER_API_KEY).toBeUndefined();
    expect(f.envVars.OPENAI_BASE_URL).toBeUndefined();
    expect(f.envVars.HARMLESS).toBe("ok");
    expect(f.providerEnv.ANTHROPIC_API_KEY).toBe("sk-real");
  });
});
