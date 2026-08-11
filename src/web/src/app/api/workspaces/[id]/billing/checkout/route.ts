import { NextRequest } from "next/server";
import { Polar } from "@polar-sh/sdk";
import { getDb } from "@/lib/db";
import { queries } from "@onecaptain/shared";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceRole } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { getBillingPlans } from "@/config/billing";

/**
 * POST /api/workspaces/[id]/billing/checkout — start a Polar checkout for
 * the Pro plan, billed to THIS workspace (referenceId, DECISIONS.md #4).
 * Server-side role enforcement: owner/admin only — this is why checkout
 * does not go through the auth plugin's generic endpoint.
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const admin = await withWorkspaceRole(req, ctx, "admin");
  if (admin instanceof Response) return admin;

  if (!ctx.env.POLAR_ACCESS_TOKEN) {
    return writeError("billing is not configured", 503);
  }
  const body = (await req.json().catch(() => ({}))) as { interval?: string };
  const pro = getBillingPlans(ctx.env).find((p) => p.plan === "pro");
  const productId =
    body.interval === "yearly" && ctx.env.POLAR_PRODUCT_PRO_YEARLY
      ? ctx.env.POLAR_PRODUCT_PRO_YEARLY
      : pro?.productIds[0];
  if (!productId) {
    return writeError("no Pro product configured", 503);
  }

  const db = getDb(ctx.env.DB);
  const [user, workspace] = await Promise.all([
    queries.user.getUserInternal(db, ctx.userId),
    queries.workspace.getWorkspace(db, admin.workspaceId, ctx.userId),
  ]);

  const polar = new Polar({
    accessToken: ctx.env.POLAR_ACCESS_TOKEN,
    server: ctx.env.POLAR_SERVER === "production" ? "production" : "sandbox",
  });
  const base = ctx.env.BETTER_AUTH_URL || req.nextUrl.origin;
  const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl: `${base}/w/${workspace?.slug ?? admin.workspaceId}/settings?billing=success`,
    externalCustomerId: ctx.userId,
    customerEmail: user?.email,
    metadata: { referenceId: admin.workspaceId },
  });

  return writeJSON({ url: checkout.url });
});
