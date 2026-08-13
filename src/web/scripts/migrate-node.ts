/**
 * Node-platform migration runner (Railway): replays src/web/migrations
 * against the libSQL database at DATABASE_URL, mirroring `wrangler d1
 * migrations apply` semantics (same d1_migrations tracking table). Run via
 * `pnpm db:migrate:node` — the Railway `web` service runs this before
 * `next start`.
 */
import { resolve } from "node:path";
import { createNodeClient, applyMigrations } from "@onecaptain/shared/db-node";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required (e.g. file:/data/onecaptain.db)");
    process.exit(1);
  }

  const migrationsDir = resolve(__dirname, "../migrations");
  const applied = await applyMigrations(createNodeClient(url), migrationsDir);
  console.log(
    applied.length === 0
      ? "migrations: already up to date"
      : `migrations: applied ${applied.length} (${applied[0]} … ${applied[applied.length - 1]})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
