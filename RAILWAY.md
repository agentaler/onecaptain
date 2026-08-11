# Deploying OneCaptain on Railway

OneCaptain is being ported off Cloudflare in phases (see the migration plan). This guide
describes the target Railway topology, what exists today, and what the operator must
provide. It is the single source of truth for Railway deployment.

## Target topology

Every repo-built service deploys from the monorepo root with the shared
`railway.toml`; `SERVICE_ROLE` (set per service) picks what
`scripts/railway-build.sh` / `scripts/railway-start.sh` actually run.

| Railway service | `SERVICE_ROLE` | Source | Runs | Notes |
| --- | --- | --- | --- | --- |
| `web` | `web` (default) | `src/web` | Next.js app (`ONECAPTAIN_PLATFORM=node`) | public domain `app.onecaptain.ai`; Phase 0 serves the compiled worker bundle |
| `landing` | `landing` | `src/landing` | `node src/landing/server.mjs` — static waitlist page, zero deps, no install/build | public domain `onecaptain.ai` (+`www`); non-landing paths 308 to the app host (`APP_URL`) |
| `Postgres` | — | Railway managed Postgres | the production database | own volume; **private networking only, no public domain** |
| `ws` | `ws` (Phase 2) | `src/ws-node` | WebSocket + daemon forward routes | public domain (wss) |
| `email` | `email` (Phase 3) | — | Inbound-email webhook receiver + IMAP poll cron | |
| — | — | wake-worker | none | retired on Railway: wakes dispatch inline from `web` via the existing HTTP transport |

**Volumes**
- `postgres-volume` — owned by the managed `Postgres` service; the database lives
  outside the app container. The app reaches it over Railway private networking via
  `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
- `web-volume` mounted on `web` at `/data` — file storage (`/data/storage/…`
  replacing R2 buckets) and, during Phase 0 only, the interim wrangler state.

**Scaling constraint:** `web` and `ws` are single-instance until Phase 3 hardening
(WS presence and rate limits are in-process). `landing` is stateless and may scale
freely; Postgres removes the single-writer constraint once the Phase 1 port lands.

## Environment variables

Shared secrets (set on every service):

| Var | Meaning |
| --- | --- |
| `BETTER_AUTH_SECRET` | session signing secret (32+ random bytes) |
| `BETTER_AUTH_URL` | public URL of `web`, e.g. `https://app.onecaptain.ai` |
| `ENCRYPTION_KEY` | AES-256-GCM key for stored credentials (bot cloud-LLM keys, email accounts) — same value everywhere it's read |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — the managed Postgres service over private networking |
| `ONECAPTAIN_PLATFORM` | `node` — selects the Node platform seam instead of Cloudflare bindings |

Service wiring (replaces Cloudflare service bindings):

| Var | Set on | Value |
| --- | --- | --- |
| `WS_SERVICE_URL` | web | internal URL of `ws` (Railway private networking) |
| `WEB_SERVICE_URL` | ws, email | internal URL of `web` |
| `STORAGE_DIR` | web, email | `/data/storage` |

OAuth + integrations (web):

| Var | Meaning |
| --- | --- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub social sign-in |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google social sign-in |
| `DEVICE_CLIENT_IDS` | allowlisted CLI device-flow client ids (`onecaptain-cli`) |
| `POSTMARK_WEBHOOK_SECRET` (Phase 3) | verifies inbound email webhooks |

## What the operator must provide

1. **Railway project** with the GitHub repo connected (deploy on push to `main`), the
   services above created from the monorepo root, the managed Postgres provisioned,
   and the `web` volume attached at `/data`.
2. **Domains + DNS**: `onecaptain.ai` (+`www`) points at the `landing` service,
   `app.onecaptain.ai` at the `web` service (canonical auth URL is
   `https://app.onecaptain.ai`), and `ws.onecaptain.ai` at the `ws` service (Phase 2).
   Railway issues TLS. The `Postgres` service gets **no** public domain.
3. **Secrets** above generated and set (`openssl rand -base64 32` for the two keys).
4. **OAuth apps** (GitHub + Google) with callback URLs on the new web domain.
5. **Inbound email provider** (Phase 3): a Postmark (or Mailgun/SES) account with an
   inbound domain (`onecaptain.ai` MX) pointing its webhook at
   `https://app.onecaptain.ai/api/email/inbound`. Cloudflare Email Routing is not used.
6. **Decision already taken**: Railway managed **Postgres** is the production
   database (no SQLite anywhere in production). The Phase 1 port targets
   drizzle-orm `pg-core` + `node-postgres`; the earlier libSQL layer is superseded.

## Phase status

- **Phase 0 (live):** one container runs the whole stack on workerd. The build step
  compiles the real production bundle (`opennextjs-cloudflare build`) and the start
  step serves it with `wrangler dev` against local D1/R2/DO state on `/data` — the
  same thing `opennextjs-cloudflare preview` does, minus the rebuild. The
  `email-worker`, `ws-do`, and `wake-worker` sidecars still run as `wrangler dev`.
  Single-instance and file-backed, so it is not the Phase 1 target — but it serves
  compiled, minified assets, not a dev server.
- **Phase 1 (in progress):** web on plain Node + Postgres via the platform seam
  (drizzle `pg-core` schema port, transaction-based batch, tsvector search).
- **Phase 2:** `ws-node` service replaces the WebSocket Durable Object.
- **Phase 3:** inbound email webhook + IMAP cron; optional S3/Redis for multi-instance.

## What does NOT change

- The daemon/CLI (`@onecaptain/cli`, `@onecaptain/daemon`) — they talk HTTP/WS to whatever
  `ONECAPTAIN_SERVER_URL` points at.
- The shared query modules' logic, cloud-LLM provider encryption, tenancy (roles,
  quotas, audit log). (The schema itself is ported to `pg-core` with a fresh Postgres
  baseline migration — the SQLite migration history 0001–0086 stays for the legacy
  Cloudflare/dev path only until Phase 1 completes.)
- Desktop/mobile shells (they target the web app's URL).
