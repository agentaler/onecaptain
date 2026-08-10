import { NextRequest } from "next/server";
import { queries, UpdateWorkspaceRequestSchema, DeleteWorkspaceRequestSchema, isUniqueConstraintError } from "@onecaptain/shared"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceOwner } from "@/lib/middleware/workspace";
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers";
import { workspaceToResponse } from "@/lib/api/responses";
import { logWorkspaceAudit, WORKSPACE_AUDIT_ACTIONS } from "@/lib/workspace-audit";

export const GET = withAuth(async (_req, ctx) => {
  const db = getDb(ctx.env.DB)

  const id = ctx.params?.id;
  if (!id) {
    return writeError("workspace id is required", 400);
  }

  const workspace = await queries.workspace.getWorkspace(db, id, ctx.userId);
  if (!workspace) {
    return writeError("workspace not found", 404);
  }

  return writeJSON(workspaceToResponse(workspace));
});

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const owner = await withWorkspaceOwner(req, ctx);
  if (owner instanceof Response) return owner;

  const [body, err] = await parseBody(req, UpdateWorkspaceRequestSchema);
  if (err) return err;

  if (body.slug !== undefined && body.slug === "") return writeError("slug is required", 400);
  if (!body.name && !body.slug) return writeError("at least one of name or slug is required", 400);

  const db = getDb(ctx.env.DB);

  try {
    const updated = await queries.workspace.updateWorkspace(db, owner.workspaceId, body);
    if (!updated) return writeError("workspace not found", 404);
    logWorkspaceAudit(db, {
      workspaceId: owner.workspaceId,
      actorId: ctx.userId,
      action: WORKSPACE_AUDIT_ACTIONS.WORKSPACE_UPDATED,
      targetType: "workspace",
      targetId: owner.workspaceId,
      changes: JSON.stringify({ name: body.name, slug: body.slug }),
    });
    return writeJSON(workspaceToResponse(updated));
  } catch (err: unknown) {
    if (isUniqueConstraintError(err)) return writeError("slug already in use", 409);
    throw err;
  }
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const owner = await withWorkspaceOwner(req, ctx);
  if (owner instanceof Response) return owner;

  const [body, err] = await parseBody(req, DeleteWorkspaceRequestSchema);
  if (err) return err;

  const db = getDb(ctx.env.DB);

  const ws = await queries.workspace.getWorkspace(db, owner.workspaceId, ctx.userId);
  if (!ws) return writeError("workspace not found", 404);
  if (ws.name !== body.confirm_name) return writeError("workspace name does not match", 400);

  // The audit table has no FK on purpose, so this row survives the tenant it
  // documents being deleted.
  logWorkspaceAudit(db, {
    workspaceId: owner.workspaceId,
    actorId: ctx.userId,
    action: WORKSPACE_AUDIT_ACTIONS.WORKSPACE_DELETED,
    targetType: "workspace",
    targetId: owner.workspaceId,
    changes: JSON.stringify({ name: ws.name }),
  });
  await queries.workspace.deleteWorkspace(db, owner.workspaceId);
  return new Response(null, { status: 204 });
});
