/**
 * `pnpm run daemon` — LOCAL-DEV daemon entry.
 *
 * Thin wrapper over the published CLI's `daemon start` command so the same
 * flags work in dev (e.g. `pn daemon start --machine-key … --server-url …
 * --ws-url …`). All three flags are required — set ONECAPTAIN_MACHINE_KEY /
 * ONECAPTAIN_SERVER_URL / ONECAPTAIN_SERVER_WS_URL or pass the matching options.
 */
import { Command } from "commander";
import { daemonStart } from "../src/cli/daemonStart";
import { createLogger } from "../src/logger";

const log = createLogger({ header: "@onecaptain/daemon" });

const program = new Command();
program
  .name("daemon")
  .description("local-dev daemon entry (wraps `onecaptain daemon …`)");

program
  .command("start")
  .description("start the daemon")
  .requiredOption("--machine-key <key>", "machine key (or ONECAPTAIN_MACHINE_KEY)", process.env.ONECAPTAIN_MACHINE_KEY)
  .option("--server-url <url>", "server HTTP URL (or ONECAPTAIN_SERVER_URL)", process.env.ONECAPTAIN_SERVER_URL)
  .option("--ws-url <url>", "server WebSocket URL (or ONECAPTAIN_SERVER_WS_URL)", process.env.ONECAPTAIN_SERVER_WS_URL)
  .option("--base-dir <path>", "data directory (or ONECAPTAIN_DATA_DIR)", process.env.ONECAPTAIN_DATA_DIR)
  .action(async (opts: { machineKey: string; serverUrl?: string; wsUrl?: string; baseDir?: string }) => {
    await daemonStart({
      machineKey: opts.machineKey,
      serverUrl: opts.serverUrl,
      wsUrl: opts.wsUrl,
      baseDir: opts.baseDir,
    });
  });

program.parseAsync(process.argv).catch((e) => {
  log.error((e as Error).message ?? String(e));
  process.exit(1);
});
