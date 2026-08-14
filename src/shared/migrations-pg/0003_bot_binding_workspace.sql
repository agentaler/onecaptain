-- Postgres twin of src/web/migrations/0091. See that file for why the column is
-- nullable and how the backfill picks the owner's oldest workspace.
--
-- The separator lines below are required: the runner splits on them and sends
-- each chunk as one prepared statement, and Postgres rejects multiple commands
-- in a single prepared statement. Do not name the separator token inside a
-- comment either -- the splitter is a plain string split and would cut there.
ALTER TABLE community_bot_binding
  ADD COLUMN workspace_id TEXT REFERENCES workspace(id) ON DELETE CASCADE;
--> statement-breakpoint
UPDATE community_bot_binding b
SET workspace_id = (
  SELECT m.workspace_id
  FROM member m
  JOIN "user" u ON u.id = b.user_id
  WHERE m.user_id = u."ownerUserId"
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT 1
)
WHERE b.workspace_id IS NULL;
--> statement-breakpoint
CREATE INDEX idx_community_bot_binding_workspace ON community_bot_binding(workspace_id);
