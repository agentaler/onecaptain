# OneCaptain — SaaS Architecture

## Stack (recon, 2026-08-11)
- **Framework**: Next.js (canary, App Router) in `src/web`, deployed on Railway
  (interim Phase 0 dev-parity stack; Cloudflare Workers bindings via
  `getCloudflareContext`). pnpm monorepo + turbo.
- **Language / tooling**: TypeScript everywhere. Commands: `pnpm typecheck`,
  `pnpm lint`, `pnpm test` (vitest; per-package), `pnpm test:e2e-ui`
  (Playwright, `src/web/src/test/e2e-ui/`). Root turbo runs all packages.
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM (`src/shared/src/db`),
  being ported to Railway managed Postgres (`db/pg/` twins,
  `@onecaptain/shared/db-pg`, drizzle-kit baseline in `shared/migrations-pg`).
  SQLite migrations live in `src/web/migrations` (0001–0086).
- **Auth**: Better Auth (`src/web/src/lib/auth.ts`), Drizzle adapter.
  - Prod: email **OTP** (`emailOTP` plugin, sent via EMAIL_WORKER), GitHub +
    Google social, device authorization, bearer.
  - Dev: email+password (`emailAndPassword.enabled = !isProd`) with a shared
    DEV_PASSWORD.
  - Sessions: 30d, cookie cache; custom DO-backed rate limiting.
- **Email**: `src/email-worker` exposes `/send/otp` and `/send/agent`.
- **UI**: shadcn-style components + Tailwind tokens (see DESIGN.md).

## Tenancy model (existing — the app is already multi-tenant)
Tenant == **workspace** (`workspace` table, `sp_`-prefixed ids, unique slug,
`plan` column: free | pro | enterprise). NOT Better Auth organizations — see
DECISIONS.md #1.

- **Membership**: `member` (workspaceId, userId, role owner/admin/member,
  UNIQUE(workspace,user)). Server-side guards: `withAuth` →
  `withWorkspace(Role)` middleware (`src/web/src/lib/middleware/workspace.ts`)
  resolve membership before any tenant read/write; queries are scoped by
  workspaceId up front (AGENTS.md rule: scope before, never check-after).
- **Tenant-owned tables** (workspace-scoped, FK → workspace unless noted):
  agent, agent_access, task (+ task_queue, task artifacts), conversation +
  message, calendar/event tables, meeting_session, email accounts, files,
  issues (+comments), workspace_invite, workspace_audit_log (deliberately
  FK-less so audit survives tenant deletion). Community tables
  (community_*) are scoped by server/channel with their own membership
  checks — a parallel tenancy domain (community servers), same principles.
- **Quotas / plans**: `PLAN_LIMITS` (`src/shared/src/constants.ts`)
  free: 5 agents / 5 members; pro: 25/25; enterprise: ∞. Enforced
  server-side at agent creation and invite acceptance.
- **Audit**: `workspace_audit_log` + `lib/workspace-audit.ts`, written from
  member/invite/role/settings mutations.

## Auth flows (existing)
- `/sign-in` doubles as sign-up (OTP creates the account; social too).
  `/workspaces` app surface; `/c/*` community surface; middleware
  (`src/web/src/middleware.ts`) gates AUTH_REQUIRED_PREFIXES + host-based
  domain split (landing on onecaptain.ai via `src/landing`, app on
  app.onecaptain.ai).
- Workspace invites: `workspace_invite` token links,
  `/invite/[token]` accept page (info → accept; logged-out users are sent
  through sign-in and return), quota enforced at accept, audit-logged.

## Mission deltas (what this change set adds)
1. **Password auth in prod** + email verification + password reset, through a
   single `sendEmail()` abstraction (EMAIL_WORKER `/send/auth` in prod;
   console link in dev — never blocks signup).
2. **Personal workspace auto-provision** on first sign-in (any method) +
   guaranteed active workspace.
3. **Email-delivered role invites** on top of the existing token invites
   (invite by email with role; recipient gets a link; accept flow already
   handles signed-out users).
4. **Polar billing per workspace**: `@polar-sh/better-auth` + `@polar-sh/sdk`,
   `config/billing.ts` single source of truth (Free/Pro), local
   `subscription` table keyed by workspaceId (referenceId), webhook-synced
   (idempotent, signature-verified), billing settings page, checkout +
   customer portal. `workspace.plan` stays the request-path source of truth
   for gating (already enforced) and is updated by the webhook sync.
5. **Verification suite**: isolation matrix, invite lifecycle, billing
   webhooks, gating; results in VERIFICATION.md.
