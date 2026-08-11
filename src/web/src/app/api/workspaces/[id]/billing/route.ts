import { NextRequest } from "next/server";
import { queries, getPlanLimits } from "@onecaptain/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceRole } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";
import { getBillingPlans } from "@/config/billing";

/**
 * GET /api/workspaces/[id]/billing — current plan, subscription state, and
 * the plan catalog. Any member may view; mutating billing (checkout /
 * portal) is admin+ in the sibling routes.
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const member = await withWorkspaceRole(req, ctx, "member");
  if (member instanceof Response) return member;

  const db = getDb(ctx.env.DB);
  const [workspace, subscription] = await Promise.all([
    queries.workspace.getWorkspace(db, member.workspaceId, ctx.userId),
    queries.subscription.getSubscription(db, member.workspaceId),
  ]);

  const plan = workspace?.plan ?? "free";
  return writeJSON({
    plan,
    limits: getPlanLimits(plan),
    role: member.memberRole,
    billingConfigured: Boolean(ctx.env.POLAR_ACCESS_TOKEN),
    plans: getBillingPlans(ctx.env).map((p) => ({
      plan: p.plan,
      label: p.label,
      description: p.description,
      limits: p.limits,
      hasProducts: p.productIds.length > 0,
    })),
    subscription: subscription
      ? {
          status: subscription.status,
          plan: subscription.plan,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
  });
});
