import { homedir } from "os";
import { join } from "path";
import type { DevPortProfile } from "@onecaptain/shared";

function resolveBaseDir(): string {
  if (process.env.ONECAPTAIN_PROJECT_ROOT) {
    return join(process.env.ONECAPTAIN_PROJECT_ROOT, ".onecaptain", "self-hosted");
  }
  return join(homedir(), ".onecaptain", "self-hosted");
}

export const SELF_HOSTED_DIR = resolveBaseDir();
export const PID_FILE = join(SELF_HOSTED_DIR, ".pids.json");

// Same shape as @onecaptain/shared's DEV_PORTS (monorepo `pnpm dev`), but a
// distinct value range — self-hosted instances run alongside a developer's
// own checkout, so they can't share ports with it.
export const DEFAULT_PORTS: DevPortProfile = {
  web: 15210,
  emailWorker: 15211,
  wsDo: 15212,
  wakeWorker: 15213,
};

export const WEB_URL = (port: number) => `http://localhost:${port}`;
