-- Scheduled messages: one-shot scheduled sends dispatched by cron-job.org
-- !!! RUN `pnpm db:push` TO PRODUCTION BEFORE MERGING (Vercel auto-deploys on merge)

CREATE TYPE "public"."scheduled_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"webhook_id" text,
	"manual_url_encrypted" text,
	"manual_url_key_version" text,
	"webhook_name_snapshot" text NOT NULL,
	"payload" jsonb NOT NULL,
	"mode" "message_mode" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "scheduled_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"claimed_at" timestamp with time zone,
	"sent_log_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_messages_user_id_idx" ON "scheduled_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scheduled_messages_due_idx" ON "scheduled_messages" USING btree ("status","scheduled_at");--> statement-breakpoint
ALTER TABLE "scheduled_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- scheduled_messages: owner-only when context is set (same pattern as webhooks)
CREATE POLICY "scheduled_messages_owner" ON "scheduled_messages"
  FOR ALL USING (
    current_setting('app.current_user_id', true) IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  );
