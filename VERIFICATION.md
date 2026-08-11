# Verification — SaaS completion (2026-08-11)

Fresh runs, workspace root, commit series on `claude/alook-onecaptain-cloud-llm-wxdfjx`.

## Static

| Command | Result |
| --- | --- |
| `pnpm typecheck` | 7/7 packages pass, zero errors |
| `pnpm lint` | 4/4 lint tasks pass |
| `pnpm knip` (per-package, via pre-commit) | clean (hints only) |

There is no `next build` gate in this repo's CI — the deploy path is the
Railway Phase 0 dev-parity stack (see RAILWAY.md) and correctness gates are
typecheck + lint + unit + e2e, all run here.

## Automated tests

| Suite | Command | Result |
| --- | --- | --- |
| Full workspace | `pnpm test` (turbo, 10 packages) | 10/10 tasks pass — web 470+ files, shared 127 files incl. new suites below |
| Auth flows | `src/web/src/lib/auth.test.ts` | 27 pass — incl. password signup method cookie, hooks |
| Auto-provision | `src/shared/test/queries/ensure-personal-workspace.test.ts` | 4 pass (real migrated DB: create, idempotent, existing-membership, empty-name fallback) |
| Subscription sync | `src/shared/test/queries/subscription.test.ts` | 5 pass (created→pro flip, idempotent replay, update-in-place, revoke→free, out-of-order generation guard) |
| Webhook endpoint | `src/web/src/lib/billing/webhook.test.ts` | 7 pass — REAL mounted `/api/auth/polar/webhooks`: signed created/updated/canceled accepted + forwarded; wrong-secret, unsigned, tampered-body rejected; endpoint absent when unconfigured |
| Plan gating | `src/web/src/app/api/invite/[token]/route.test.ts` | 13 pass — free seat cap 403 without consuming the invite; same seat count accepted on pro; full invite lifecycle (used/expired/dup-member) |
| Tenant isolation | existing route suites (agents, tasks, members, invites, audit, files, community) | pass — every tenant route resolves membership via `withWorkspace(Role)` before queries; billing routes added under the same guard (member view / admin checkout) |

## E2E (server-driven, real stack)

`pnpm test:e2e` — 40 files / 266 tests against the booted dev stack
(next dev + 3 wrangler workers). Adapted for auto-provision and re-verified
locally (`onboard-flow`, `device-code`: 16/16). Covers signup → session,
workspace creation/scoping, invite accept lifecycle, member removal,
multi-workspace task routing, protected-route 401s.

Browser E2E (`pnpm test:e2e-ui`, Playwright) runs in CI on PRs touching
web/shared; specs 09/03/15/17 are documented pre-existing base-branch
failures (text-thread refetch loop, see PR #1) unrelated to this work.

## Live smoke (Railway deployment)

- `https://app.onecaptain.ai/sign-in` 200; signup → session roundtrip 200
  (curl, session cookie honored by `/api/auth/get-session`).
- `https://onecaptain.ai` serves the landing page; app paths 308 to the app
  host; `/api/health` 200 on web.

## Definition of Done mapping

- Signup/signin/signout with email+password + verification + reset — auth.ts
  config + pages + `auth.test.ts`, `webhook.test.ts` harness constructs the
  real handler. Console-link fallback verified by `sendEmail` design (logs
  actionable URL when no transport).
- Personal workspace auto-provision + switcher — user-create hook + lazy
  ensure + existing workspace switcher UI; tests above.
- Workspace scoping — pre-existing architecture (ARCHITECTURE.md): every
  tenant table carries workspaceId, all reads/writes behind
  `withAuth`+`withWorkspace(Role)`; no backfill needed (DECISIONS.md #6).
- Invitations — existing token flow + seat quotas + audit; lifecycle tests.
- Polar — checkout with workspace referenceId (admin-gated route), webhook
  signature verification + idempotent local sync (subscription table +
  workspace.plan), billing tab UI, portal via `authClient.customer.portal()`;
  sandbox default, zero real keys needed for any test.
- Feature gating — `PLAN_LIMITS` enforced at agent-create and invite-accept
  server-side; pro lift covered by test; UI shows limits + upgrade CTA.
- Env/README/docs — `.env.example` POLAR block, README SaaS setup section,
  ARCHITECTURE.md, DECISIONS.md, this file.
