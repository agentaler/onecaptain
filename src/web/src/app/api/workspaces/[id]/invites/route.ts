import { NextRequest } from "next/server";
import { queries } from "@onecaptain/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceRole } from "@/lib/middleware/workspace";
import { logWorkspaceAudit, WORKSPACE_AUDIT_ACTIONS } from "@/lib/workspace-audit";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { inviteToResponse } from "@/lib/api/responses";
import { sendEmail } from "@/lib/send-email";
import { getLinkEmailSubject, renderLinkEmail } from "@/lib/email-templates";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const owner = await withWorkspaceRole(req, ctx, "admin");
  if (owner instanceof Response) return owner;

  const db = getDb(ctx.env.DB);

  const invites = await queries.workspaceInvite.listActiveInvites(db, owner.workspaceId);
  return writeJSON(invites.map(inviteToResponse));
});

const INVITABLE_ROLES = new Set(["member", "admin"]);

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const owner = await withWorkspaceRole(req, ctx, "admin");
  if (owner instanceof Response) return owner;

  const db = getDb(ctx.env.DB);

  // Optional email delivery with a role grant (plans/saas-completion.md P3).
  // Bare POST keeps today's behavior: a shareable member-role link.
  const body = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return writeError("invalid email", 400);
  }
  const role = body.role ?? "member";
  if (!INVITABLE_ROLES.has(role)) {
    return writeError("role must be member or admin", 400);
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invite = await queries.workspaceInvite.createInvite(db, {
    workspaceId: owner.workspaceId,
    createdBy: ctx.userId,
    expiresAt,
    email,
    role,
  });
  logWorkspaceAudit(db, {
    workspaceId: owner.workspaceId,
    actorId: ctx.userId,
    action: WORKSPACE_AUDIT_ACTIONS.INVITE_CREATED,
    targetType: "invite",
    targetId: invite.id,
    changes: JSON.stringify({ expiresAt, email, role }),
  });

  if (email) {
    const workspace = await queries.workspace.getWorkspace(db, owner.workspaceId, ctx.userId);
    const base = ctx.env.BETTER_AUTH_URL || req.nextUrl.origin;
    const url = `${base}/invite/${invite.token}`;
    await sendEmail(ctx.env, {
      to: email,
      subject: getLinkEmailSubject("workspace-invite"),
      html: renderLinkEmail(
        "workspace-invite",
        url,
        `You've been invited to join ${workspace?.name ?? "a workspace"} on OneCaptain as ${role === "admin" ? "an admin" : "a member"}.`,
      ),
      actionUrl: url,
    });
  }

  return writeJSON(inviteToResponse(invite), 201);
});
