-- Template versions: manual snapshots for restore (P3 template versioning)
-- !!! RUN `pnpm db:push` TO PRODUCTION BEFORE MERGING (Vercel auto-deploys on merge)

CREATE TABLE "template_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL REFERENCES "templates"("id") ON DELETE CASCADE,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"description" text,
	"tags" text[],
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "template_versions_template_id_idx" ON "template_versions" ("template_id", "created_at");
