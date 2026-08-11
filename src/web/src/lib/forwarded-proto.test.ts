import { describe, it, expect } from "vitest"
import { withForwardedProto, requestOrigin } from "./forwarded-proto"

describe("withForwardedProto", () => {
  it("upgrades the URL scheme when the proxy says the client used https", () => {
    const req = new Request("http://app.onecaptain.ai/api/auth/sign-in/email", {
      method: "POST",
      headers: { "x-forwarded-proto": "https", "content-type": "application/json" },
      body: "{}",
    })
    const out = withForwardedProto(req)
    expect(out.url).toBe("https://app.onecaptain.ai/api/auth/sign-in/email")
  })

  it("keeps method, headers and body across the rewrite", async () => {
    const req = new Request("http://app.onecaptain.ai/api/auth/sign-in/email", {
      method: "POST",
      headers: { "x-forwarded-proto": "https", "content-type": "application/json", cookie: "a=1" },
      body: JSON.stringify({ email: "a@b.c" }),
    })
    const out = withForwardedProto(req)
    expect(out.method).toBe("POST")
    expect(out.headers.get("cookie")).toBe("a=1")
    expect(await out.json()).toEqual({ email: "a@b.c" })
  })

  it("reads only the first hop of a comma-joined header", () => {
    const req = new Request("http://app.onecaptain.ai/x", {
      headers: { "x-forwarded-proto": "https, http" },
    })
    expect(withForwardedProto(req).url).toBe("https://app.onecaptain.ai/x")
  })

  it("leaves the request untouched when the proxy reports http", () => {
    const req = new Request("http://app.onecaptain.ai/x", {
      headers: { "x-forwarded-proto": "http" },
    })
    expect(withForwardedProto(req)).toBe(req)
  })

  it("leaves the request untouched when there is no proxy header (Cloudflare, local dev)", () => {
    const req = new Request("http://localhost:3000/x")
    expect(withForwardedProto(req)).toBe(req)
  })

  it("is a no-op when the request is already https", () => {
    const req = new Request("https://app.onecaptain.ai/x", {
      headers: { "x-forwarded-proto": "https" },
    })
    expect(withForwardedProto(req)).toBe(req)
  })

  it("preserves the query string", () => {
    const req = new Request("http://app.onecaptain.ai/sign-in?redirect=%2Fc%2Fme", {
      headers: { "x-forwarded-proto": "https" },
    })
    expect(withForwardedProto(req).url).toBe("https://app.onecaptain.ai/sign-in?redirect=%2Fc%2Fme")
  })
})

describe("requestOrigin", () => {
  it("rebuilds the client-facing origin from Host + x-forwarded-proto", () => {
    const req = new Request("http://internal:3000/api/auth/sign-in/email", {
      headers: { host: "app.onecaptain.ai", "x-forwarded-proto": "https" },
    })
    expect(requestOrigin(req)).toBe("https://app.onecaptain.ai")
  })

  it("falls back to the request's own scheme with no proxy header", () => {
    const req = new Request("http://localhost:3000/x", { headers: { host: "localhost:3000" } })
    expect(requestOrigin(req)).toBe("http://localhost:3000")
  })

  it("honours a proxy that reports http", () => {
    const req = new Request("http://app.onecaptain.ai/x", {
      headers: { host: "app.onecaptain.ai", "x-forwarded-proto": "http" },
    })
    expect(requestOrigin(req)).toBe("http://app.onecaptain.ai")
  })

  it("ignores a nonsense scheme rather than minting a bogus origin", () => {
    const req = new Request("http://app.onecaptain.ai/x", {
      headers: { host: "app.onecaptain.ai", "x-forwarded-proto": "javascript" },
    })
    expect(requestOrigin(req)).toBeUndefined()
  })
})
