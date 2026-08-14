-- Cloud-hosted agents: an agent may run against a provider API key with no
-- machine, so `machine_id` stops being mandatory. Postgres twin of the SQLite
-- table rebuild in src/web/migrations/0090 (SQLite has no DROP NOT NULL).
-- The RESTRICT foreign key is untouched: deleting a machine that still has
-- bots bound to it must still error.
ALTER TABLE community_bot_binding ALTER COLUMN machine_id DROP NOT NULL;
