import { describe, expect, it } from "vitest"
import { resolveHostRoute } from "./host-routing"

const LANDING = "onecaptain.ai"
const APP = "app.onecaptain.ai"

const route = (host: string | null, pathname: string, search = "") =>
  resolveHostRoute(host, pathname, search, LANDING, APP)

describe("resolveHostRoute", () => {
  describe("app host", () => {
    it("redirects / into the app", () => {
      expect(route(APP, "/")).toEqual({ kind: "redirect", url: `https://${APP}/c/me` })
    })

    it("passes every other path through to auth logic", () => {
      for (const p of ["/c/me", "/sign-in", "/workspaces", "/api/agents", "/blog", "/privacy"]) {
        expect(route(APP, p)).toEqual({ kind: "pass" })
      }
    })

    it("ignores the port and host casing", () => {
      expect(route("APP.ONECAPTAIN.AI:443", "/")).toEqual({
        kind: "redirect",
        url: `https://${APP}/c/me`,
      })
    })
  })

  describe("landing host reaching the app (stale DNS)", () => {
    it("redirects to the app host, keeping path and query", () => {
      expect(route(LANDING, "/")).toEqual({ kind: "redirect", url: `https://${APP}/` })
      expect(route(LANDING, "/sign-in", "?redirect=%2Fc%2Fme")).toEqual({
        kind: "redirect",
        url: `https://${APP}/sign-in?redirect=%2Fc%2Fme`,
      })
      expect(route(`www.${LANDING}`, "/c/me")).toEqual({
        kind: "redirect",
        url: `https://${APP}/c/me`,
      })
    })
  })

  describe("other hosts (dev, CI, Railway domain)", () => {
    it("passes every path untouched", () => {
      for (const host of ["localhost:3000", "127.0.0.1:3000", "web-production-ac38c.up.railway.app", null]) {
        for (const p of ["/", "/c/me", "/sign-in", "/blog", "/api/health"]) {
          expect(route(host, p)).toEqual({ kind: "pass" })
        }
      }
    })
  })

  describe("health endpoint", () => {
    it("passes on every host so platform probes always reach it", () => {
      expect(route(LANDING, "/api/health")).toEqual({ kind: "pass" })
      expect(route(APP, "/api/health")).toEqual({ kind: "pass" })
    })
  })
})
