import { describe, it, expect } from "vitest";
import { mergeEnvLayers, platformEnv, runtimeContextEnv, describeProvenance, type EnvLayer } from "./spawnEnv";

describe("mergeEnvLayers", () => {
  it("applies non-sensitive layers in ascending precedence (higher wins)", () => {
    const layers: EnvLayer[] = [
      { name: "low", precedence: 10, vars: { A: "low", B: "low" } },
      { name: "high", precedence: 30, vars: { A: "high" } },
      { name: "mid", precedence: 20, vars: { B: "mid" } },
    ];
    const { env } = mergeEnvLayers({}, layers);
    expect(env.A).toBe("high");
    expect(env.B).toBe("mid");
  });

  it("keeps base values unless a layer overrides them", () => {
    const { env } = mergeEnvLayers({ KEEP: "base", OVER: "base" }, [
      { name: "x", precedence: 10, vars: { OVER: "layer" } },
    ]);
    expect(env.KEEP).toBe("base");
    expect(env.OVER).toBe("layer");
  });

  it("skips undefined values so a layer can omit without clobbering", () => {
    const { env } = mergeEnvLayers({ X: "base" }, [{ name: "x", precedence: 10, vars: { X: undefined } }]);
    expect(env.X).toBe("base");
  });

  it("applies sensitive layers AFTER all non-sensitive, regardless of precedence", () => {
    // A non-sensitive layer with higher numeric precedence must NOT beat a
    // sensitive layer with lower numeric precedence.
    const layers: EnvLayer[] = [
      { name: "loud", precedence: 999, vars: { TOKEN: "spoofed" } },
      { name: "credential", precedence: 1, sensitive: true, vars: { TOKEN: "real" } },
    ];
    const { env } = mergeEnvLayers({}, layers);
    expect(env.TOKEN).toBe("real");
  });

  it("records provenance per key", () => {
    const layers: EnvLayer[] = [
      { name: "base-layer", precedence: 10, vars: { A: "1" } },
      { name: "over-layer", precedence: 20, vars: { A: "2", B: "3" } },
    ];
    const { provenance } = mergeEnvLayers({}, layers);
    expect(provenance.A).toBe("over-layer");
    expect(provenance.B).toBe("over-layer");
  });
});

describe("describeProvenance", () => {
  it("redacts keys sourced from a sensitive layer", () => {
    const layers: EnvLayer[] = [
      { name: "public", precedence: 10, vars: { A: "x" } },
      { name: "secret", precedence: 100, sensitive: true, vars: { TOKEN: "y" } },
    ];
    const { provenance } = mergeEnvLayers({}, layers);
    const dump = describeProvenance(layers, provenance);
    expect(dump).toContain("A <- public");
    expect(dump).toContain("TOKEN <- secret (redacted)");
  });
});

describe("platformEnv", () => {
  it("builds all <PREFIX>_* keys and honours the prefix", () => {
    const v = platformEnv("ONECAPTAIN", {
      stateHome: "/home/.onecaptain",
      agentId: "agent_1",
      cliName: "onecaptain",
      serverUrl: "ws://x",
      capabilities: ["send", "read"],
      launchId: "launch_1",
      traceDir: "/trace",
    });
    expect(v.ONECAPTAIN_HOME).toBe("/home/.onecaptain");
    expect(v.ONECAPTAIN_ID).toBe("agent_1");
    // No cliPath → <PREFIX>_CLI falls back to the bare name.
    expect(v.ONECAPTAIN_CLI).toBe("onecaptain");
    expect(v.ONECAPTAIN_SERVER_URL).toBe("ws://x");
    expect(v.ONECAPTAIN_ACTIVE_CAPABILITIES).toBe("send,read");
    expect(v.ONECAPTAIN_LAUNCH_ID).toBe("launch_1");
    expect(v.ONECAPTAIN_CLI_TRANSPORT_TRACE_DIR).toBe("/trace");
  });

  it("sets <PREFIX>_CLI to the ABSOLUTE cliPath when given (agent invokes by path, not bare name)", () => {
    const v = platformEnv("ONECAPTAIN", {
      stateHome: "/home/.onecaptain",
      agentId: "agent_1",
      cliName: "onecaptain",
      cliPath: "/work/.onecaptain/bin/onecaptain",
      capabilities: [],
    });
    // The whole point: ONECAPTAIN_CLI is the absolute shim path, so `$ONECAPTAIN_CLI …`
    // dodges PATH and always hits the injected CLI (never a host `onecaptain`).
    expect(v.ONECAPTAIN_CLI).toBe("/work/.onecaptain/bin/onecaptain");
  });

  it("swaps the prefix", () => {
    const v = platformEnv("MOCK_CLI", {
      stateHome: "/h",
      agentId: "a",
      cliName: "mock-cli",
      capabilities: [],
    });
    expect(v.MOCK_CLI_ID).toBe("a");
    expect(v.MOCK_CLI_LAUNCH_ID).toBeUndefined(); // omitted optional → undefined (skipped on merge)
  });
});

describe("runtimeContextEnv", () => {
  it("returns empty when no context", () => {
    expect(runtimeContextEnv("ONECAPTAIN", undefined)).toEqual({});
  });

  it("maps the full runtime context", () => {
    const v = runtimeContextEnv("ONECAPTAIN", {
      agentId: "a",
      serverId: "s",
      computerId: "c",
      computerName: "name",
      hostname: "host",
      os: "darwin",
      daemonVersion: "1.2.3",
      workspacePath: "/ws",
    });
    expect(v.ONECAPTAIN_CURRENT_AGENT_ID).toBe("a");
    expect(v.ONECAPTAIN_CURRENT_COMPUTER_HOSTNAME).toBe("host");
    expect(v.ONECAPTAIN_CURRENT_WORKSPACE_PATH).toBe("/ws");
  });
});
