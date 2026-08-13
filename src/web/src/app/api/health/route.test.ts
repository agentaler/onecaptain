import { describe, it, expect, vi, beforeEach } from "vitest";

const envBox: { value: Record<string, unknown> | null } = { value: null };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    if (envBox.value === null) throw new Error("no cloudflare context");
    return { env: envBox.value };
  },
}));

import { GET } from "./route";

const COMPLETE = {
  BETTER_AUTH_SECRET: "s",
  BETTER_AUTH_URL: "https://app.example",
  ENCRYPTION_KEY: "k",
};

beforeEach(() => {
  envBox.value = { ...COMPLETE };
});

describe("GET /api/health", () => {
  it("reports complete config when everything required is present", async () => {
    const body = await (await GET()).json();
    expect(body).toEqual({ status: "ok", config: "complete" });
  });

  it("names what is missing so a bad deploy is legible", async () => {
    envBox.value = { BETTER_AUTH_SECRET: "s" };
    const body = await (await GET()).json();
    expect(body.config).toBe("incomplete");
    expect(body.missing).toEqual(["BETTER_AUTH_URL", "ENCRYPTION_KEY"]);
  });

  it("treats an empty string as missing, not as configured", async () => {
    // A blank secret is the likeliest real misconfiguration — an unset shell
    // variable expands to empty rather than disappearing.
    envBox.value = { ...COMPLETE, ENCRYPTION_KEY: "" };
    const body = await (await GET()).json();
    expect(body.missing).toEqual(["ENCRYPTION_KEY"]);
  });

  it("never leaks a value, a prefix, or a length", async () => {
    envBox.value = { ...COMPLETE, ENCRYPTION_KEY: "super-secret-value" };
    const raw = JSON.stringify(await (await GET()).json());
    expect(raw).not.toContain("super-secret-value");
    expect(raw).not.toContain("super");
    // The endpoint is unauthenticated; even the length of a key is not a
    // stranger's business.
    expect(raw).not.toContain(String("super-secret-value".length));
  });

  it("stays ok when config is incomplete", async () => {
    // A config gap must not fail a liveness probe — an orchestrator would
    // restart a healthy container in a loop and hide the real problem.
    envBox.value = {};
    expect((await (await GET()).json()).status).toBe("ok");
  });

  it("still answers outside a Workers context", async () => {
    envBox.value = null;
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });
});
