import { NextRequest } from "next/server";
import { queries } from "@onecaptain/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { invalidate, cacheKeys } from "@/lib/cache";
import { getPlanLimits } from "@onecaptain/shared";
import { logWorkspaceAudit, WORKSPACE_AUDIT_ACTIONS } from "@/lib/workspace-audit";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { token } = ctx.params!;

  const db = getDb(ctx.env.DB);

  const invite = await queries.workspaceInvite.getInviteByToken(db, token);
  if (!invite) return writeError("invite not found", 404);
  if (invite.usedBy) return writeError("invite already used", 410);
  if (new Date(invite.expiresAt) < new Date()) return writeError("invite expired", 410);

  return writeJSON({
    workspace_name: invite.workspaceName,
    workspace_id: invite.workspaceId,
    invited_by: invite.creatorName || invite.creatorEmail,
  });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const { token } = ctx.params!;

  const db = getDb(ctx.env.DB);

  const invite = await queries.workspaceInvite.getInviteByToken(db, token);
  if (!invite) return writeError("invite not found", 404);
  if (invite.usedBy) return writeError("invite already used", 410);
  if (new Date(invite.expiresAt) < new Date()) return writeError("invite expired", 410);

  const existing = await queries.member.getMemberByUserAndWorkspace(db, ctx.userId, invite.workspaceId);
  if (existing) return writeError("already a member of this workspace", 409);

  // Seat quota — checked before the invite is consumed so a plan-limited
  // join leaves the invite redeemable once seats free up.
  const [plan, seats] = await Promise.all([
    queries.workspace.getWorkspacePlan(db, invite.workspaceId),
    queries.member.countMembers(db, invite.workspaceId),
  ]);
  if (seats >= getPlanLimits(plan).maxMembers) {
    return writeError("PLAN_SEAT_LIMIT_REACHED", 403);
  }

  const redeemed = await queries.workspaceInvite.redeemInvite(db, token, ctx.userId);
  if (!redeemed) return writeError("invite already used", 410);

  await queries.member.createMember(db, {
    workspaceId: invite.workspaceId,
    userId: ctx.userId,
    // Email invites can grant admin (set by an admin at creation); link
    // invites default to member. Never owner — ownership is not grantable
    // through invitations.
    role: invite.role === "admin" ? "admin" : "member",
  });

  logWorkspaceAudit(db, {
    workspaceId: invite.workspaceId,
    actorId: ctx.userId,
    action: WORKSPACE_AUDIT_ACTIONS.MEMBER_JOINED,
    targetType: "member",
    targetId: ctx.userId,
    changes: JSON.stringify({ inviteId: invite.id }),
  });

  await invalidate(cacheKeys.allMembers(invite.workspaceId));

  return writeJSON({ workspace_id: invite.workspaceId, workspace_slug: invite.workspaceSlug });
});
