# @onecaptain/app

Run OneCaptain locally — one command, no clone needed.

## Quick Start

```bash
npx @onecaptain/app onboard
```

This will:

1. Check your environment (Node.js >= 20, AI runtime)
2. Install OneCaptain to `~/.onecaptain/self-hosted/`
3. Generate secrets (`BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`)
4. Run database migrations (SQLite via Cloudflare D1 local)
5. Start all services (web, email worker, WebSocket)
6. Create your account and workspace
7. Register your AI runtime and start the daemon
8. Open the dashboard in your browser

## Commands

| Command | Description |
| --- | --- |
| `npx @onecaptain/app onboard` | Full setup: install, migrate, start, and register |
| `npx @onecaptain/app start` | Start services from an existing installation |
| `npx @onecaptain/app stop` | Stop all services |
| `npx @onecaptain/app update` | Update to latest version, re-run migrations, then stop |

### Embedded CLI

`@onecaptain/app` bundles a copy of `@onecaptain/cli` for managing the local daemon and runtime registration:

```bash
npx @onecaptain/app register          # Register CLI with local server
npx @onecaptain/app daemon start      # Start the daemon
npx @onecaptain/app daemon stop       # Stop the daemon
npx @onecaptain/app daemon status     # Check daemon status
npx @onecaptain/app cli <any command> # Pass-through to @onecaptain/cli
```

## Options

```
--port-web <port>    Web server port (default: 15210)
--port-email <port>  Email worker port (default: 15211)
--port-ws <port>     WebSocket worker port (default: 15212)
--skip-register      Skip account creation (onboard only)
```

## Architecture

### Services

OneCaptain runs three local services, each in its own Wrangler dev process:

| Service | Default Port | Description |
| --- | --- | --- |
| **Web** | 15210 | Main web app (Next.js on Wrangler) — dashboard, API, auth |
| **Email Worker** | 15211 | Email processing worker |
| **WebSocket (WS-DO)** | 15212 | Real-time communication via Durable Objects |

All services share a single SQLite database (Cloudflare D1 local mode) with state persisted at `~/.onecaptain/self-hosted/web/.wrangler/state/`.

### Directory Layout

```
~/.onecaptain/self-hosted/
├── web/                  # Web app (wrangler.toml, migrations, .dev.vars)
│   ├── .wrangler/state/  # D1 database & KV persistence
│   └── migrations/       # SQL migration files
├── email-worker/         # Email worker (wrangler.toml, .dev.vars)
├── ws-do/                # WebSocket Durable Object worker
├── logs/                 # Service logs (web.log, email-worker.log, ws-do.log)
└── .pids.json            # PID tracking for running services
```

### Database Migrations

Migrations are SQL files applied via `wrangler d1 migrations apply --local`. They run automatically during:

- **`onboard`** — applies all migrations on fresh install
- **`update`** — applies any new migrations after installing the latest version

Wrangler tracks which migrations have been applied; only pending ones are executed.

### Secrets Management

On first `onboard`, secrets are auto-generated and written to `.dev.vars` files:

- **Web**: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ENCRYPTION_KEY`, OAuth client ID/secret placeholders
- **Email Worker**: `ENCRYPTION_KEY` (synced from web)

Secrets are never overwritten on subsequent runs — only missing files are created.

## Dev Mode

When the `ONECAPTAIN_PROJECT_ROOT` environment variable is set, `@onecaptain/app` runs in dev mode against the monorepo:

- Runs `pnpm predev` to set up environment files
- Runs `pnpm db:migrate` for migrations (instead of Wrangler CLI)
- Starts web via `next dev` (instead of Wrangler)
- Services run in foreground with prefixed log output (`[web]`, `[email-worker]`, `[ws-do]`)
- `Ctrl+C` cleanly stops all services

```bash
ONECAPTAIN_PROJECT_ROOT=/path/to/onecaptain npx @onecaptain/app onboard
```

## Requirements

- Node.js >= 20
- One of: `claude`, `codex`, or `opencode` CLI installed

## Limitations

- Email send/receive is not available in local mode
- OAuth login (GitHub, Google) is disabled; use email/password

## License

Proprietary — see [LICENSE](../../LICENSE). Not open source.
