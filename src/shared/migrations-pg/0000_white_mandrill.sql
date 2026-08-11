CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" text,
	"refreshTokenExpiresAt" text,
	"scope" text,
	"idToken" text,
	"password" text,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent" (
	"id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"runtime_id" text,
	"runtime_mode" text DEFAULT 'local' NOT NULL,
	"runtime_config" json,
	"visibility" text DEFAULT 'private' NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"max_concurrent_tasks" integer DEFAULT 6 NOT NULL,
	"owner_id" text,
	"tools" json,
	"triggers" json,
	"email_handle" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "agent_id_workspace_id_pk" PRIMARY KEY("id","workspace_id"),
	CONSTRAINT "agent_email_handle_unique" UNIQUE("email_handle")
);
--> statement-breakpoint
CREATE TABLE "agent_access" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "agent_access_agent_ws_user" UNIQUE("agent_id","workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "agent_email_account" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"email_address" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"imap_host" text NOT NULL,
	"imap_port" integer DEFAULT 993 NOT NULL,
	"imap_username" text NOT NULL,
	"imap_password" text NOT NULL,
	"imap_tls" boolean DEFAULT true NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"smtp_username" text NOT NULL,
	"smtp_password" text NOT NULL,
	"smtp_tls" integer DEFAULT 1 NOT NULL,
	"poll_interval_seconds" integer DEFAULT 60 NOT NULL,
	"last_synced_uid" text DEFAULT '0' NOT NULL,
	"last_synced_at" text,
	"status" text DEFAULT 'active' NOT NULL,
	"error_message" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "email_account_agent_email" UNIQUE("agent_id","email_address")
);
--> statement-breakpoint
CREATE TABLE "agent_link" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"source_agent_id" text NOT NULL,
	"target_agent_id" text NOT NULL,
	"instruction" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "agent_link_ws_source_target" UNIQUE("workspace_id","source_agent_id","target_agent_id")
);
--> statement-breakpoint
CREATE TABLE "agent_pin" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "agent_pin_agent_ws_user" UNIQUE("agent_id","workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "agent_runtime" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"daemon_id" text NOT NULL,
	"runtime_mode" text DEFAULT 'local' NOT NULL,
	"provider" text NOT NULL,
	"device_info" text DEFAULT '' NOT NULL,
	"metadata" json,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "agent_runtime_workspace_daemon_provider" UNIQUE("workspace_id","daemon_id","provider")
);
--> statement-breakpoint
CREATE TABLE "agent_sidebar_order" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "agent_sidebar_order_agent_ws_user" UNIQUE("agent_id","workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "agent_skill" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_id" text,
	"daemon_id" text,
	"runtime" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"synced_at" text NOT NULL,
	CONSTRAINT "agent_skill_ws_runtime_name_agent_daemon" UNIQUE("workspace_id","runtime","name","agent_id","daemon_id")
);
--> statement-breakpoint
CREATE TABLE "agent_task_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"runtime_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"prompt" text NOT NULL,
	"type" text DEFAULT 'user_dm_message' NOT NULL,
	"context_key" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"result" json,
	"context" json,
	"session_id" text,
	"created_at" text NOT NULL,
	"dispatched_at" text,
	"started_at" text,
	"completed_at" text,
	"error" text,
	"trace_id" text,
	"parent_task_id" text
);
--> statement-breakpoint
CREATE TABLE "agent_whitelist" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "agent_whitelist_agent_ws_email" UNIQUE("agent_id","workspace_id","email")
);
--> statement-breakpoint
CREATE TABLE "artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"size" integer NOT NULL,
	"r2_key" text NOT NULL,
	"thumbnail_r2_key" text,
	"source" text DEFAULT 'agent' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scheduled_at" text NOT NULL,
	"repeat_interval" text,
	"repeat_stop_at" text,
	"last_triggered_at" text,
	"exceptions" json DEFAULT '[]'::json NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "channel_workspace_name" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'user_dm_message' NOT NULL,
	"channel" text DEFAULT 'default' NOT NULL,
	"parent_message_id" text,
	"thread_title" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "uq_conversation_parent_message" UNIQUE("parent_message_id","workspace_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_map" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"workspace_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "conversation_map_key_workspace" UNIQUE("key","workspace_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_read_state" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" text DEFAULT '1970-01-01T00:00:00.000Z' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "conversation_read_state_conv_user" UNIQUE("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"from_email" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"r2_key" text NOT NULL,
	"is_whitelisted" boolean DEFAULT false NOT NULL,
	"forwarded" boolean DEFAULT false NOT NULL,
	"message_id" text DEFAULT '' NOT NULL,
	"in_reply_to" text DEFAULT '' NOT NULL,
	"references" text DEFAULT '' NOT NULL,
	"html_body" text DEFAULT '' NOT NULL,
	"attachments" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"direction" text DEFAULT 'inbound' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_unread" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"task_id" text NOT NULL,
	"task_type" text NOT NULL,
	"task_status" text NOT NULL,
	"task_prompt" text,
	"completed_at" text NOT NULL,
	"latest_message_id" text,
	CONSTRAINT "inbox_unread_conv_user" UNIQUE("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "issue" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_id" text,
	"creator_user_id" text NOT NULL,
	"conversation_id" text,
	"latest_task_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"completed_at" text,
	CONSTRAINT "issue_conversation_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
CREATE TABLE "issue_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"issue_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"author_type" text DEFAULT 'user' NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine" (
	"daemon_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"device_info" text DEFAULT '' NOT NULL,
	"last_seen_at" text,
	"created_at" text NOT NULL,
	"pending_update_version" text,
	"pending_rescan" boolean DEFAULT false,
	"updated_at" text NOT NULL,
	"owner_id" text,
	CONSTRAINT "machine_workspace_id_daemon_id_pk" PRIMARY KEY("workspace_id","daemon_id")
);
--> statement-breakpoint
CREATE TABLE "machine_token" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"token" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"hostname" text,
	"runtimes_json" text,
	"last_used_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "machine_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "meeting_session" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"meeting_url" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"from_email" text,
	"is_whitelisted" boolean DEFAULT true NOT NULL,
	"participants" json DEFAULT '[]'::json NOT NULL,
	"scheduled_at" text,
	"started_at" text,
	"completed_at" text,
	"transcript_r2_key" text,
	"summary" text,
	"error" text,
	"worker_session_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"global_instruction" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "member_workspace_user" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"task_id" text,
	"attachment_ids" text,
	"metadata" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_flag" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "message_flag_message_user" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" text NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"polar_subscription_id" text,
	"polar_customer_id" text,
	"product_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'none' NOT NULL,
	"current_period_end" text,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "subscription_workspace_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "task_message" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"seq" integer NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"tool" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"call_id" text DEFAULT '' NOT NULL,
	"input" json,
	"output" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean,
	"image" text,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	"isBot" boolean DEFAULT false NOT NULL,
	"ownerUserId" text,
	"deletedAt" text,
	"discriminator" text DEFAULT '0000' NOT NULL,
	"lastRefreshContextAt" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" text NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"onboarded" integer DEFAULT 0 NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "workspace_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "workspace_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"changes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_file_request" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"request_type" text NOT NULL,
	"path" text DEFAULT '.' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"token" text NOT NULL,
	"created_by" text NOT NULL,
	"used_by" text,
	"used_at" text,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "workspace_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "community_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text,
	"uploader_id" text NOT NULL,
	"target_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text,
	"size" integer,
	"width" integer,
	"height" integer,
	"position" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"changes" text,
	"reason" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_bot_activity_event" (
	"id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"session_id" text,
	"launch_id" text,
	"kind" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_bot_approval_request" (
	"id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"kind" text NOT NULL,
	"server_id" text,
	"requested_by_user_id" text NOT NULL,
	"dm_message_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL,
	"resolved_at" text
);
--> statement-breakpoint
CREATE TABLE "community_bot_daily_activity" (
	"bot_id" text NOT NULL,
	"day" text NOT NULL,
	"handled_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "community_bot_daily_activity_bot_id_day_pk" PRIMARY KEY("bot_id","day")
);
--> statement-breakpoint
CREATE TABLE "community_category" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0,
	"private" integer DEFAULT 0,
	"creator_id" text,
	CONSTRAINT "uq_category_server_name" UNIQUE("server_id","name")
);
--> statement-breakpoint
CREATE TABLE "community_channel" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text,
	"category_id" text,
	"name" text,
	"type" text DEFAULT 'text' NOT NULL,
	"topic" text DEFAULT '',
	"position" integer DEFAULT 0,
	"parent_channel_id" text,
	"creator_id" text,
	"message_count" integer DEFAULT 0,
	"archived" integer DEFAULT 0,
	"parent_message_id" text,
	"last_message_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_channel_member" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"relation" text DEFAULT 'access' NOT NULL,
	"source" text DEFAULT 'added' NOT NULL,
	"added_by" text,
	"added_at" text NOT NULL,
	CONSTRAINT "uq_channel_member" UNIQUE("channel_id","user_id","relation")
);
--> statement-breakpoint
CREATE TABLE "community_friendship" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"needs_owner_approval" text,
	"blocker_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"resolved_at" text
);
--> statement-breakpoint
CREATE TABLE "community_mention" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"kind" text DEFAULT 'mention' NOT NULL,
	"read" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "community_message" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'default' NOT NULL,
	"mention_type" text,
	"reply_to_id" text,
	"embeds" text,
	"created_at" text NOT NULL,
	"channel_id" text NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	"friendship_id" text,
	"client_nonce" text
);
--> statement-breakpoint
CREATE TABLE "community_message_mark" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "uq_mark_user_message" UNIQUE("user_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "community_message_seq" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"next_seq" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_message_tag" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "uq_message_tag" UNIQUE("message_id","tag")
);
--> statement-breakpoint
CREATE TABLE "community_notification_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"server_id" text,
	"channel_id" text,
	"level" text DEFAULT 'all' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_pin" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"pinned_by" text,
	"created_at" text NOT NULL,
	CONSTRAINT "uq_pin_channel_message" UNIQUE("channel_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "community_reaction" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "uq_reaction_message_user_emoji" UNIQUE("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "community_read_state" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"last_read_at" text NOT NULL,
	"last_read_message_id" text,
	"last_read_seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_server" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"discriminator" text DEFAULT '0000' NOT NULL,
	"description" text DEFAULT '',
	"icon" text,
	"owner_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_server_folder" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "community_server_folder_item" (
	"folder_id" text NOT NULL,
	"server_id" text NOT NULL,
	"position" integer DEFAULT 0,
	CONSTRAINT "community_server_folder_item_folder_id_server_id_pk" PRIMARY KEY("folder_id","server_id")
);
--> statement-breakpoint
CREATE TABLE "community_server_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"created_by" text,
	"token" text NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0,
	"expires_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "community_server_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "community_server_member" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member',
	"rail_order" integer DEFAULT 0,
	"joined_at" text NOT NULL,
	CONSTRAINT "uq_server_member_server_user" UNIQUE("server_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "community_user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"about_me" text DEFAULT '',
	"banner_color" text,
	"status_emoji" text,
	"status_text" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "community_agent_runner_key" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"runner_key_hash" text NOT NULL,
	"do_name" text NOT NULL,
	"created_at" text NOT NULL,
	"revoked_at" text,
	CONSTRAINT "community_agent_runner_key_runner_key_hash_unique" UNIQUE("runner_key_hash"),
	CONSTRAINT "community_agent_runner_key_do_name_unique" UNIQUE("do_name")
);
--> statement-breakpoint
CREATE TABLE "community_bot_binding" (
	"user_id" text PRIMARY KEY NOT NULL,
	"machine_id" text NOT NULL,
	"runtime" text NOT NULL,
	"model_name" text,
	"provider_kind" text,
	"provider_api_url" text,
	"provider_api_key_enc" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_machine" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"hostname" text DEFAULT '' NOT NULL,
	"platform" text DEFAULT '' NOT NULL,
	"arch" text DEFAULT '' NOT NULL,
	"os_release" text DEFAULT '' NOT NULL,
	"daemon_version" text DEFAULT '' NOT NULL,
	"metadata" text,
	"available_runtimes" json DEFAULT '[]'::json NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"last_seen_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_machine_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"credential_hash" text NOT NULL,
	"do_name" text NOT NULL,
	"created_at" text NOT NULL,
	"last_used_at" text,
	"revoked_at" text,
	CONSTRAINT "community_machine_credential_credential_hash_unique" UNIQUE("credential_hash"),
	CONSTRAINT "community_machine_credential_do_name_unique" UNIQUE("do_name")
);
--> statement-breakpoint
CREATE TABLE "community_machine_token" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"machine_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	"last_used_at" text
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_runtime_id_agent_runtime_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."agent_runtime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_access" ADD CONSTRAINT "agent_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_access" ADD CONSTRAINT "agent_access_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_email_account" ADD CONSTRAINT "agent_email_account_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_link" ADD CONSTRAINT "agent_link_source_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("source_agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_link" ADD CONSTRAINT "agent_link_target_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("target_agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pin" ADD CONSTRAINT "agent_pin_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pin" ADD CONSTRAINT "agent_pin_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runtime" ADD CONSTRAINT "agent_runtime_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sidebar_order" ADD CONSTRAINT "agent_sidebar_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sidebar_order" ADD CONSTRAINT "agent_sidebar_order_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skill" ADD CONSTRAINT "agent_skill_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skill" ADD CONSTRAINT "agent_skill_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_queue" ADD CONSTRAINT "agent_task_queue_runtime_id_agent_runtime_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."agent_runtime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_queue" ADD CONSTRAINT "agent_task_queue_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_queue" ADD CONSTRAINT "agent_task_queue_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_queue" ADD CONSTRAINT "agent_task_queue_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_whitelist" ADD CONSTRAINT "agent_whitelist_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel" ADD CONSTRAINT "channel_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_map" ADD CONSTRAINT "conversation_map_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_map" ADD CONSTRAINT "conversation_map_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_read_state" ADD CONSTRAINT "conversation_read_state_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_read_state" ADD CONSTRAINT "conversation_read_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_unread" ADD CONSTRAINT "inbox_unread_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_unread" ADD CONSTRAINT "inbox_unread_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_creator_user_id_user_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_latest_task_id_agent_task_queue_id_fk" FOREIGN KEY ("latest_task_id") REFERENCES "public"."agent_task_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comment" ADD CONSTRAINT "issue_comment_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comment" ADD CONSTRAINT "issue_comment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine" ADD CONSTRAINT "machine_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine" ADD CONSTRAINT "machine_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_token" ADD CONSTRAINT "machine_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_token" ADD CONSTRAINT "machine_token_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_session" ADD CONSTRAINT "meeting_session_agent_id_workspace_id_agent_id_workspace_id_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_flag" ADD CONSTRAINT "message_flag_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_flag" ADD CONSTRAINT "message_flag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_flag" ADD CONSTRAINT "message_flag_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_message" ADD CONSTRAINT "task_message_task_id_agent_task_queue_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_task_queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_ownerUserId_user_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_file_request" ADD CONSTRAINT "workspace_file_request_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invite" ADD CONSTRAINT "workspace_invite_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_attachment" ADD CONSTRAINT "community_attachment_message_id_community_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_audit_log" ADD CONSTRAINT "community_audit_log_server_id_community_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."community_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_audit_log" ADD CONSTRAINT "community_audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bot_activity_event" ADD CONSTRAINT "community_bot_activity_event_bot_id_user_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bot_approval_request" ADD CONSTRAINT "community_bot_approval_request_bot_id_user_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bot_approval_request" ADD CONSTRAINT "community_bot_approval_request_server_id_community_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."community_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bot_approval_request" ADD CONSTRAINT "community_bot_approval_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bot_approval_request" ADD CONSTRAINT "community_bot_approval_request_dm_message_id_community_message_id_fk" FOREIGN KEY ("dm_message_id") REFERENCES "public"."community_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bot_daily_activity" ADD CONSTRAINT "community_bot_daily_activity_bot_id_user_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_category" ADD CONSTRAINT "community_category_server_id_community_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."community_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_category" ADD CONSTRAINT "community_category_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_channel" ADD CONSTRAINT "community_channel_server_id_community_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."community_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_channel" ADD CONSTRAINT "community_channel_category_id_community_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."community_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_channel" ADD CONSTRAINT "community_channel_parent_channel_id_community_channel_id_fk" FOREIGN KEY ("parent_channel_id") REFERENCES "public"."community_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_channel" ADD CONSTRAINT "community_channel_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_channel_member" ADD CONSTRAINT "community_channel_member_channel_id_community_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."community_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_channel_member" ADD CONSTRAINT "community_channel_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_channel_member" ADD CONSTRAINT "community_channel_member_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_friendship" ADD CONSTRAINT "community_friendship_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_friendship" ADD CONSTRAINT "community_friendship_addressee_id_user_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_friendship" ADD CONSTRAINT "community_friendship_needs_owner_approval_user_id_fk" FOREIGN KEY ("needs_owner_approval") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_mention" ADD CONSTRAINT "community_mention_message_id_community_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_mention" ADD CONSTRAINT "community_mention_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message" ADD CONSTRAINT "community_message_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message" ADD CONSTRAINT "community_message_channel_id_community_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."community_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message" ADD CONSTRAINT "community_message_friendship_id_community_friendship_id_fk" FOREIGN KEY ("friendship_id") REFERENCES "public"."community_friendship"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message_mark" ADD CONSTRAINT "community_message_mark_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message_mark" ADD CONSTRAINT "community_message_mark_channel_id_community_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."community_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message_mark" ADD CONSTRAINT "community_message_mark_message_id_community_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message_seq" ADD CONSTRAINT "community_message_seq_channel_id_community_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."community_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message_tag" ADD CONSTRAINT "community_message_tag_message_id_community_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notification_setting" ADD CONSTRAINT "community_notification_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notification_setting" ADD CONSTRAINT "community_notification_setting_server_id_community_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."community_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notification_setting" ADD CONSTRAINT "community_notification_setting_channel_id_community_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."community_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_pin" ADD CONSTRAINT "community_pin_channel_id_community_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."community_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_pin" ADD CONSTRAINT "community_pin_message_id_community_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_pin" ADD CONSTRAINT "community_pin_pinned_by_user_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reaction" ADD CONSTRAINT "community_reaction_message_id_community_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reaction" ADD CONSTRAINT "community_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_read_state" ADD CONSTRAINT "community_read_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_read_state" ADD CONSTRAINT "community_read_state_channel_id_community_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."community_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_server" ADD CONSTRAINT "community_server_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_server_folder" ADD CONSTRAINT "community_server_folder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_server_folder_item" ADD CONSTRAINT "community_server_folder_item_folder_id_community_server_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."community_server_folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_server_folder_item" ADD CONSTRAINT "community_server_folder_item_server_id_community_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."community_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_server_invite" ADD CONSTRAINT "community_server_invite_server_id_community_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."community_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_server_invite" ADD CONSTRAINT "community_server_invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_server_member" ADD CONSTRAINT "community_server_member_server_id_community_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."community_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_server_member" ADD CONSTRAINT "community_server_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_user_profile" ADD CONSTRAINT "community_user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_agent_runner_key" ADD CONSTRAINT "community_agent_runner_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_agent_runner_key" ADD CONSTRAINT "community_agent_runner_key_machine_id_community_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."community_machine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bot_binding" ADD CONSTRAINT "community_bot_binding_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bot_binding" ADD CONSTRAINT "community_bot_binding_machine_id_community_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."community_machine"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_machine" ADD CONSTRAINT "community_machine_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_machine_credential" ADD CONSTRAINT "community_machine_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_machine_credential" ADD CONSTRAINT "community_machine_credential_machine_id_community_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."community_machine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_machine_token" ADD CONSTRAINT "community_machine_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_access_agent_ws" ON "agent_access" USING btree ("agent_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_agent_access_user" ON "agent_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_account_agent_ws" ON "agent_email_account" USING btree ("agent_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_agent_link_workspace" ON "agent_link" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_agent_pin_ws_user" ON "agent_pin" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_runtime_workspace_daemon" ON "agent_runtime" USING btree ("workspace_id","daemon_id");--> statement-breakpoint
CREATE INDEX "idx_agent_runtime_daemon_workspace" ON "agent_runtime" USING btree ("daemon_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_agent_sidebar_order_ws_user" ON "agent_sidebar_order" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_as_workspace_runtime" ON "agent_skill" USING btree ("workspace_id","runtime");--> statement-breakpoint
CREATE INDEX "idx_as_agent_runtime" ON "agent_skill" USING btree ("agent_id","runtime");--> statement-breakpoint
CREATE INDEX "idx_task_queue_pending" ON "agent_task_queue" USING btree ("agent_id","status") WHERE status IN ('queued', 'dispatched');--> statement-breakpoint
CREATE INDEX "idx_task_queue_workspace_active" ON "agent_task_queue" USING btree ("workspace_id","status","agent_id") WHERE status IN ('queued', 'dispatched', 'running');--> statement-breakpoint
CREATE INDEX "idx_task_queue_agent_history" ON "agent_task_queue" USING btree ("agent_id","workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_task_queue_conversation_status" ON "agent_task_queue" USING btree ("conversation_id","status");--> statement-breakpoint
CREATE INDEX "idx_task_queue_trace" ON "agent_task_queue" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_task_queue_parent" ON "agent_task_queue" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "idx_task_queue_workspace_type_status" ON "agent_task_queue" USING btree ("workspace_id","type","status");--> statement-breakpoint
CREATE INDEX "idx_task_queue_workspace_status_dispatched" ON "agent_task_queue" USING btree ("workspace_id","status","dispatched_at");--> statement-breakpoint
CREATE INDEX "idx_task_queue_inbox" ON "agent_task_queue" USING btree ("workspace_id","status","completed_at");--> statement-breakpoint
CREATE INDEX "idx_task_queue_runtime_pending" ON "agent_task_queue" USING btree ("workspace_id","runtime_id","status") WHERE status IN ('queued', 'dispatched');--> statement-breakpoint
CREATE INDEX "idx_task_queue_agent_running" ON "agent_task_queue" USING btree ("agent_id","workspace_id","status") WHERE status IN ('dispatched', 'running');--> statement-breakpoint
CREATE INDEX "idx_task_queue_inbox_convo" ON "agent_task_queue" USING btree ("workspace_id","status","conversation_id","completed_at") WHERE status IN ('completed', 'failed') AND parent_task_id IS NULL;--> statement-breakpoint
CREATE INDEX "idx_artifact_conversation" ON "artifact" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_event_agent_ws" ON "calendar_event" USING btree ("agent_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_event_ws_scheduled" ON "calendar_event" USING btree ("workspace_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_channel_workspace" ON "channel" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_agent_lookup" ON "conversation" USING btree ("workspace_id","agent_id","user_id","type","channel","created_at");--> statement-breakpoint
CREATE INDEX "idx_conversation_ws_user" ON "conversation" USING btree ("workspace_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_conversation_thread" ON "conversation" USING btree ("parent_message_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_read_state_user" ON "conversation_read_state" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_emails_agent_ws_status" ON "emails" USING btree ("agent_id","workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_emails_to_direction" ON "emails" USING btree ("to_email","direction");--> statement-breakpoint
CREATE INDEX "idx_emails_from_direction" ON "emails" USING btree ("from_email","direction");--> statement-breakpoint
CREATE INDEX "idx_emails_message_id" ON "emails" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_emails_created_at" ON "emails" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_inbox_unread_user_ws" ON "inbox_unread" USING btree ("user_id","workspace_id","task_type","completed_at");--> statement-breakpoint
CREATE INDEX "idx_issue_workspace_status_agent" ON "issue" USING btree ("workspace_id","status","agent_id");--> statement-breakpoint
CREATE INDEX "idx_issue_workspace_updated" ON "issue" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_issue_comment_issue" ON "issue_comment" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_issue_comment_workspace" ON "issue_comment" USING btree ("workspace_id","issue_id");--> statement-breakpoint
CREATE INDEX "idx_machine_token" ON "machine_token" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_meeting_session_agent_ws" ON "meeting_session" USING btree ("agent_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_session_status" ON "meeting_session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_message_conversation_status" ON "message" USING btree ("conversation_id","status");--> statement-breakpoint
CREATE INDEX "idx_message_flag_ws_user_created" ON "message_flag" USING btree ("workspace_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_message_flag_message_user" ON "message_flag" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_session_token_expires" ON "session" USING btree ("token","expiresAt");--> statement-breakpoint
CREATE INDEX "idx_subscription_polar_id" ON "subscription" USING btree ("polar_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_task_message_task_seq" ON "task_message" USING btree ("task_id","seq");--> statement-breakpoint
CREATE INDEX "idx_task_message_task_created" ON "task_message" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_ownerUserId_isBot" ON "user" USING btree ("ownerUserId","isBot");--> statement-breakpoint
CREATE INDEX "idx_workspace_audit_log_ws_created" ON "workspace_audit_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_wfr_workspace_status" ON "workspace_file_request" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_workspace_invite_token" ON "workspace_invite" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_workspace_invite_workspace" ON "workspace_invite" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_attachment_message" ON "community_attachment" USING btree ("message_id","position");--> statement-breakpoint
CREATE INDEX "idx_audit_log_server_created" ON "community_audit_log" USING btree ("server_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_server_action" ON "community_audit_log" USING btree ("server_id","action");--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor_created" ON "community_audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_bot_activity_event_bot_created" ON "community_bot_activity_event" USING btree ("bot_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_community_bot_approval_bot" ON "community_bot_approval_request" USING btree ("bot_id","status");--> statement-breakpoint
CREATE INDEX "idx_channel_server_position" ON "community_channel" USING btree ("server_id","position");--> statement-breakpoint
CREATE INDEX "idx_channel_server_last_message" ON "community_channel" USING btree ("server_id","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_channel_parent" ON "community_channel" USING btree ("parent_channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_channel_server_name" ON "community_channel" USING btree ("server_id","name") WHERE parent_channel_id IS NULL;--> statement-breakpoint
CREATE INDEX "idx_channel_member_user" ON "community_channel_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_friendship_addressee_status" ON "community_friendship" USING btree ("addressee_id","status");--> statement-breakpoint
CREATE INDEX "idx_friendship_requester_status" ON "community_friendship" USING btree ("requester_id","status");--> statement-breakpoint
CREATE INDEX "idx_mention_user_read" ON "community_mention" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "idx_mention_message" ON "community_mention" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_message_channel_created" ON "community_message" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_message_channel_mention_created" ON "community_message" USING btree ("channel_id","mention_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_mark_user_created" ON "community_message_mark" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_message_tag_tag" ON "community_message_tag" USING btree ("tag","message_id");--> statement-breakpoint
CREATE INDEX "idx_notification_setting_user" ON "community_notification_setting" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pin_channel" ON "community_pin" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_reaction_message" ON "community_reaction" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_read_state_user" ON "community_read_state" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_community_server_name_discriminator" ON "community_server" USING btree ("name","discriminator");--> statement-breakpoint
CREATE INDEX "idx_server_folder_user_position" ON "community_server_folder" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "idx_server_folder_item_folder_position" ON "community_server_folder_item" USING btree ("folder_id","position");--> statement-breakpoint
CREATE INDEX "idx_server_invite_server" ON "community_server_invite" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "idx_server_member_user" ON "community_server_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_server_member_user_rail_order" ON "community_server_member" USING btree ("user_id","rail_order");--> statement-breakpoint
CREATE INDEX "idx_server_member_server_joined" ON "community_server_member" USING btree ("server_id","joined_at");--> statement-breakpoint
CREATE INDEX "idx_community_agent_runner_key_machine_agent" ON "community_agent_runner_key" USING btree ("machine_id","agent_id");--> statement-breakpoint
CREATE INDEX "idx_community_bot_binding_machine" ON "community_bot_binding" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "idx_community_machine_user_last_seen" ON "community_machine" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_community_machine_user_updated" ON "community_machine" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_community_machine_user_status" ON "community_machine" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_community_machine_credential_user" ON "community_machine_credential" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_community_machine_credential_machine" ON "community_machine_credential" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "idx_community_machine_token_user_status" ON "community_machine_token" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_community_machine_token_user_pending" ON "community_machine_token" USING btree ("user_id") WHERE status = 'pending';