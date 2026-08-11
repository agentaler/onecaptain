import { betterAuth } from "better-auth"
import { emailOTP, deviceAuthorization, bearer } from "better-auth/plugins"
import { polar, portal, webhooks } from "@polar-sh/better-auth"
import { Polar } from "@polar-sh/sdk"
import { nanoid } from "nanoid"
import {
  createLogger,
  DEV_EMAIL_WORKER_URL,
  resolveMode,
  queries,
  COMMUNITY_BOT_EMAIL_DOMAIN,
  RATE_LIMITS,
  sanitizeCommunityName,
} from "@onecaptain/shared"
import { getDb } from "@/lib/db"
import { checkRateLimit } from "@/lib/rate-limit"
import { getOtpSubject, renderOtpEmail, getLinkEmailSubject, renderLinkEmail } from "./email-templates"
import { sendEmail } from "./send-email"
import { syncPolarSubscription } from "./billing/sync"
import { requestOrigin } from "./forwarded-proto"

const log = createLogger({ service: "auth" })

const DEFAULT_OTP_RATE_LIMIT_MAX = RATE_LIMITS["auth:otpSend"].max
const DEFAULT_OTP_RATE_LIMIT_WINDOW_SEC = Math.round(
  RATE_LIMITS["auth:otpSend"].windowMs / 1000,
)

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function createAuth(env: Env) {
  const mode = resolveMode({ nodeEnv: env.NODE_ENV ?? process.env.NODE_ENV })
  const isProd = mode === "production"
  const otpMax = parsePositiveInt(env.AUTH_OTP_RATE_LIMIT_MAX, DEFAULT_OTP_RATE_LIMIT_MAX)
  const otpWindow = parsePositiveInt(
    env.AUTH_OTP_RATE_LIMIT_WINDOW_SEC,
    DEFAULT_OTP_RATE_LIMIT_WINDOW_SEC,
  )
  const validateClient = (clientId: string) => {
    const allowed = (env.DEVICE_CLIENT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean)
    return allowed.includes(clientId)
  }

  // Polar billing (plans/saas-completion.md P4). Mounted only when
  // configured — dev/test without POLAR_* boots exactly as before. The
  // plugin owns customer auto-creation, the customer portal, and the
  // signature-verified webhook endpoint (/polar/webhooks under the auth
  // route); checkout is deliberately NOT the plugin's — it goes through
  // the role-gated workspace billing route so only owner/admin can start
  // one.
  const polarPlugins = (() => {
    if (!env.POLAR_ACCESS_TOKEN || !env.POLAR_WEBHOOK_SECRET) return []
    const client = new Polar({
      accessToken: env.POLAR_ACCESS_TOKEN,
      server: env.POLAR_SERVER === "production" ? "production" : "sandbox",
    })
    return [
      polar({
        client,
        createCustomerOnSignUp: true,
        use: [
          portal(),
          webhooks({
            secret: env.POLAR_WEBHOOK_SECRET,
            onSubscriptionCreated: (p) => syncPolarSubscription(env, p.data as never),
            onSubscriptionUpdated: (p) => syncPolarSubscription(env, p.data as never),
            onSubscriptionActive: (p) => syncPolarSubscription(env, p.data as never),
            onSubscriptionCanceled: (p) => syncPolarSubscription(env, p.data as never),
            onSubscriptionRevoked: (p) => syncPolarSubscription(env, p.data as never),
            onSubscriptionUncanceled: (p) => syncPolarSubscription(env, p.data as never),
          }),
        ],
      }),
    ]
  })()

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    // Behind a TLS-terminating proxy Better Auth cannot infer its own origin:
    // the request arrives over plain http, so its derived trusted-origin list
    // never matches the https `Origin` the browser sent and every POST fails
    // with INVALID_ORIGIN. State the list instead of letting it be inferred —
    // the configured base URL, plus the origin this very request was sent to.
    trustedOrigins: (request?: Request) => {
      const origins: string[] = []
      if (env.BETTER_AUTH_URL) {
        try {
          origins.push(new URL(env.BETTER_AUTH_URL).origin)
        } catch {}
      }
      const self = request && requestOrigin(request)
      if (self && !origins.includes(self)) origins.push(self)
      return origins
    },
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    // Signed session-data cookie lets getSession() validate without hitting D1.
    // Fixes first-login 401 for newly-registered users: the just-written user row
    // may not yet be visible on a D1 read-replica, but the signed cookie carries
    // the session payload set by the sign-in handler itself.
    //
    // maxAge: in prod, 5min balances freshness (a revoked session stops being
    // honored within 5min) against D1 load. In dev/test it's 1h: the Playwright
    // e2e-ui suite mints one session per user at global-setup and drives it for
    // the whole run (>5min). Once the 5min cache lapsed, every seed request fell
    // through to a D1 `findSession`, which under the suite's late-run parallel
    // load returned null intermittently → a 401 cascade that flaked specs. A
    // longer dev cache keeps the signed-cookie fast path valid across the run.
    // Never widened in prod (revocation latency is a real security property).
    session: {
      expiresIn: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: {
        enabled: true,
        maxAge: isProd ? 5 * 60 : 60 * 60,
      },
    },
    // Email+password is a first-class prod method alongside OTP/social
    // (DECISIONS.md #2). Verification mail goes out on signup but does not
    // gate access — possession-of-inbox is already the OTP/social precedent.
    // Reset also serves OTP-created accounts wanting to add a password.
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: isProd ? 8 : 1,
      async sendResetPassword({ user, url }) {
        await sendEmail(env, {
          to: user.email,
          subject: getLinkEmailSubject("password-reset-link"),
          html: renderLinkEmail("password-reset-link", url),
          actionUrl: url,
        })
      },
    },
    emailVerification: {
      sendOnSignUp: isProd,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        await sendEmail(env, {
          to: user.email,
          subject: getLinkEmailSubject("email-verification-link"),
          html: renderLinkEmail("email-verification-link", url),
          actionUrl: url,
        })
      },
    },
    user: {
      additionalFields: {
        discriminator: {
          type: "string",
          required: false,
          input: false,
        },
        // Carried on the session user (and its signed cookie) so `withAuth`'s
        // session guard reads isBot/deletedAt off `getSession().user` instead
        // of a dedicated per-request `getUserInternal` D1 read. `input: false`
        // keeps them server-owned (never settable via signup/update). Their
        // freshness = the session cookie-cache period (prod 5min) — the guard
        // comment documents that revocation latency is bounded by it and NOT
        // loosened beyond today's getSession cookie window.
        isBot: {
          type: "boolean",
          required: false,
          input: false,
        },
        deletedAt: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    // Better-auth's built-in rate limiter is intentionally OFF — we run our
    // own DO-backed limiter inside `sendVerificationOTP` below. That gives
    // the OTP path strong consistency (better-auth's `customStorage`
    // adapter would still be a `get → mutate → put` sequence, race-prone
    // against KV; our DO handles the counter atomically) AND keeps every
    // rate limit going through the shared `RATE_LIMITS` registry.
    rateLimit: {
      enabled: false,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Reserve the bot synthetic-email domain (and every subdomain) so
            // a real signup can't collide with a bot row's UNIQUE(email). Only
            // bot creation should ever mint an address here; a public signup
            // means someone is impersonating or the domain assumption is wrong.
            const emailDomain = user.email?.split("@")[1]?.toLowerCase()
            if (
              emailDomain === COMMUNITY_BOT_EMAIL_DOMAIN ||
              emailDomain?.endsWith("." + COMMUNITY_BOT_EMAIL_DOMAIN)
            ) {
              return false as unknown as { data: typeof user }
            }
            // Mint the id here so we can seed `discriminator` (an FNV-1a hash
            // of the id) in the same INSERT — the schema default of "0000"
            // otherwise sticks and a backfill has to catch it.
            const id = (user as { id?: string }).id ?? nanoid()
            const trimmed = (user.name ?? "").trim()
            // The provider display name / email local-part can contain `#`/`@`,
            // which would break `@Name#dddd` mention grammar. Sanitize (never
            // reject — this is an auth callback) so the name is mention-safe.
            const name = sanitizeCommunityName(trimmed || user.email?.split("@")[0]?.trim() || user.name || "")
            // Better Auth's adapter inserts AFTER this hook returns — there's no
            // insert call here to wrap in a catch/retry like `withUniqueDiscriminator`
            // does. `probeAvailableDiscriminator` is a best-effort SELECT pre-check
            // instead (see its doc comment for the accepted residual race window;
            // the partial unique index is the actual backstop).
            const db = getDb(env.DB)
            const discriminator = await queries.user.probeAvailableDiscriminator(db, { id, name: name ?? "" })
            return { data: { ...user, id, name, discriminator } }
          },
          after: async (user, ctx) => {
            // Auto-provision the personal workspace (DECISIONS.md #6) for every
            // real signup, regardless of method. Bots never reach here (the
            // before-hook rejects the bot email domain for public signups, and
            // bot rows are inserted outside better-auth). Failure must not
            // abort signup — the lazy ensure on the workspace list route
            // provisions on first app load instead.
            if (!user.isBot) {
              try {
                await queries.workspace.ensurePersonalWorkspace(
                  getDb(env.DB),
                  user.id,
                  user.name ?? "",
                )
              } catch (err) {
                log.error("personal workspace provisioning failed", { userId: user.id, err })
              }
            }
            if (!ctx) return
            const path = ctx.request?.url ? new URL(ctx.request.url).pathname : ""
            let method = "unknown"
            if (path.includes("email-otp")) method = "email"
            else if (path.includes("github")) method = "github"
            else if (path.includes("password") || path.includes("sign-up")) method = "password"
            else if (path.includes("google")) method = "google"
            ctx.setCookie("is_new_signup", method, {
              maxAge: 60,
              path: "/",
              httpOnly: false,
              secure: isProd,
              sameSite: "lax",
            })
          },
        },
        update: {
          // The built-in `/update-user` endpoint writes `user.name` directly,
          // bypassing the profile route's validation. This hook is the actual
          // backstop for the `@Name#dddd` mention invariant: sanitize any name
          // being written so it can never contain `#`/`@`/line breaks. `update`
          // receives only the CHANGED fields (a partial), so no-op unless a name
          // is present.
          before: async (data) => {
            const partial = data as { name?: unknown }
            if (typeof partial.name !== "string") return
            return { data: { ...data, name: sanitizeCommunityName(partial.name) } }
          },
        },
      },
      session: {
        create: {
          // Belt-and-braces: refuse to mint a session for a bot user row.
          // Non-goal per plan: "logging in as a bot" — no UI, no session
          // token; enforced structurally here so a future flow that reaches
          // `session.create` can't accidentally hand a bot a cookie.
          before: async (session) => {
            try {
              const db = getDb(env.DB)
              const target = await queries.user.getUserInternal(db, session.userId)
              if (target?.isBot === true || target?.deletedAt !== null) {
                // Returning `false` cancels the create per Better-Auth API.
                return false as unknown as { data: typeof session }
              }
              return { data: session }
            } catch {
              // Best-effort — fall through and allow. The withAuth guard
              // catches this on the very next request anyway.
              return { data: session }
            }
          },
          after: async (session, ctx) => {
            if (!ctx) return
            const signupCookie = ctx.getCookie("is_new_signup")
            if (signupCookie) return
            const path = ctx.request?.url ? new URL(ctx.request.url).pathname : ""
            let method = "unknown"
            if (path.includes("email-otp")) method = "email_otp"
            else if (path.includes("github")) method = "github"
            else if (path.includes("google")) method = "google"
            ctx.setCookie("is_sign_in", method, {
              maxAge: 60,
              path: "/",
              httpOnly: false,
              secure: isProd,
              sameSite: "lax",
            })
          },
        },
      },
    },
    plugins: isProd
      ? [
          deviceAuthorization({ verificationUri: "/device", validateClient, expiresIn: "5m", schema: {} }),
          bearer(),
          emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
              // Rate-limit BEFORE minting/sending the OTP so abuse can't
              // burn a token slot or hit the email worker. Keyed by email
              // (the sender's target); anyone attempting to spam a
              // specific inbox gets throttled per inbox.
              const rate = await checkRateLimit(env, "auth:otpSend", email, {
                windowMs: otpWindow * 1000,
                max: otpMax,
              })
              if (!rate.allowed) {
                log.warn("OTP send rate-limited", {
                  to: email,
                  retryAfterSec: rate.retryAfterSec,
                })
                throw new Error(`OTP rate limit; retry in ${rate.retryAfterSec}s`)
              }
              log.info("sending OTP email", { to: email, type })
              try {
                const otpPayload = JSON.stringify({
                  to: email,
                  subject: getOtpSubject(type),
                  html: renderOtpEmail(otp, type),
                })
                const fetchOpts = {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: otpPayload,
                }
                let res: Response
                try {
                  res = await env.EMAIL_WORKER.fetch("http://internal/send/otp", fetchOpts)
                } catch {
                  res = await fetch(`${DEV_EMAIL_WORKER_URL}/send/otp`, fetchOpts)
                }
                if (!res.ok) {
                  const errBody = await res.text()
                  throw new Error(`EMAIL_WORKER /send/otp failed: ${res.status} ${errBody}`)
                }
                log.info("OTP email sent", { to: email, type })
              } catch (err) {
                log.error("OTP email failed", { to: email, type, err })
                throw err
              }
            },
          }),
          ...polarPlugins,
        ]
      : [
          deviceAuthorization({ verificationUri: "/device", validateClient, expiresIn: "5m", schema: {} }),
          bearer(),
          ...polarPlugins,
        ],
  })
}
