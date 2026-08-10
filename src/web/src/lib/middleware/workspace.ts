import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { queries } from "@onecaptain/shared"
import { getDb } from "@/lib/db"
import { cached, cacheKeys } from "@/lib/cache"
import type { AuthContext } from "./auth"

export async function withWorkspaceMember(
  req: NextRequest,
  auth: AuthContext & { params?: Record<string, string> }
): Promise<{ workspaceId: string; memberRole: string } | NextResponse> {
  const workspaceId =
    req.nextUrl.searchParams.get("workspace_id") ||
    req.headers.get("X-Workspace-ID") ||
    auth.workspaceId

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspace_id is required" },
      { status: 400 }
    )
  }

  if (!auth.userId) {
    return NextResponse.json(
      { error: "user not authenticated" },
      { status: 401 }
    )
  }

  const { env } = await getCloudflareContext({ async: true })
  const db = getDb((env as Env).DB)

  const membership = await cached(
    cacheKeys.member(workspaceId, auth.userId),
    1800,
    () => queries.member.getMemberByUserAndWorkspace(db, auth.userId, workspaceId),
  )
  if (!membership && auth.workspaceId === workspaceId) {
    return { workspaceId, memberRole: "member" }
  }
  if (!membership) {
    return NextResponse.json(
      { error: "workspace not found" },
      { status: 404 }
    )
  }

  return { workspaceId, memberRole: membership.role }
}

/**
 * Workspace roles, weakest → strongest. `withWorkspaceRole(req, auth, min)`
 * admits any member whose role ranks at or above `min` — the single
 * role-comparison implementation, so route gates can't drift on ordering.
 */
const WORKSPACE_ROLES = ["member", "admin", "owner"] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

function roleRank(role: string): number {
  const idx = (WORKSPACE_ROLES as readonly string[]).indexOf(role)
  return idx === -1 ? 0 : idx
}

export async function withWorkspaceRole(
  req: NextRequest,
  auth: AuthContext & { params?: Record<string, string> },
  minRole: WorkspaceRole
): Promise<{ workspaceId: string; memberRole: string } | NextResponse> {
  const result = await withWorkspaceMember(req, auth)
  if (result instanceof NextResponse) return result

  if (roleRank(result.memberRole) < roleRank(minRole)) {
    return NextResponse.json(
      { error: `${minRole} access required` },
      { status: 403 }
    )
  }

  return result
}

export async function withWorkspaceOwner(
  req: NextRequest,
  auth: AuthContext & { params?: Record<string, string> }
): Promise<{ workspaceId: string; memberRole: string } | NextResponse> {
  return withWorkspaceRole(req, auth, "owner")
}
