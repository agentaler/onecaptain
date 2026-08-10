import { Command } from "commander";
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { stopServices } from "../lib/services.js";
import { buildCliEnv } from "../lib/cli-env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function cliEntry(): string {
  return join(__dirname, "cli", "index.js");
}

function stopDaemon(): boolean {
  const status = spawnSync("node", [cliEntry(), "daemon", "status"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: buildCliEnv(),
  });
  const running = (status.stdout?.toString() ?? "").includes("running (pid=");
  if (!running) return false;

  spawnSync("node", [cliEntry(), "daemon", "stop"], {
    stdio: "inherit",
    env: buildCliEnv(),
  });
  return true;
}

export function stopCommand(): Command {
  return new Command("stop")
    .description("Stop all OneCaptain services")
    .action(() => {
      console.log("Stopping OneCaptain services and daemon...");
      stopServices();
      stopDaemon();
      console.log("\nAll services stopped.");
    });
}
