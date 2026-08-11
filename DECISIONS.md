# Decisions

1. **Workspaces stay first-class tables, not Better Auth organizations.**
   The mission brief assumes a bare codebase; OneCaptain already ships a
   complete workspace tenancy domain (workspace/member/invite tables, roles
   owner/admin/member, PLAN_LIMITS quotas, audit log, server-side scoping
   middleware) that agents, tasks, files, calendar, and billing-adjacent
   code all reference by workspaceId. Migrating that to the org plugin's
   tables would be a high-risk rewrite with no functional gain. The org
   plugin's *requirements* (auto-provision, roles, invitations, active
   workspace, last-owner protection) are implemented against the existing
   domain instead. Billing uses workspaceId as the Polar `referenceId`.

2. **OTP stays; email+password is added, not swapped.** Existing prod users
   sign in via email OTP and social. `emailAndPassword` is enabled in prod
   with `requireEmailVerification: false` at the auth layer, and verification
   is driven post-signup (verification email on signup; unverified accounts
   can use the app — matching the OTP/social precedent where possession of
   the inbox IS the verification). Password reset is standard Better Auth
   `sendResetPassword`. No legacy migration needed — same user table.

3. **`sendEmail()` abstraction.** One function
   (`src/web/src/lib/send-email.ts`): tries the EMAIL_WORKER service binding
   (`/send/auth`, added beside `/send/otp`), falls back to the dev worker
   URL, and finally logs the actionable link to the console. Email failures
   never block signup/reset — they log and continue (the UI still shows
   "check your email"; dev reads the console).

4. **Billing state**: local `subscription` table (one row per workspace,
   upserted only by Polar webhooks, idempotent by polarSubscriptionId +
   referenceId). The request path reads `workspace.plan` (existing gating
   column) which the webhook sync updates transactionally with the
   subscription row — no Polar API calls on request paths.
   `POLAR_SERVER=sandbox` default; all webhook tests use signed mock
   payloads via the plugin's verification, no real keys required.

5. **Plan mapping**: `config/billing.ts` maps Polar product ids → plan
   (free/pro). Existing `PLAN_LIMITS` (free 5/5, pro 25/25) stays the limit
   registry — mission's "Free max 3 members" is parameterized there and left
   at the shipped values (trivially tunable in one place).

6. **Backfill**: every existing user without a membership gets a personal
   workspace at next sign-in (lazy provisioning hook) rather than a one-shot
   data migration — there is no pre-existing production data on Railway
   Postgres, and D1 dev data provisions itself on first login.

7. **Community tenancy** (`community_*` servers/channels) is a separate,
   already-isolated domain with its own membership checks and is not touched
   by workspace billing.
