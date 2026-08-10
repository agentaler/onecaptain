-- Cloud LLM provider attachment for bots. provider_kind is one of
-- 'anthropic' | 'openai' | 'openrouter' | 'custom' (NULL = runtime's own
-- auth). provider_api_key_enc holds the AES-256-GCM-encrypted API key —
-- plaintext keys are never stored.
ALTER TABLE community_bot_binding ADD COLUMN provider_kind TEXT;
ALTER TABLE community_bot_binding ADD COLUMN provider_api_url TEXT;
ALTER TABLE community_bot_binding ADD COLUMN provider_api_key_enc TEXT;
