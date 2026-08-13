/**
 * Host-based routing for the SaaS domain split (plans/landing-service-db-service.md):
 * the marketing site is its own Railway service on the apex (`onecaptain.ai`,
 * see `src/landing/`), the product runs here on `app.onecaptain.ai`. Pure
 * decision function so the matrix is unit-testable without a Next server.
 *
 * Any host that is neither the landing nor the app host (localhost, CI,
 * *.railway.app, tenant previews) passes through untouched — dev, e2e, and
 * platform healthchecks see today's behavior. Future per-tenant subdomains
 * (acme.onecaptain.ai) extend this same seam.
 */

const LANDING_HOST = process.env.LANDING_HOST || "onecaptain.ai";
const APP_HOST = process.env.APP_HOST || "app.onecaptain.ai";

export type HostRoute =
  | { kind: "pass" }
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

  if (h === appHost) {
    if (pathname === "/") return { kind: "redirect", url: `https://${appHost}/c/me` };
    return { kind: "pass" };
  }

  // The landing domain is served by the dedicated `landing` service; if its
  // traffic reaches the app anyway (stale DNS), hand it to the app host rather
  // than exposing the product UI on the marketing domain.
  if (h === landingHost || h === `www.${landingHost}`) {
    return { kind: "redirect", url: `https://${appHost}${pathname}${search}` };
  }

  return { kind: "pass" };
}
