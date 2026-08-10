import { NextRequest } from "next/server";
import { queries } from "@onecaptain/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceRole } from "@/lib/middleware/workspace";
import { logWorkspaceAudit, WORKSPACE_AUDIT_ACTIONS } from "@/lib/workspace-audit";
import { writeError } from "@/lib/middleware/helpers";

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const owner = await withWorkspaceRole(req, ctx, "admin");
  if (owner instanceof Response) return owner;

  const { inviteId } = ctx.params!;

  const db = getDb(ctx.env.DB);

  const deleted = await queries.workspaceInvite.deleteInvite(db, inviteId, owner.workspaceId);
  if (!deleted) return writeError("invite not found", 404);

  logWorkspaceAudit(db, {
    workspaceId: owner.workspaceId,
    actorId: ctx.userId,
    action: WORKSPACE_AUDIT_ACTIONS.INVITE_REVOKED,
    targetType: "invite",
    targetId: inviteId,
  });

  return new Response(null, { status: 204 });
});
