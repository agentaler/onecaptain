/**
 * Billing webhook endpoint tests (plans/saas-completion.md P4): the
 * @polar-sh/better-auth `webhooks()` plugin mounts POST
 * /api/auth/polar/webhooks with standardwebhooks signature verification.
 * These tests drive the REAL mounted endpoint with signed mock payloads —
 * no Polar API involved — and assert the sync layer receives (or does not
 * receive) the event.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Webhook } from "standardwebhooks"
import BetterSqlite3 from "better-sqlite3"

const syncPolarSubscription = vi.fn(async () => {})
vi.mock("./sync", () => ({
  syncPolarSubscription: (...args: unknown[]) => syncPolarSubscription(...args),
}))

// The webhook route never queries the auth tables, but better-auth
// initializes its adapter at construction — an in-memory better-sqlite3
// instance (natively supported) satisfies it without any schema.
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }))
const memoryDb = () => new BetterSqlite3(":memory:")

const WEBHOOK_SECRET = "test-webhook-secret"

async function makeAuth() {
  const { createAuth } = await import("@/lib/auth")
  return createAuth({
    NODE_ENV: "production",
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: "unit-secret",
    DB: memoryDb() as never,
    POLAR_ACCESS_TOKEN: "polar_sandbox_placeholder",
    POLAR_WEBHOOK_SECRET: WEBHOOK_SECRET,
    POLAR_SERVER: "sandbox",
  } as never)
}

/**
 * Full Polar wire-format (snake_case) subscription payload — validateEvent
 * parses against the SDK's strict zod schema, so every required field must
 * be present. Derived by validating against @polar-sh/sdk@0.49.0.
 */
function subscriptionPayload(type: string, overrides: Record<string, unknown> = {}) {
  const now = "2026-08-11T05:00:00.000Z"
  return {
    type,
    timestamp: now,
    data: {
      created_at: now, modified_at: null, id: "polar_sub_test",
      amount: 2000, currency: "usd", recurring_interval: "month",
      recurring_interval_count: 1, status: "active",
      current_period_start: now, current_period_end: "2026-09-11T00:00:00.000Z",
      current_meter_period_start: now, current_meter_period_end: now,
      cancel_at_period_end: false, pause_at_period_end: false,
      canceled_at: null, started_at: now, ends_at: null, ended_at: null,
      paused_at: null, resumes_at: now, trial_start: null, trial_end: null,
      pending_update: null,
      customer_id: "polar_cus_test", product_id: "prod_pro_monthly",
      discount_id: null, checkout_id: null,
      customer_cancellation_reason: null, customer_cancellation_comment: null,
      metadata: { referenceId: "sp_workspace_1" }, custom_field_data: {},
      customer: {
        id: "polar_cus_test", created_at: now, modified_at: null, metadata: {},
        external_id: "u_test", email: "owner@example.com", email_verified: true,
        name: "Owner", billing_name: "Owner", type: "individual",
        billing_address: null, tax_id: null, organization_id: "org_1",
        deleted_at: null, avatar_url: "https://example.com/a.png",
      },
      product: {
        created_at: now, modified_at: null, id: "prod_pro_monthly", name: "Pro",
        description: null, recurring_interval: "month", recurring_interval_count: 1,
        trial_interval: "month", trial_interval_count: 0,
        meter_interval: "month", meter_interval_count: 0,
        is_recurring: true, is_archived: false, visibility: "public",
        organization_id: "org_1", metadata: {}, prices: [], benefits: [],
        medias: [], attached_custom_fields: [],
      },
      discount: null, prices: [], meters: [],
      ...overrides,
    },
  }
}

function signedHeaders(body: string, secret = WEBHOOK_SECRET): Record<string, string> {
  // Mirrors @polar-sh/sdk validateEvent: the raw secret is base64-encoded
  // before standardwebhooks signing.
  const wh = new Webhook(Buffer.from(secret, "utf-8").toString("base64"))
  const id = `msg_${Math.random().toString(36).slice(2)}`
  const now = new Date()
  return {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": Math.floor(now.getTime() / 1000).toString(),
    "webhook-signature": wh.sign(id, now, body),
  }
}

async function post(body: string, headers: Record<string, string>) {
  const auth = await makeAuth()
  return auth.handler(
    new Request("http://localhost:3000/api/auth/polar/webhooks", {
      method: "POST",
      headers,
      body,
    }),
  )
}

beforeEach(() => {
  syncPolarSubscription.mockClear()
})

describe("POST /api/auth/polar/webhooks", () => {
  for (const type of ["subscription.created", "subscription.updated", "subscription.canceled"]) {
    it(`accepts a signed ${type} event and forwards it to the sync layer`, async () => {
      const body = JSON.stringify(subscriptionPayload(type))
      const res = await post(body, signedHeaders(body))
      expect(res.status).toBeLessThan(300)
      expect(syncPolarSubscription).toHaveBeenCalledTimes(1)
      const [, data] = syncPolarSubscription.mock.calls[0] as [unknown, { id: string; metadata: { referenceId: string } }]
      expect(data.id).toBe("polar_sub_test")
      expect(data.metadata.referenceId).toBe("sp_workspace_1")
    })
  }

  it("rejects a payload signed with the wrong secret", async () => {
    const body = JSON.stringify(subscriptionPayload("subscription.created"))
    const res = await post(body, signedHeaders(body, "attacker-secret"))
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(syncPolarSubscription).not.toHaveBeenCalled()
  })

  it("rejects an unsigned payload", async () => {
    const body = JSON.stringify(subscriptionPayload("subscription.created"))
    const res = await post(body, { "content-type": "application/json" })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(syncPolarSubscription).not.toHaveBeenCalled()
  })

  it("rejects a tampered body under a valid-for-other-content signature", async () => {
    const body = JSON.stringify(subscriptionPayload("subscription.created"))
    const headers = signedHeaders(body)
    const tampered = JSON.stringify(
      subscriptionPayload("subscription.created", { metadata: { referenceId: "sp_attacker" } }),
    )
    const res = await post(tampered, headers)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(syncPolarSubscription).not.toHaveBeenCalled()
  })

  it("does not mount the endpoint when billing is unconfigured", async () => {
    const { createAuth } = await import("@/lib/auth")
    const auth = createAuth({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "unit-secret",
      DB: memoryDb() as never,
    } as never)
    const body = JSON.stringify(subscriptionPayload("subscription.created"))
    const res = await auth.handler(
      new Request("http://localhost:3000/api/auth/polar/webhooks", {
        method: "POST",
        headers: signedHeaders(body),
        body,
      }),
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(syncPolarSubscription).not.toHaveBeenCalled()
  })
})
