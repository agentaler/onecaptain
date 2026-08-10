import { NextRequest } from "next/server";
import { queries } from "@onecaptain/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceRole } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";

/**
 * GET /api/workspaces/[id]/audit-log — tenant audit trail, admin+.
 * Cursor pagination via `?before=<createdAt>`; optional `?action=` filter.
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const admin = await withWorkspaceRole(req, ctx, "admin");
  if (admin instanceof Response) return admin;

  const db = getDb(ctx.env.DB);
  const params = req.nextUrl.searchParams;
  const rows = await queries.workspaceAudit.listAuditLog(db, admin.workspaceId, {
    action: params.get("action") ?? undefined,
    before: params.get("before") ?? undefined,
    limit: params.get("limit") ? Number(params.get("limit")) : undefined,
  });
  return writeJSON({ entries: rows });
});
