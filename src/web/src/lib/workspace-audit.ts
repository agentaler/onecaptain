import { queries, createLogger } from "@onecaptain/shared"
import type { Database } from "@onecaptain/shared"

const log = createLogger({ service: "workspace-audit" })

/**
 * Typed audit-action union for the workspace (tenant) product. Keep string
 * values stable across releases — stored `workspace_audit_log.action` rows
 * reference these verbatim.
 */
export const WORKSPACE_AUDIT_ACTIONS = {
  WORKSPACE_UPDATED: "workspace.updated",
  WORKSPACE_DELETED: "workspace.deleted",
  MEMBER_JOINED: "workspace.member.joined",
  MEMBER_REMOVED: "workspace.member.removed",
  MEMBER_ROLE_CHANGED: "workspace.member.role_changed",
  INVITE_CREATED: "workspace.invite.created",
  INVITE_REVOKED: "workspace.invite.revoked",
  AGENT_CREATED: "workspace.agent.created",
  AGENT_DELETED: "workspace.agent.deleted",
} as const

type WorkspaceAuditAction = {
  workspaceId: string
  /** Null for system-initiated actions. */
  actorId: string | null
  action: (typeof WORKSPACE_AUDIT_ACTIONS)[keyof typeof WORKSPACE_AUDIT_ACTIONS]
  targetType?: string
  targetId?: string
  changes?: string
}

/**
 * Fire-and-forget tenant audit write. Mirrors the community `logAudit`
 * policy: an audit failure must never block or fail the action it records —
 * it logs a warn and moves on.
 */
export function logWorkspaceAudit(db: Database, action: WorkspaceAuditAction): void {
  try {
    queries.workspaceAudit.logAction(db, action).catch((err) => {
      log.warn("workspace_audit_write_failed", {
        err: String(err),
        action: action.action,
        workspaceId: action.workspaceId,
        targetType: action.targetType,
        targetId: action.targetId,
      })
    })
  } catch (err) {
    log.warn("workspace_audit_write_failed", { err: String(err), action: action.action })
  }
}
