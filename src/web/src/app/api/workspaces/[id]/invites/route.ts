import { NextRequest } from "next/server";
import { queries } from "@onecaptain/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceRole } from "@/lib/middleware/workspace";
import { logWorkspaceAudit, WORKSPACE_AUDIT_ACTIONS } from "@/lib/workspace-audit";
import { writeJSON } from "@/lib/middleware/helpers";
import { inviteToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const owner = await withWorkspaceRole(req, ctx, "admin");
  if (owner instanceof Response) return owner;

  const db = getDb(ctx.env.DB);

  const invites = await queries.workspaceInvite.listActiveInvites(db, owner.workspaceId);
  return writeJSON(invites.map(inviteToResponse));
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const owner = await withWorkspaceRole(req, ctx, "admin");
  if (owner instanceof Response) return owner;

  const db = getDb(ctx.env.DB);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invite = await queries.workspaceInvite.createInvite(db, {
    workspaceId: owner.workspaceId,
    createdBy: ctx.userId,
    expiresAt,
  });
  logWorkspaceAudit(db, {
    workspaceId: owner.workspaceId,
    actorId: ctx.userId,
    action: WORKSPACE_AUDIT_ACTIONS.INVITE_CREATED,
    targetType: "invite",
    targetId: invite.id,
    changes: JSON.stringify({ expiresAt }),
  });
  return writeJSON(inviteToResponse(invite), 201);
});
