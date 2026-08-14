import { describe, it, expect } from "vitest"

const APP_URL = process.env.APP_URL ?? "http://localhost:3000"

describe("health check", () => {
  it("GET /api/health returns 200 with status ok", async () => {
    const res = await fetch(`${APP_URL}/api/health`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe("ok")
  })

  it("reports which required config is present, and never a value", async () => {
    // The point of the endpoint beyond liveness. A running-but-unconfigured
    // deployment is the failure this reports, so `config` must actually be
    // there — asserting only `status` would pass against the old handler.
    const data = await (await fetch(`${APP_URL}/api/health`)).json()
    expect(data.config).toMatch(/^(complete|incomplete)$/)
    if (data.config === "incomplete") {
      expect(Array.isArray(data.missing)).toBe(true)
      // Names only. A missing name is fine to publish; anything derived from
      // the value — including its length — is not, and this endpoint is
      // unauthenticated.
      for (const name of data.missing) expect(typeof name).toBe("string")
    } else {
      expect(data.missing).toBeUndefined()
    }
  })
})
