-- Cloud-hosted agents, part 1: the credential a workspace brings once, and
-- the ledger every provider call is recorded in.
--
-- workspace_provider_credential is the fallback a cloud-run agent resolves
-- against when its bot names no provider of its own; community_bot_binding
-- keeps its per-bot override. The key is stored only encrypted; `last4` is
-- what reads expose so the UI can show which key is set without handing it
-- back.
CREATE TABLE `workspace_provider_credential` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `kind` text NOT NULL,
  `api_url` text,
  `api_key_enc` text NOT NULL,
  `last4` text NOT NULL,
  `created_by` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX `workspace_provider_credential_kind_unique` ON `workspace_provider_credential` (`workspace_id`,`kind`);

-- agent_usage_event is append-only. cost_micros is USD micros as an integer
-- (money never touches a float) and holds the provider's list price; platform
-- markup is applied at invoice time so changing it never rewrites history.
-- `billable` keeps BYO-key calls out of invoices while still metering them.
CREATE TABLE `agent_usage_event` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `agent_user_id` text,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `input_tokens` integer DEFAULT 0 NOT NULL,
  `output_tokens` integer DEFAULT 0 NOT NULL,
  `cost_micros` integer DEFAULT 0 NOT NULL,
  `billable` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`agent_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `idx_agent_usage_workspace_created` ON `agent_usage_event` (`workspace_id`,`created_at`);
