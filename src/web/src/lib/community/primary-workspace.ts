import { queries, type Database } from "@onecaptain/shared"

/**
 * The workspace a community-surface request acts on.
 *
 * `/c` is user-scoped — its routes authenticate a user, not a workspace, and
 * there is no workspace in the URL or the session. But LLM credentials and the
 * usage ledger are workspace-scoped, because that is who pays. So the community
 * routes resolve one here.
 *
 * "Oldest membership" is not arbitrary: it is the same rule migration 0091 used
 * to backfill `community_bot_binding.workspace_id`, so an agent created from
 * `/c` and an agent backfilled by that migration land in the SAME workspace.
 * Any other rule here would silently split an owner's agents across tenants.
 *
 * A user with several workspaces who wants to target a specific one uses the
 * workspace settings surface, which carries an explicit id.
 */
export async function primaryWorkspaceIdForUser(
  db: Database,
  userId: string,
): Promise<string | null> {
  // Ordered by createdAt asc by the query itself.
  const workspaces = await queries.workspace.listWorkspaces(db, userId)
  return workspaces[0]?.id ?? null
}
