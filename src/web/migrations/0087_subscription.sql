-- Polar billing: one row per workspace, written ONLY by webhook sync
-- (plans/saas-completion.md P4). workspace.plan stays the request-path
-- gating source; the sync updates both together.
CREATE TABLE `subscription` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `polar_subscription_id` text,
  `polar_customer_id` text,
  `product_id` text,
  `plan` text DEFAULT 'free' NOT NULL,
  `status` text DEFAULT 'none' NOT NULL,
  `current_period_end` text,
  `cancel_at_period_end` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `subscription_workspace_unique` ON `subscription` (`workspace_id`);
CREATE INDEX `idx_subscription_polar_id` ON `subscription` (`polar_subscription_id`);
