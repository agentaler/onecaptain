-- Multi-tenant hardening: per-workspace billing plan + tenant audit log.
-- workspace_audit_log.workspace_id is deliberately NOT a foreign key so audit
-- rows (including workspace.deleted) survive tenant deletion.
ALTER TABLE workspace ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';

CREATE TABLE workspace_audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  changes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_workspace_audit_log_ws_created ON workspace_audit_log(workspace_id, created_at);
