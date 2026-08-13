import { eq } from "drizzle-orm";
import { subscription, workspace } from "../schema";
import type { Database } from "../index";

export type SubscriptionSync = {
  workspaceId: string;
  polarSubscriptionId: string;
  polarCustomerId?: string | null;
  productId?: string | null;
  /** Resolved plan for the product ("pro"), or "free" when the sub ends. */
  plan: string;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
};

export async function getSubscription(db: Database, workspaceId: string) {
  const rows = await db
    .select()
    .from(subscription)
    .where(eq(subscription.workspaceId, workspaceId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * The ONLY writer of billing state (DECISIONS.md #4), called from Polar
 * webhook handlers. Idempotent: keyed by workspaceId (one row per
 * workspace); replaying the same event rewrites identical values. Updates
 * `workspace.plan` in the same batch so request-path gating (PLAN_LIMITS
 * reads workspace.plan) flips atomically with the subscription row.
 */
export async function syncSubscription(db: Database, sync: SubscriptionSync) {
  const now = new Date().toISOString();
  const existing = await getSubscription(db, sync.workspaceId);

  // Ignore events for a different (older) subscription than the one we
  // currently track, unless we track none or this replaces it — Polar can
  // deliver out-of-order events across subscription generations.
  if (
    existing?.polarSubscriptionId &&
    existing.polarSubscriptionId !== sync.polarSubscriptionId &&
    existing.status === "active" &&
    sync.status !== "active"
  ) {
    return existing;
  }

  const values = {
    workspaceId: sync.workspaceId,
    polarSubscriptionId: sync.polarSubscriptionId,
    polarCustomerId: sync.polarCustomerId ?? existing?.polarCustomerId ?? null,
    productId: sync.productId ?? null,
    plan: sync.plan,
    status: sync.status,
    currentPeriodEnd: sync.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sync.cancelAtPeriodEnd ?? false,
    updatedAt: now,
  };

  await db.batch([
    existing
      ? db.update(subscription).set(values).where(eq(subscription.workspaceId, sync.workspaceId))
      : db.insert(subscription).values(values),
    db
      .update(workspace)
      .set({ plan: sync.plan, updatedAt: now })
      .where(eq(workspace.id, sync.workspaceId)),
  ]);

  return getSubscription(db, sync.workspaceId);
}
