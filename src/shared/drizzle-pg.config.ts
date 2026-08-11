import { defineConfig } from "drizzle-kit";

// Generates the Postgres baseline migration from the pg-core schema twins.
// Usage: pnpm --filter @onecaptain/shared db:generate:pg
export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/db/pg/schema.ts",
    "./src/db/pg/community-schema.ts",
    "./src/db/pg/community-machine-schema.ts",
  ],
  out: "./migrations-pg",
});
