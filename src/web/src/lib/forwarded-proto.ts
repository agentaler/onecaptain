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

// The origin the client actually used, reconstructed from what the proxy
// forwarded. Better Auth compares the browser's `Origin` header against its
// trusted list; when the app is reached over a proxy, the only reliable
// statement of that origin is Host + x-forwarded-proto.
//
// Trusting Host here is a same-origin check, not a hole: a cross-site
// attacker's request carries *their* origin, while Host is written by our own
// edge. Requests whose Origin differs from the host they were sent to are
// still rejected.
export function requestOrigin(request: Request): string | undefined {
  const host = request.headers.get("host")
  if (!host) return undefined
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const scheme = forwarded ?? new URL(request.url).protocol.replace(":", "")
  if (scheme !== "http" && scheme !== "https") return undefined
  return `${scheme}://${host}`
}
