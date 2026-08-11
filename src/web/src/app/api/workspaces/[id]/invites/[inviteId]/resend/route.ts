import { NextRequest } from "next/server";
import { queries } from "@onecaptain/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceRole } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { sendEmail } from "@/lib/send-email";
import { getLinkEmailSubject, renderLinkEmail } from "@/lib/email-templates";

/**
 * POST /api/workspaces/[id]/invites/[inviteId]/resend — re-send an email
 * invite (admin+). Only pending email invites qualify.
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const admin = await withWorkspaceRole(req, ctx, "admin");
  if (admin instanceof Response) return admin;

  const { inviteId } = ctx.params!;
  const db = getDb(ctx.env.DB);

  const invite = await queries.workspaceInvite.getInvite(db, inviteId, admin.workspaceId);
  if (!invite) return writeError("invite not found", 404);
  if (!invite.email) return writeError("invite has no email to resend to", 400);
  if (invite.usedBy) return writeError("invite already used", 410);
  if (new Date(invite.expiresAt) < new Date()) return writeError("invite expired", 410);

  const workspace = await queries.workspace.getWorkspace(db, admin.workspaceId, ctx.userId);
  const base = ctx.env.BETTER_AUTH_URL || req.nextUrl.origin;
  const url = `${base}/invite/${invite.token}`;
  await sendEmail(ctx.env, {
    to: invite.email,
    subject: getLinkEmailSubject("workspace-invite"),
    html: renderLinkEmail(
      "workspace-invite",
      url,
      `You've been invited to join ${workspace?.name ?? "a workspace"} on OneCaptain.`,
    ),
    actionUrl: url,
  });

  return writeJSON({ ok: true });
});
