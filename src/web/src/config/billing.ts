import { PLAN_LIMITS, type WorkspacePlan } from "@onecaptain/shared"

/**
 * Single source of truth for billing plans (plans/saas-completion.md P4).
 * Limits live in the shared PLAN_LIMITS registry (also enforced at
 * agent-create and invite-accept); this file adds the Polar product
 * mapping and display metadata. Product ids come from env so sandbox and
 * production differ only in configuration.
 */
export type BillingPlan = {
  plan: WorkspacePlan
  label: string
  description: string
  /** Polar product ids that resolve to this plan (monthly, yearly, …). */
  productIds: string[]
  limits: (typeof PLAN_LIMITS)[WorkspacePlan]
}

export function getBillingPlans(env: {
  POLAR_PRODUCT_PRO_MONTHLY?: string
  POLAR_PRODUCT_PRO_YEARLY?: string
}): BillingPlan[] {
  return [
    {
      plan: "free",
      label: "Free",
      description: "For getting started — personal projects and small crews.",
      productIds: [],
      limits: PLAN_LIMITS.free,
    },
    {
      plan: "pro",
      label: "Pro",
      description: "For teams — more agents, more seats, priority lanes.",
      productIds: [env.POLAR_PRODUCT_PRO_MONTHLY, env.POLAR_PRODUCT_PRO_YEARLY].filter(
        (id): id is string => Boolean(id),
      ),
      limits: PLAN_LIMITS.pro,
    },
  ]
}

/** Maps a Polar product id from a webhook payload to a workspace plan. */
export function planForProductId(
  env: { POLAR_PRODUCT_PRO_MONTHLY?: string; POLAR_PRODUCT_PRO_YEARLY?: string },
  productId: string | null | undefined,
): WorkspacePlan {
  if (!productId) return "free"
  const pro = getBillingPlans(env).find((p) => p.plan === "pro")
  return pro?.productIds.includes(productId) ? "pro" : "free"
}
