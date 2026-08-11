// Railway (like any TLS-terminating proxy) forwards to the container over
// plain HTTP, so `request.url` inside the worker reads `http://…` even though
// the browser spoke https. Better Auth compares the request's origin against
// its configured baseURL and rejects the mismatch with INVALID_ORIGIN; the
// same wrong scheme also leaks into every absolute URL the app generates.
//
// `x-forwarded-proto` is the proxy's statement of the scheme the client used.
// On Cloudflare the request is already https and the header is absent, so this
// is a no-op there.
// Generic in the request type so the worker's `Request<unknown, IncomingRequestCfProperties>`
// survives the rewrite — workerd copies `cf` from the init request.
export function withForwardedProto<T extends Request>(request: T): T {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  if (proto !== "https") return request

  const url = new URL(request.url)
  if (url.protocol === "https:") return request

  url.protocol = "https:"
  return new Request(url, request) as unknown as T
}

// Every origin that means "this app, reached on the host this request was
// sent to" — both schemes, because the request does not survive the proxy with
// its scheme intact.
//
// Behind the proxy, a browser's same-origin `https://<host>` Origin header is
// rewritten to `http://<host>` before Better Auth sees it: the container is
// reached over plain http, and the layer that normalizes a same-origin Origin
// regenerates it from that scheme. A cross-origin Origin is passed through
// untouched, so the downgrade lands only on the app's own origin — exactly the
// one that must be trusted. Naming both schemes is what survives it.
//
// Trusting Host is a same-origin check, not a hole: a cross-site attacker's
// request carries *their* origin, while Host is written by our own edge, so an
// Origin that disagrees with the host it was sent to is still rejected. The
// http form gives an attacker nothing either — middleware redirects plain http
// to https before any handler runs.
export function requestOrigins(request: Request): string[] {
  const host = request.headers.get("host")
  if (!host) return []
  return [`https://${host}`, `http://${host}`]
}
