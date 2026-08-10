import { hostname } from "os";
import { join } from "path";
import { configDir } from "../lib/config.js";
import { getServerUrl } from "../lib/env.js";
import { getCurrentVersion } from "../lib/version.js";

export function pidFilePath(profile?: string): string {
  const name = profile ? `daemon_${profile}.pid` : "daemon.pid";
  return join(configDir(), name);
}

export function lastUpdateMarkerPath(profile?: string): string {
  const name = profile ? `last_update_${profile}` : "last_update";
  return join(configDir(), name);
}

export function daemonLogDir(): string {
  return join(configDir(), "daemon", "logs");
}

export function sessionRunnerLogDir(): string {
  return join(configDir(), "daemon", "session-runners");
}

export function daemonLogFilePath(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return join(daemonLogDir(), `${y}-${m}-${d}.log`);
}

function parseDuration(s: string): number {
  if (!s) return 0;
  let total = 0;
  const regex = /(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g;
  let match;
  while ((match = regex.exec(s)) !== null) {
    const val = parseFloat(match[1]);
    switch (match[2]) {
      case "ns":
        total += val / 1e6;
        break;
      case "us":
      case "µs":
        total += val / 1e3;
        break;
      case "ms":
        total += val;
        break;
      case "s":
        total += val * 1000;
        break;
      case "m":
        total += val * 60000;
        break;
      case "h":
        total += val * 3600000;
        break;
    }
  }
  return total;
}

export interface DaemonConfig {
  serverURL: string;
  claudePath: string;
  codexPath: string;
  opencodePath: string;
  claudeModel: string;
  codexModel: string;
  opencodeModel: string;
  pollInterval: number;
  wsPollInterval: number;
  heartbeatInterval: number;
  sweepInterval: number;
  agentTimeout: number;
  messageInactivityTimeout: number;
  maxConcurrentTasks: number;
  enableSteering: boolean;
  daemonId: string;
  deviceName: string;
  workspacesRoot: string;
  cliVersion: string;
}

export function loadDaemonConfig(profile?: string): DaemonConfig {
  const h = hostname();
  let daemonId = process.env.ONECAPTAIN_DAEMON_ID || h;
  if (profile && !daemonId.endsWith(`-${profile}`)) {
    daemonId = `${daemonId}-${profile}`;
  }

  const defaultRoot = join(
    configDir(),
    profile ? `workspaces_${profile}` : "workspaces",
  );
  const workspacesRoot = process.env.ONECAPTAIN_WORKSPACES_ROOT || defaultRoot;

  return {
    serverURL: normalizeServerBaseURL(getServerUrl()),
    claudePath: process.env.ONECAPTAIN_CLAUDE_PATH || "claude",
    codexPath: process.env.ONECAPTAIN_CODEX_PATH || "codex",
    opencodePath: process.env.ONECAPTAIN_OPENCODE_PATH || "opencode",
    claudeModel: process.env.ONECAPTAIN_CLAUDE_MODEL || "",
    codexModel: process.env.ONECAPTAIN_CODEX_MODEL || "",
    opencodeModel: process.env.ONECAPTAIN_OPENCODE_MODEL || "",
    pollInterval: parseDuration(
      process.env.ONECAPTAIN_DAEMON_POLL_INTERVAL || "3s",
    ),
    wsPollInterval: parseDuration(process.env.ONECAPTAIN_DAEMON_WS_POLL_INTERVAL || "60s"),
    heartbeatInterval: parseDuration(process.env.ONECAPTAIN_DAEMON_HEARTBEAT_INTERVAL || "15s"),
    sweepInterval: parseDuration(process.env.ONECAPTAIN_DAEMON_SWEEP_INTERVAL || "60s"),
    agentTimeout: parseDuration(process.env.ONECAPTAIN_AGENT_TIMEOUT || "12h"),
    messageInactivityTimeout: parseDuration(process.env.ONECAPTAIN_MESSAGE_INACTIVITY_TIMEOUT || "20m"),
    maxConcurrentTasks: parseInt(
      process.env.ONECAPTAIN_DAEMON_MAX_CONCURRENT_TASKS || "20",
    ),
    enableSteering: process.env.ONECAPTAIN_ENABLE_STEERING === "1",
    daemonId,
    deviceName: process.env.ONECAPTAIN_DAEMON_DEVICE_NAME || h,
    workspacesRoot,
    cliVersion: getCurrentVersion(),
  };
}

export function normalizeServerBaseURL(url: string): string {
  return url
    .replace(/^ws:\/\//, "http://")
    .replace(/^wss:\/\//, "https://")
    .replace(/\/ws$/, "");
}
