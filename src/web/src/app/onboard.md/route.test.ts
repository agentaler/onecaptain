import { describe, it, expect, afterEach } from "vitest";
import { GET } from "./route";

describe("GET /onboard.md", () => {
  const origAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const origServerUrl = process.env.ONECAPTAIN_SERVER_URL;
  const origCmdPrefix = process.env.ONECAPTAIN_CMD_PREFIX;
  const origNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    restoreEnv("NEXT_PUBLIC_APP_URL", origAppUrl);
    restoreEnv("ONECAPTAIN_SERVER_URL", origServerUrl);
    restoreEnv("ONECAPTAIN_CMD_PREFIX", origCmdPrefix);
    restoreEnv("NODE_ENV", origNodeEnv);
  });

  function restoreEnv(key: string, val: string | undefined) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }

  it("returns 200 with Content-Type text/markdown", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
  });

  it("uses npx @onecaptain/cli and onecaptain.ai URLs in production mode", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.ONECAPTAIN_SERVER_URL;
    delete process.env.ONECAPTAIN_CMD_PREFIX;
    process.env.NODE_ENV = "production";
    const response = await GET();
    const body = await response.text();
    expect(body).toContain("npx @onecaptain/cli login");
    expect(body).toContain("https://onecaptain.ai/templates");
    expect(body).toContain("https://onecaptain.ai/w/{slug}/home");
  });

  it("uses localhost in development mode when no URLs are set", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.ONECAPTAIN_SERVER_URL;
    delete process.env.ONECAPTAIN_CMD_PREFIX;
    process.env.NODE_ENV = "development";
    const response = await GET();
    const body = await response.text();
    expect(body).toContain("pnpm dev:cli login");
    expect(body).toContain("http://localhost:3000/templates");
  });

  it("uses npx @onecaptain/app cli for self-hosted (app mode)", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:15210";
    process.env.ONECAPTAIN_CMD_PREFIX = "npx @onecaptain/app cli";
    delete process.env.ONECAPTAIN_SERVER_URL;
    process.env.NODE_ENV = "production";
    const response = await GET();
    const body = await response.text();
    expect(body).toContain("npx @onecaptain/app cli login");
    expect(body).toContain("http://localhost:15210/templates");
    expect(body).toContain("http://localhost:15210/w/{slug}/home");
  });
});
