-- Email-delivered role invites (plans/saas-completion.md P3): an invite may
-- carry the invitee address (delivery + display) and the role granted at
-- acceptance. Link-only invites keep NULL email and the default role.
ALTER TABLE `workspace_invite` ADD COLUMN `email` text;
ALTER TABLE `workspace_invite` ADD COLUMN `role` text NOT NULL DEFAULT 'member';
