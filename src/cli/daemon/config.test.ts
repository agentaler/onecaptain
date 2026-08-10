import { vi, describe, it, expect, afterEach } from "vitest";
import { hostname } from "os";
import { join } from "path";
import { homedir } from "os";
import { loadDaemonConfig, normalizeServerBaseURL, daemonLogFilePath, daemonLogDir, sessionRunnerLogDir } from "./config.js";

const DAEMON_ENV_KEYS = [
  "ONECAPTAIN_SERVER_URL",
  "ONECAPTAIN_PROJECT_ROOT",
  "ONECAPTAIN_DAEMON_POLL_INTERVAL",
  "ONECAPTAIN_AGENT_TIMEOUT",
  "ONECAPTAIN_DAEMON_MAX_CONCURRENT_TASKS",
  "ONECAPTAIN_CLAUDE_PATH",
  "ONECAPTAIN_DAEMON_ID",
  "ONECAPTAIN_WORKSPACES_ROOT",
  "ONECAPTAIN_DAEMON_DEVICE_NAME",
  "ONECAPTAIN_KEEP_ENV_AFTER_TASK",
  "ONECAPTAIN_CODEX_PATH",
  "ONECAPTAIN_OPENCODE_PATH",
  "ONECAPTAIN_CLAUDE_MODEL",
  "ONECAPTAIN_CODEX_MODEL",
  "ONECAPTAIN_OPENCODE_MODEL",
  "ONECAPTAIN_MESSAGE_INACTIVITY_TIMEOUT",
];

afterEach(() => {
  for (const key of DAEMON_ENV_KEYS) {
    delete process.env[key];
  }
});

describe("loadDaemonConfig defaults", () => {
  it("returns correct defaults when no env vars set", () => {
    const cfg = loadDaemonConfig();

    expect(cfg.serverURL).toBe("https://onecaptain.ai");
    expect(cfg.pollInterval).toBe(3000);
    expect(cfg.wsPollInterval).toBe(60000);
    expect(cfg.agentTimeout).toBe(43200000);
    expect(cfg.maxConcurrentTasks).toBe(20);
    expect(cfg.claudePath).toBe("claude");
    expect(cfg.messageInactivityTimeout).toBe(1200000);
  });
});

describe("loadDaemonConfig env overrides", () => {
  it("ONECAPTAIN_SERVER_URL overrides serverURL", () => {
    process.env.ONECAPTAIN_SERVER_URL = "http://remote:9090";
    expect(loadDaemonConfig().serverURL).toBe("http://remote:9090");
  });

  it("ONECAPTAIN_DAEMON_POLL_INTERVAL='5s' → 5000", () => {
    process.env.ONECAPTAIN_DAEMON_POLL_INTERVAL = "5s";
    expect(loadDaemonConfig().pollInterval).toBe(5000);
  });


  it("ONECAPTAIN_DAEMON_MAX_CONCURRENT_TASKS='10' → 10", () => {
    process.env.ONECAPTAIN_DAEMON_MAX_CONCURRENT_TASKS = "10";
    expect(loadDaemonConfig().maxConcurrentTasks).toBe(10);
  });

  it("ONECAPTAIN_MESSAGE_INACTIVITY_TIMEOUT='10m' → 600000", () => {
    process.env.ONECAPTAIN_MESSAGE_INACTIVITY_TIMEOUT = "10m";
    expect(loadDaemonConfig().messageInactivityTimeout).toBe(600000);
  });
});

describe("normalizeServerBaseURL", () => {
  it("converts ws:// to http://", () => {
    expect(normalizeServerBaseURL("ws://localhost:8080")).toBe(
      "http://localhost:8080",
    );
  });

  it("converts wss:// to https://", () => {
    expect(normalizeServerBaseURL("wss://example.com")).toBe(
      "https://example.com",
    );
  });

  it("strips /ws suffix", () => {
    expect(normalizeServerBaseURL("http://example.com/ws")).toBe(
      "http://example.com",
    );
  });

  it("leaves http:// unchanged", () => {
    expect(normalizeServerBaseURL("http://example.com")).toBe(
      "http://example.com",
    );
  });
});

describe("daemonId profile suffix", () => {
  it("uses hostname when no profile", () => {
    const cfg = loadDaemonConfig();
    expect(cfg.daemonId).toBe(hostname());
  });

  it("appends -profile to hostname with profile", () => {
    const cfg = loadDaemonConfig("staging");
    expect(cfg.daemonId).toBe(`${hostname()}-staging`);
  });

  it("doesn't double-append when ONECAPTAIN_DAEMON_ID already has suffix", () => {
    process.env.ONECAPTAIN_DAEMON_ID = `myhost-staging`;
    const cfg = loadDaemonConfig("staging");
    expect(cfg.daemonId).toBe("myhost-staging");
  });
});

