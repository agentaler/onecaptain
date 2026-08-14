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
   * Secret (wrangler secret put ENCRYPTION_KEY) — the SAME value as `src/web`'s
   * ENCRYPTION_KEY. Two jobs: it decrypts
   * `community_bot_binding.provider_api_key_enc` so a wake can carry a bot's
   * cloud-provider key, and it signs the request that asks the web worker to
   * run a cloud agent turn (see `internal-auth.ts`).
   *
   * Required, not optional. It used to be optional so "legacy deploys without
   * the secret keep working", but that is precisely what produced a silent
   * degrade: a provider-configured bot would quietly wake on the runtime's own
   * auth instead. Declaring it required makes a missing value a deployment
   * error the config health check reports, rather than a mystery.
   */
  ENCRYPTION_KEY: string
}
