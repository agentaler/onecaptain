import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { route } from "./server.mjs"

const APP = "https://app.onecaptain.ai"

describe("landing route", () => {
  it("serves the waitlist page on /", () => {
    for (const path of ["/", "/index.html"]) {
      const r = route("GET", path)
      assert.equal(r.status, 200)
      assert.equal(r.headers["Content-Type"], "text/html; charset=utf-8")
      assert.match(r.body.toString(), /OneCaptain/)
    }
  })

  it("answers the healthcheck", () => {
    const r = route("GET", "/api/health")
    assert.equal(r.status, 200)
    assert.equal(r.body, '{"status":"ok"}')
  })

  it("forwards app paths to the app host, keeping path and query", () => {
    assert.deepEqual(route("GET", "/sign-in?redirect=%2Fc%2Fme").status, 308)
    assert.equal(route("GET", "/sign-in?redirect=%2Fc%2Fme").headers.Location, `${APP}/sign-in?redirect=%2Fc%2Fme`)
    assert.equal(route("HEAD", "/c/me").headers.Location, `${APP}/c/me`)
  })

  it("rejects non-GET methods", () => {
    const r = route("POST", "/")
    assert.equal(r.status, 405)
    assert.equal(r.headers.Allow, "GET, HEAD")
  })
})
