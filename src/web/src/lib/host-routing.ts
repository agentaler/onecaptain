/**
 * Host-based routing for the SaaS domain split (plans/domain-split-landing.md):
 * the marketing site lives on the apex (`onecaptain.ai`), the product on
 * `app.onecaptain.ai`, one Next app serves both. Pure decision function so the
 * matrix is unit-testable without a Next server.
 *
 * Any host that is neither the landing nor the app host (localhost, CI,
 * *.railway.app, tenant previews) passes through untouched — dev, e2e, and
 * platform healthchecks see today's behavior. Future per-tenant subdomains
 * (acme.onecaptain.ai) extend this same seam.
 */

const LANDING_HOST = process.env.LANDING_HOST || "onecaptain.ai";
const APP_HOST = process.env.APP_HOST || "app.onecaptain.ai";

/** Marketing surfaces served on the landing host (prefix match). */
const LANDING_PREFIXES = ["/blog", "/templates", "/privacy", "/og"];

/** Marketing-only prefixes bounced off the app host back to the landing host. */
const APP_HOST_BOUNCE_PREFIXES = ["/blog", "/templates"];

export type HostRoute =
  | { kind: "pass" }
  | { kind: "rewrite"; path: string }
  | { kind: "redirect"; url: string };

export function resolveHostRoute(
  host: string | null,
  pathname: string,
  search: string,
  landingHost: string = LANDING_HOST,
  appHost: string = APP_HOST,
): HostRoute {
  const h = (host ?? "").toLowerCase().split(":")[0];

  // Health must answer on every host — platform probes don't send our domains.
  if (pathname === "/api/health") return { kind: "pass" };

  if (h === landingHost || h === `www.${landingHost}`) {
    if (pathname === "/") return { kind: "rewrite", path: "/landing.html" };
    if (LANDING_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return { kind: "pass" };
    }
    // Everything else (sign-in, /c, workspaces, /api) belongs to the app host.
    return { kind: "redirect", url: `https://${appHost}${pathname}${search}` };
  }

  if (h === appHost) {
    if (pathname === "/") return { kind: "redirect", url: `https://${appHost}/c/me` };
    if (APP_HOST_BOUNCE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return { kind: "redirect", url: `https://${landingHost}${pathname}${search}` };
    }
    return { kind: "pass" };
  }

  return { kind: "pass" };
}