describe("daemonLogFilePath", () => {
  it("returns <configDir>/daemon/logs/YYYY-MM-DD.log for a fixed date", () => {
    const d = new Date(2026, 3, 17); // 2026-04-17 local
    const p = daemonLogFilePath(d);
    expect(p).toBe(join(homedir(), ".onecaptain", "daemon", "logs", "2026-04-17.log"));
  });

  it("zero-pads month and day", () => {
    const d = new Date(2026, 0, 5); // 2026-01-05 local
    expect(daemonLogFilePath(d).endsWith("2026-01-05.log")).toBe(true);
  });
});

describe("daemonLogDir — three ONECAPTAIN_PROJECT_ROOT scenarios", () => {
  it("production: ~/.onecaptain/daemon/logs", () => {
    delete process.env.ONECAPTAIN_PROJECT_ROOT;
    expect(daemonLogDir()).toBe(join(homedir(), ".onecaptain", "daemon", "logs"));
  });

  it("dev mode: <PROJECT>/.onecaptain/daemon/logs", () => {
    process.env.ONECAPTAIN_PROJECT_ROOT = "/tmp/my-project/.onecaptain";
    expect(daemonLogDir()).toBe(join("/tmp/my-project/.onecaptain", "daemon", "logs"));
  });

  it("app mode: ~/.onecaptain/self-hosted/daemon/logs", () => {
    process.env.ONECAPTAIN_PROJECT_ROOT = join(homedir(), ".onecaptain", "self-hosted");
    expect(daemonLogDir()).toBe(join(homedir(), ".onecaptain", "self-hosted", "daemon", "logs"));
  });
});

describe("workspacesRoot — three ONECAPTAIN_PROJECT_ROOT scenarios", () => {
  it("production: ~/.onecaptain/workspaces", () => {
    delete process.env.ONECAPTAIN_PROJECT_ROOT;
    const cfg = loadDaemonConfig();
    expect(cfg.workspacesRoot).toBe(join(homedir(), ".onecaptain", "workspaces"));
  });

  it("production + profile: ~/.onecaptain/workspaces_{profile}", () => {
    delete process.env.ONECAPTAIN_PROJECT_ROOT;
    const cfg = loadDaemonConfig("dev");
    expect(cfg.workspacesRoot).toBe(
      join(homedir(), ".onecaptain", "workspaces_dev"),
    );
  });

  it("dev mode: <PROJECT>/.onecaptain/workspaces", () => {
    process.env.ONECAPTAIN_PROJECT_ROOT = "/tmp/my-project/.onecaptain";
    const cfg = loadDaemonConfig();
    expect(cfg.workspacesRoot).toBe(
      join("/tmp/my-project/.onecaptain", "workspaces"),
    );
  });

  it("dev mode + profile: <PROJECT>/.onecaptain/workspaces_{profile}", () => {
    process.env.ONECAPTAIN_PROJECT_ROOT = "/tmp/my-project/.onecaptain";
    const cfg = loadDaemonConfig("staging");
    expect(cfg.workspacesRoot).toBe(
      join("/tmp/my-project/.onecaptain", "workspaces_staging"),
    );
  });

  it("app mode: ~/.onecaptain/self-hosted/workspaces", () => {
    process.env.ONECAPTAIN_PROJECT_ROOT = join(homedir(), ".onecaptain", "self-hosted");
    const cfg = loadDaemonConfig();
    expect(cfg.workspacesRoot).toBe(
      join(homedir(), ".onecaptain", "self-hosted", "workspaces"),
    );
  });

  it("ONECAPTAIN_WORKSPACES_ROOT overrides all defaults", () => {
    process.env.ONECAPTAIN_PROJECT_ROOT = "/tmp/my-project/.onecaptain";
    process.env.ONECAPTAIN_WORKSPACES_ROOT = "/custom/path";
    const cfg = loadDaemonConfig();
    expect(cfg.workspacesRoot).toBe("/custom/path");
  });
});

describe("sessionRunnerLogDir — three ONECAPTAIN_PROJECT_ROOT scenarios", () => {
  it("production: ~/.onecaptain/daemon/session-runners", () => {
    delete process.env.ONECAPTAIN_PROJECT_ROOT;
    expect(sessionRunnerLogDir()).toBe(
      join(homedir(), ".onecaptain", "daemon", "session-runners"),
    );
  });

  it("dev mode: <PROJECT>/.onecaptain/daemon/session-runners", () => {
    process.env.ONECAPTAIN_PROJECT_ROOT = "/tmp/my-project/.onecaptain";
    expect(sessionRunnerLogDir()).toBe(
      join("/tmp/my-project/.onecaptain", "daemon", "session-runners"),
    );
  });

  it("app mode: ~/.onecaptain/self-hosted/daemon/session-runners", () => {
    process.env.ONECAPTAIN_PROJECT_ROOT = join(homedir(), ".onecaptain", "self-hosted");
    expect(sessionRunnerLogDir()).toBe(
      join(homedir(), ".onecaptain", "self-hosted", "daemon", "session-runners"),
    );
  });
});
