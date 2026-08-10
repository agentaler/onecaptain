# Deploying OneCaptain on Railway

OneCaptain is being ported off Cloudflare in phases (see the migration plan). This guide
describes the target Railway topology, what exists today, and what the operator must
provide. It is the single source of truth for Railway deployment.

## Target topology

| Railway service | Source | Start command (target state) | Notes |
| --- | --- | --- | --- |
| `web` | `src/web` | `pnpm --filter @onecaptain/web build && pnpm --filter @onecaptain/web start` | Next.js on Node (`ONECAPTAIN_PLATFORM=node`), public domain |
| `ws` | `src/ws-node` (Phase 2) | `pnpm --filter @onecaptain/ws-node start` | WebSocket + daemon forward routes, public domain (wss) |
| `email` | Phase 3 | `pnpm --filter @onecaptain/email start` | Inbound-email webhook receiver + IMAP poll cron |
| — | wake-worker | none | retired on Railway: wakes dispatch inline from `web` via the existing HTTP transport |

**Volumes**
- `data` mounted on `web` at `/data` — libSQL database file (`/data/onecaptain.db`) and
  file storage (`/data/storage/…` replacing R2 buckets).

**Scaling constraint:** `web` and `ws` are single-instance until Phase 3 hardening
(SQLite is single-writer; WS presence and rate limits are in-process). Do not enable
replicas.

## Environment variables

Shared secrets (set on every service):

| Var | Meaning |
| --- | --- |
| `BETTER_AUTH_SECRET` | session signing secret (32+ random bytes) |
| `BETTER_AUTH_URL` | public URL of `web`, e.g. `https://app.onecaptain.ai` |
| `ENCRYPTION_KEY` | AES-256-GCM key for stored credentials (bot cloud-LLM keys, email accounts) — same value everywhere it's read |
| `DATABASE_URL` | `file:/data/onecaptain.db` (libSQL) |
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
   services above created from the monorepo root, and the `data` volume attached to `web`.
2. **Domains + DNS**: `onecaptain.ai` (landing/marketing) and `app.onecaptain.ai` (app)
   both point at the `web` service (the Next app serves both surfaces; canonical auth URL
   is `https://app.onecaptain.ai`), and `ws.onecaptain.ai` points at the `ws` service.
   Railway issues TLS.
3. **Secrets** above generated and set (`openssl rand -base64 32` for the two keys).
4. **OAuth apps** (GitHub + Google) with callback URLs on the new web domain.
5. **Inbound email provider** (Phase 3): a Postmark (or Mailgun/SES) account with an
   inbound domain (`onecaptain.ai` MX) pointing its webhook at
   `https://app.onecaptain.ai/api/email/inbound`. Cloudflare Email Routing is not used.
6. **Decision already taken**: SQLite (libSQL) on a volume, single instance. Moving to
   Postgres/Redis/S3 later is covered by migration-plan Phase 3.

## Phase status

- **Phase 0 (available now, staging only):** the stack can run in containers exactly as
  CI's E2E job runs it (`next dev` + `wrangler dev` with `--persist-to /data/wrangler`).
  Functional but uses dev servers — do not treat as production.
- **Phase 1 (in progress):** web on plain Node + libSQL via the platform seam.
- **Phase 2:** `ws-node` service replaces the WebSocket Durable Object.
- **Phase 3:** inbound email webhook + IMAP cron; optional S3/Redis for multi-instance.

## What does NOT change

- The daemon/CLI (`@onecaptain/cli`, `@onecaptain/daemon`) — they talk HTTP/WS to whatever
  `ONECAPTAIN_SERVER_URL` points at.
- The shared schema/queries, migrations 0001–0086, cloud-LLM provider encryption, tenancy
  (roles, quotas, audit log).
- Desktop/mobile shells (they target the web app's URL).
