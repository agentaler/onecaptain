-- Cloud-hosted agents: an agent may run against a provider API key with NO
-- machine at all, so `machine_id` stops being mandatory. SQLite has no
-- `ALTER COLUMN ... DROP NOT NULL`, so this is a table rebuild.
--
-- Everything else is preserved deliberately:
--   * `ON DELETE RESTRICT` on machine_id — deleting a machine that still has
--     bots bound to it must still error at the DB level.
--   * `ON DELETE CASCADE` from user — a hard user delete still drops the row.
--   * the columns added later by 0064 (model_name) and 0085 (provider_*), in
--     the order the live table has them, so the INSERT..SELECT is positional-safe.
--   * idx_community_bot_binding_machine, recreated after the rename.
PRAGMA defer_foreign_keys=ON;

CREATE TABLE community_bot_binding_new (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  machine_id TEXT REFERENCES community_machine(id) ON DELETE RESTRICT,
  runtime TEXT NOT NULL,
  created_at TEXT NOT NULL,
  model_name TEXT,
  provider_kind TEXT,
  provider_api_url TEXT,
  provider_api_key_enc TEXT
);

INSERT INTO community_bot_binding_new (
  user_id, machine_id, runtime, created_at,
  model_name, provider_kind, provider_api_url, provider_api_key_enc
)
SELECT
  user_id, machine_id, runtime, created_at,
  model_name, provider_kind, provider_api_url, provider_api_key_enc
FROM community_bot_binding;

DROP TABLE community_bot_binding;
ALTER TABLE community_bot_binding_new RENAME TO community_bot_binding;

CREATE INDEX idx_community_bot_binding_machine ON community_bot_binding(machine_id);
