import { DEFAULT_PORTS, WEB_URL, SELF_HOSTED_DIR } from "./constants.js";
import { readPids } from "./pid.js";

/**
 * Build env vars for spawning @onecaptain/cli subprocesses.
 *
 * Three scenarios — all resolve ONECAPTAIN_PROJECT_ROOT via SELF_HOSTED_DIR:
 *   1. Production install:   ~/.onecaptain/self-hosted
 *   2. Dev mode (monorepo):  <ONECAPTAIN_PROJECT_ROOT>/.onecaptain/self-hosted
 *   3. App mode (npx):       ~/.onecaptain/self-hosted  (same as 1)
 */
export function buildCliEnv(webPort?: number): Record<string, string> {
  const pids = readPids();
  const port = webPort ?? (pids.ports?.web ?? DEFAULT_PORTS.web);
  const wsDoPort = pids.ports?.wsDo ?? DEFAULT_PORTS.wsDo;
  return {
    ...(process.env as Record<string, string>),
    ONECAPTAIN_SERVER_URL: WEB_URL(port),
    ONECAPTAIN_PROJECT_ROOT: SELF_HOSTED_DIR,
    ONECAPTAIN_CMD_PREFIX: "npx @onecaptain/app cli",
    ONECAPTAIN_HEALTH_PORT: "19515",
    ONECAPTAIN_WS_DO_PORT: String(wsDoPort),
  };
}
