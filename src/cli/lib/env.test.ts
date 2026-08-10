import { describe, it, expect, afterEach } from "vitest";
import { isDev, cmdPrefix } from "./env.js";

afterEach(() => {
  delete process.env.ONECAPTAIN_SERVER_URL;
  delete process.env.ONECAPTAIN_CMD_PREFIX;
});

describe("isDev", () => {
  it("returns false when ONECAPTAIN_SERVER_URL is not set", () => {
    expect(isDev()).toBe(false);
  });

  it("returns true when ONECAPTAIN_SERVER_URL is set", () => {
    process.env.ONECAPTAIN_SERVER_URL = "http://localhost:3000";
    expect(isDev()).toBe(true);
  });

  it("returns false when ONECAPTAIN_CMD_PREFIX is set (app mode)", () => {
    process.env.ONECAPTAIN_SERVER_URL = "http://localhost:3000";
    process.env.ONECAPTAIN_CMD_PREFIX = "npx @onecaptain/app cli";
    expect(isDev()).toBe(false);
  });
});

describe("cmdPrefix", () => {
  it("returns 'npx @onecaptain/cli' in production", () => {
    expect(cmdPrefix()).toBe("npx @onecaptain/cli");
  });

  it("returns 'pnpm dev:cli' in dev", () => {
    process.env.ONECAPTAIN_SERVER_URL = "http://localhost:3000";
    expect(cmdPrefix()).toBe("pnpm dev:cli");
  });

  it("returns ONECAPTAIN_CMD_PREFIX when set", () => {
    process.env.ONECAPTAIN_SERVER_URL = "http://localhost:3000";
    process.env.ONECAPTAIN_CMD_PREFIX = "npx @onecaptain/app cli";
    expect(cmdPrefix()).toBe("npx @onecaptain/app cli");
  });
});
