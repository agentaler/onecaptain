interface Env {
  WS_DO_WORKER: Fetcher
  /**
   * `onecaptain-app` — the same D1 database `src/web/wrangler.toml` binds as
   * `DB` (minimal-wake-queue-unread-notice plan §3). The consumer reads
   * current message/bot/binding/read-state rows here to rebuild the
   * `agent:wake` command at consume time (`buildUnreadWakeCommand`).
   */
  DB: D1Database
  /**
   * Secret (wrangler secret put ENCRYPTION_KEY) — same value as `src/web`'s
   * ENCRYPTION_KEY. Decrypts `community_bot_binding.provider_api_key_enc` so
   * a wake can carry the bot's cloud-provider key in its RuntimeConfig.
   * Optional: without it, provider-configured bots wake with the runtime's
   * own auth (a warn is logged).
   */
  ENCRYPTION_KEY?: string
}
