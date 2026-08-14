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
web/shared. Spec 09 failed on every run and specs 02/03/13/15/17 failed
intermittently, all with the same visible signature: a message that is
known to exist never appears in the feed, and the composer never mounts.
Both causes below are now fixed. Each newly-observed spec was checked against the branch locally before
being classified: 02 and 13 both pass locally, and spec 13's popup test
(`13-mentions.spec.ts:72`) exercises the `searchMembers` path touched by
the `likeInsensitive` seam, so the seam is exonerated by a positive test
rather than by assumption.

Two separate causes hid behind that one signature. The record here was
wrong once in between: it retracted the original "refetch loop" label and
replaced it with "`GET /api/community/servers/:id/unreads` returns 500".
That retraction was the error — there is no 500, and the loop is real. The
first reading was right about the shape and only lacked the evidence,
which the reproduction below supplies.

1. *Cold-route fan-out.* Opening a channel fires ~7 API routes at once.
   Under `next dev` each pays a ~3s first compile and the dev server
   compiles them serially, so a cold set costs ~20s of wall clock —
   longer than the specs' own waits. The requests are still in flight when
   the spec gives up, which is why it reads as "the message never
   appeared". Measured directly: hitting those seven routes sequentially
   on a cold server takes 2.6–4.3s each. The setup warm-up now pre-builds
   them, and after that change every request in the trace completes.

2. *A self-retriggering refetch loop in the forum sidebar.* Once the
   fan-out was warmed, spec 09 reproduced standalone against a local stack
   with the dev server's own stderr captured (the harness starts services
   with `stdio: "ignore"`, which is why this was invisible for so long).
   The log shows **no 5xx anywhere** — the earlier "`/unreads` returns
   500" claim was wrong — and instead an unbounded alternation, ~2/second
   until the 60s timeout, of exactly two 200s:

   ```
   GET /api/community/servers/:id/channels?type=thread&parentType=forum&…&retainId=<child>
   GET /api/community/channels/<child>
   ```

   Cause: `seedForumSidebarResources` treated "the response omitted
   `retainId`" as "this child is gone" and evicted its `channelMeta` and
   `forumSidebarRetained` queries. But that sidebar query is scoped to
   `parentType=forum` — `listParticipatingForumThreads` even returns early
   when the server has no forum channels at all — so a thread under a
   **text** channel (spec 09's journey) is omitted because it was never in
   scope, not because it was deleted. The eviction ran inside the very
   `queryFn` whose query it removed, and React Query answers a
   `removeQueries` on an *active* query by refetching it, so each pass
   re-entered the pass that caused it. `routeHydrated` never settled and
   `channel-route.tsx` rendered `ComposerSkeleton` forever — which is the
   `community-composer-input` timeout the spec reports.

   Fix: evict only on positive evidence that the child is in scope
   (`isForumSidebarChild` — its `channelMeta` is loaded *and* names a
   forum parent). Eviction is destructive, so absence of evidence is not
   evidence of absence; when the parent type isn't known yet, leave the
   caches alone. The forum-parented eviction path (leave/delete/archive)
   is unchanged and still covered, and a child that is genuinely gone is
   still caught by the `channelMeta` 404 → `isDefinitiveChildMetaFailure`
   path in `use-channel-route-model`.

   Verified: same journey, same stack, before → after, the two request
   counts fell from 48 and ~40 to **2** and **1**, and spec 09 passes.

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
