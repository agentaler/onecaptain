import { Command } from "commander";
import { getCurrentVersion } from "../lib/version.js";

export function versionCommand(): Command {
  const cmd = new Command("version")
    .description("Show CLI version")
    .action(() => {
      console.log(`onecaptain version ${getCurrentVersion()}`);
    });

  return cmd;
}
