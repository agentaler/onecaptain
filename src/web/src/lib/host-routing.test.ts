import { describe, expect, it } from "vitest"
import { resolveHostRoute } from "./host-routing"

const LANDING = "onecaptain.ai"
const APP = "app.onecaptain.ai"

const route = (host: string | null, pathname: string, search = "") =>
  resolveHostRoute(host, pathname, search, LANDING, APP)

describe("resolveHostRoute", () => {
  describe("landing host", () => {
    it("rewrites / to the static landing page", () => {
      expect(route(LANDING, "/")).toEqual({ kind: "rewrite", path: "/landing.html" })
    })

    it("treats www. the same as the apex", () => {
      expect(route(`www.${LANDING}`, "/")).toEqual({ kind: "rewrite", path: "/landing.html" })
      expect(route(`www.${LANDING}`, "/sign-in")).toEqual({
        kind: "redirect",
        url: `https://${APP}/sign-in`,
      })
    })

    it("ignores the port and host casing", () => {
      expect(route("ONECAPTAIN.AI:443", "/")).toEqual({ kind: "rewrite", path: "/landing.html" })
    })

    it("redirects app paths to the app host, keeping path and query", () => {
      expect(route(LANDING, "/c/me")).toEqual({ kind: "redirect", url: `https://${APP}/c/me` })
      expect(route(LANDING, "/sign-in", "?redirect=%2Fc%2Fme")).toEqual({
        kind: "redirect",
        url: `https://${APP}/sign-in?redirect=%2Fc%2Fme`,
      })
      expect(route(LANDING, "/workspaces")).toEqual({
        kind: "redirect",
        url: `https://${APP}/workspaces`,
      })
      expect(route(LANDING, "/api/agents")).toEqual({
        kind: "redirect",
        url: `https://${APP}/api/agents`,
      })
    })

    it("passes marketing surfaces through", () => {
      for (const p of ["/blog", "/blog/some-post", "/templates", "/templates/dev-team", "/privacy", "/og/blog"]) {
        expect(route(LANDING, p)).toEqual({ kind: "pass" })
      }
    })

    it("does not treat prefix-lookalike paths as marketing", () => {
      expect(route(LANDING, "/blogger")).toEqual({
        kind: "redirect",
        url: `https://${APP}/blogger`,
      })
    })
  })

  describe("app host", () => {
    it("redirects / into the app", () => {
      expect(route(APP, "/")).toEqual({ kind: "redirect", url: `https://${APP}/c/me` })
    })

    it("bounces marketing paths to the landing host", () => {
      expect(route(APP, "/blog")).toEqual({ kind: "redirect", url: `https://${LANDING}/blog` })
      expect(route(APP, "/templates/dev-team", "?utm=x")).toEqual({
        kind: "redirect",
        url: `https://${LANDING}/templates/dev-team?utm=x`,
      })
    })

    it("passes app paths through to auth logic", () => {
      for (const p of ["/c/me", "/sign-in", "/workspaces", "/api/agents", "/privacy"]) {
        expect(route(APP, p)).toEqual({ kind: "pass" })
      }
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
