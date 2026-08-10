import { resolveMode, cliCommand, getBaseUrl } from "@onecaptain/shared";

export function getServerUrl(): string {
  return getBaseUrl({ serverUrl: process.env.ONECAPTAIN_SERVER_URL });
}

export function isDev(): boolean {
  return resolveMode({
    serverUrl: process.env.ONECAPTAIN_SERVER_URL,
    cmdPrefix: process.env.ONECAPTAIN_CMD_PREFIX,
  }) === "dev";
}

export function cmdPrefix(): string {
  return process.env.ONECAPTAIN_CMD_PREFIX || cliCommand(resolveMode({
    serverUrl: process.env.ONECAPTAIN_SERVER_URL,
    cmdPrefix: process.env.ONECAPTAIN_CMD_PREFIX,
  }));
}
