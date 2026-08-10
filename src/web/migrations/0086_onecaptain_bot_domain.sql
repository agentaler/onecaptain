-- Rebrand backfill: internal bot email addresses minted under the old
-- reserved domain move to the new one (BOT_EMAIL_DOMAIN in
-- src/shared/src/constants.ts). Additive data migration — 0006's applied
-- history is left untouched.
UPDATE "user"
SET email = replace(email, '@bots.alook.local', '@bots.onecaptain.local')
WHERE email LIKE '%@bots.alook.local';
