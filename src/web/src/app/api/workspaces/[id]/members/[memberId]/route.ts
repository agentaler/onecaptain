import { NextRequest } from "next/server";
import { queries, UpdateMemberRoleRequestSchema } from "@onecaptain/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceOwner } from "@/lib/middleware/workspace";
import { writeError, writeJSON, parseBody } from "@/lib/middleware/helpers";
import { invalidate, cacheKeys } from "@/lib/cache";
import { logWorkspaceAudit, WORKSPACE_AUDIT_ACTIONS } from "@/lib/workspace-audit";

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const owner = await withWorkspaceOwner(req, ctx);
  if (owner instanceof Response) return owner;

  const { memberId } = ctx.params!;

  const db = getDb(ctx.env.DB);

  const target = await queries.member.getMember(db, memberId, owner.workspaceId);
  if (!target) return writeError("member not found", 404);
  if (target.userId === ctx.userId) return writeError("cannot remove yourself", 400);
  if (target.role === "owner") return writeError("cannot remove a workspace owner", 403);

  await queries.member.deleteMember(db, memberId, owner.workspaceId);
  logWorkspaceAudit(db, {
    workspaceId: owner.workspaceId,
    actorId: ctx.userId,
    action: WORKSPACE_AUDIT_ACTIONS.MEMBER_REMOVED,
    targetType: "member",
    targetId: target.userId,
    changes: JSON.stringify({ memberId, role: target.role }),
  });
  await Promise.all([
    invalidate(cacheKeys.member(owner.workspaceId, target.userId)),
    invalidate(cacheKeys.allMembers(owner.workspaceId)),
  ]);

  return new Response(null, { status: 204 });
});

/**
 * Owner-only role management. `owner` itself is not grantable or revocable
 * here — ownership transfer is a distinct, deliberate operation — which also
 * guarantees the last owner can never be demoted through this endpoint.
 */
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const owner = await withWorkspaceOwner(req, ctx);
  if (owner instanceof Response) return owner;

  const { memberId } = ctx.params!;

  const [body, err] = await parseBody(req, UpdateMemberRoleRequestSchema);
  if (err) return err;

  const db = getDb(ctx.env.DB);

  const target = await queries.member.getMember(db, memberId, owner.workspaceId);
  if (!target) return writeError("member not found", 404);
  if (target.userId === ctx.userId) return writeError("cannot change your own role", 400);
  if (target.role === "owner") return writeError("cannot change a workspace owner's role", 403);
  if (target.role === body.role) {
    return writeJSON({ id: memberId, user_id: target.userId, role: target.role });
  }

  const updated = await queries.member.updateMemberRole(db, memberId, owner.workspaceId, body.role);
  if (!updated) return writeError("member not found", 404);

  logWorkspaceAudit(db, {
    workspaceId: owner.workspaceId,
    actorId: ctx.userId,
    action: WORKSPACE_AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
    targetType: "member",
    targetId: target.userId,
    changes: JSON.stringify({ memberId, from: target.role, to: body.role }),
  });

  await Promise.all([
    invalidate(cacheKeys.member(owner.workspaceId, target.userId)),
    invalidate(cacheKeys.allMembers(owner.workspaceId)),
  ]);

  return writeJSON({ id: memberId, user_id: target.userId, role: updated.role });
});
