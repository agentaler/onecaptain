import { createLogger, queries } from "@onecaptain/shared"
import { getDb } from "@/lib/db"
import { planForProductId } from "@/config/billing"

const log = createLogger({ service: "billing-sync" })

/**
 * Shape shared by Polar subscription.* webhook payload data. Only the
 * fields the sync needs — payloads carry much more.
 */
export type PolarSubscriptionData = {
  id: string
  status: string
  productId?: string | null
  product?: { id?: string | null } | null
  customerId?: string | null
  currentPeriodEnd?: Date | string | null
  cancelAtPeriodEnd?: boolean | null
  metadata?: Record<string, unknown> | null
}

const ACTIVE_STATUSES = new Set(["active", "trialing"])

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

/**
 * Upserts local billing state from a Polar subscription event
 * (DECISIONS.md #4). The workspace is identified by the checkout's
 * referenceId, carried in subscription metadata. Idempotent — replays
 * rewrite identical values; unknown referenceIds are logged and skipped
 * (never a webhook 500, which would trigger Polar retries forever).
 */
export async function syncPolarSubscription(env: Env, data: PolarSubscriptionData): Promise<void> {
  const referenceId = data.metadata?.referenceId
  if (typeof referenceId !== "string" || !referenceId) {
    log.warn("subscription event without workspace referenceId", { subscriptionId: data.id })
    return
  }
  const productId = data.productId ?? data.product?.id ?? null
  const isActive = ACTIVE_STATUSES.has(data.status)
  const plan = isActive ? planForProductId(env, productId) : "free"

  const db = getDb(env.DB)
  await queries.subscription.syncSubscription(db, {
    workspaceId: referenceId,
    polarSubscriptionId: data.id,
    polarCustomerId: data.customerId ?? null,
    productId,
    plan,
    status: data.status,
    currentPeriodEnd: iso(data.currentPeriodEnd),
    cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
  })
  log.info("subscription synced", {
    workspaceId: referenceId,
    subscriptionId: data.id,
    status: data.status,
    plan,
  })
}
