-- Cloud-hosted agents are billed and quota'd per WORKSPACE, but a bot is only
-- owner-scoped today (`user.owner_user_id`) — there is no path from an agent to
-- the tenant that pays for it. `agent_usage_event.workspace_id` and the
-- workspace-level provider credential both need one, and AGENTS.md requires
-- scoping a query by tenant up front rather than resolving it after the fact.
--
-- Nullable + backfilled rather than NOT NULL: an owner with no workspace row at
-- all would otherwise block the migration, and the application treats a NULL
-- workspace as "not runnable in the cloud" (the machine path is unaffected).
ALTER TABLE community_bot_binding
  ADD COLUMN workspace_id TEXT REFERENCES workspace(id) ON DELETE CASCADE;

-- Backfill: an existing bot belongs to its owner's oldest workspace, which is
-- the personal workspace auto-provisioned at signup unless the user has since
-- left it. `member` is the membership table; ties break on id so the result is
-- deterministic rather than dependent on scan order.
--
-- Note the two quoting shapes: `user` is a reserved word so it is quoted, and
-- its owner column is camelCase (`"ownerUserId"`, created by Better-Auth) while
-- `member` is snake_case. Getting either wrong fails at migrate time, not
-- silently — but only if something actually runs the migration, which is why
-- the backfill is asserted in a test.
UPDATE community_bot_binding
SET workspace_id = (
  SELECT m.workspace_id
  FROM member m
  JOIN "user" u ON u.id = community_bot_binding.user_id
  WHERE m.user_id = u."ownerUserId"
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT 1
)
WHERE workspace_id IS NULL;

CREATE INDEX idx_community_bot_binding_workspace ON community_bot_binding(workspace_id);
