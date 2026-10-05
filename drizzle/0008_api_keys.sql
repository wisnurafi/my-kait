-- Public REST API keys: api_keys table (SHA-256 hash only — raw key never stored)
-- !!! RUN `pnpm db:push` TO PRODUCTION BEFORE MERGING (Vercel auto-deploys on merge)

CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"name" text NOT NULL,
	"scopes" text[] NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- api_keys: owner-only when context is set (same pattern as webhooks)
CREATE POLICY "api_keys_owner" ON "api_keys"
  FOR ALL USING (
    current_setting('app.current_user_id', true) IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  );
