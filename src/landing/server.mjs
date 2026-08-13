// Static landing service for onecaptain.ai. Serves the waitlist page and
// forwards everything else to the app host. No dependencies — node:http only —
// so the Railway `landing` service needs no install or build step.
import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const APP_URL = (process.env.APP_URL || "https://app.onecaptain.ai").replace(/\/$/, "")
const PORT = Number(process.env.PORT || 3000)

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"))

export function route(method, url) {
  if (method !== "GET" && method !== "HEAD") {
    return { status: 405, headers: { Allow: "GET, HEAD" } }
  }
  const path = url.split("?")[0]
  if (path === "/" || path === "/index.html") {
    return { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: html }
  }
  if (path === "/api/health") {
    return { status: 200, headers: { "Content-Type": "application/json" }, body: '{"status":"ok"}' }
  }
  return { status: 308, headers: { Location: `${APP_URL}${url}` } }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  createServer((req, res) => {
    const { status, headers, body } = route(req.method, req.url)
    res.writeHead(status, { "Cache-Control": "no-store", ...headers })
    res.end(req.method === "HEAD" ? undefined : body)
  }).listen(PORT, "0.0.0.0", () => {
    console.log(`landing listening on :${PORT}, forwarding app paths to ${APP_URL}`)
  })
}
