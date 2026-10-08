-- Template versions: snapshot folder_id so restore brings back the folder position
-- !!! RUN `pnpm db:push` TO PRODUCTION BEFORE MERGING (Vercel auto-deploys on merge)
-- NOTE: RLS dikelola langsung via DB (kebijakan repo); kolom baru ikut policy tabel yang sudah ada.

ALTER TABLE "template_versions" ADD COLUMN IF NOT EXISTS "folder_id" text;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_folder_id_template_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."template_folders"("id") ON DELETE set null ON UPDATE no action;
