# Verification — SaaS completion (2026-08-11)

Final fresh gate (after the invites phase): `pnpm typecheck` 7/7, `pnpm lint`
4/4, `pnpm test` 10/10 turbo tasks — all green; Railway web deploy SUCCESS
with the full change set.

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
| Plan gating + role grants | `src/web/src/app/api/invite/[token]/route.test.ts` | 15 pass — free seat cap 403 without consuming the invite; same seat count accepted on pro; admin role honored at accept; owner never grantable; full lifecycle |
| Email invites | `src/web/src/app/api/workspaces/[id]/invites/route.test.ts` | 7 pass — email+role creation with delivery, owner-role and bad-email rejected, bare link preserved |
| Tenant isolation | existing route suites (agents, tasks, members, invites, audit, files, community) | pass — every tenant route resolves membership via `withWorkspace(Role)` before queries; billing routes added under the same guard (member view / admin checkout) |

## Windows CI flake — fixed at the root

`Tests (windows-latest)` failed on four consecutive heads, always
`@onecaptain/app` and always `test/services.test.ts:28`. Diagnosis from the
job log: every test in that file imports the module graph dynamically (the
`vi.mock` calls must register first), so the first test was charged for the
cold transform — 14s on a loaded Windows runner — against its 15s budget,
while the rest ran in ~200ms each off the cached transform. A `beforeAll`
warm-up moves that cost into a hook (commit 50a0ec6); no assertion or
per-test budget changed. **CI run 27 (head 50a0ec6) passed on the first
attempt with no rerun**, so Windows is no longer a known-red check.

## E2E (server-driven, real stack)

`pnpm test:e2e` — 40 files / 266 tests against the booted dev stack
(next dev + 3 wrangler workers). Adapted for auto-provision and re-verified
locally (`onboard-flow`, `device-code`: 16/16). Covers signup → session,
workspace creation/scoping, invite accept lifecycle, member removal,
multi-workspace task routing, protected-route 401s.

Browser E2E (`pnpm test:e2e-ui`, Playwright) runs in CI on PRs touching
web/shared. Spec 09 fails on every run and specs 02/03/13/15/17 fail
intermittently — all with the same signature (a posted message never
appears in the feed after navigation), the documented pre-existing
base-branch refetch loop (control-verified on unmodified `main`, see PR
#1). Each newly-observed spec in that set was checked against the branch
locally before being classified: 02 and 13 both pass locally, and spec
13's popup test (`13-mentions.spec.ts:72`) exercises the `searchMembers`
path touched by the `likeInsensitive` seam, so the seam is exonerated by
a positive test rather than by assumption.

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
