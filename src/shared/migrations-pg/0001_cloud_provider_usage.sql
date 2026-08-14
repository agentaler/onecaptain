-- Postgres twin of src/web/migrations/0089_cloud_provider_usage.sql.
-- Hand-maintained in lockstep with the sqlite migration and both schema
-- files: this repo does not run drizzle-kit generate, so the pg baseline and
-- its snapshot are edited by hand (same convention as the sqlite side).
CREATE TABLE "workspace_provider_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"api_url" text,
	"api_key_enc" text NOT NULL,
	"last4" text NOT NULL,
	"created_by" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_usage_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_user_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" integer DEFAULT 0 NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_provider_credential" ADD CONSTRAINT "workspace_provider_credential_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_provider_credential" ADD CONSTRAINT "workspace_provider_credential_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_usage_event" ADD CONSTRAINT "agent_usage_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_usage_event" ADD CONSTRAINT "agent_usage_event_agent_user_id_user_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_provider_credential_kind_unique" ON "workspace_provider_credential" USING btree ("workspace_id","kind");--> statement-breakpoint
CREATE INDEX "idx_agent_usage_workspace_created" ON "agent_usage_event" USING btree ("workspace_id","created_at");
