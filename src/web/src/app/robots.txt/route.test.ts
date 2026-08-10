import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /robots.txt", () => {
  it("keeps crawl rules and points agents at llms.txt", async () => {
    const res = await GET();
    const body = await res.text();

    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Sitemap: https://onecaptain.ai/sitemap.xml");
    expect(body).toContain("https://onecaptain.ai/llms.txt");
  });
});
