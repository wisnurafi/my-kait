-- User variables: named {tokens} with default values, shared across templates/editor (UX backlog HIGH #4)
-- !!! RUN `pnpm db:push` TO PRODUCTION BEFORE MERGING (Vercel auto-deploys on merge)
-- NOTE: RLS dikelola langsung via DB (kebijakan repo), samakan policy owner seperti tabel lain.

CREATE TABLE "user_variables" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"default_value" text NOT NULL DEFAULT '',
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "user_variables_user_id_idx" ON "user_variables" ("user_id");--> statement-breakpoint
CREATE INDEX "user_variables_user_name_idx" ON "user_variables" ("user_id", "name");
