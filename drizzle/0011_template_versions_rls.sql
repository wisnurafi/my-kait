-- template_versions: owner-only RLS (same pattern as other tables).
-- Was missed in 0010; all version actions already check userId explicitly,
-- this is defense-in-depth.
-- !!! RUN `pnpm db:push` TO PRODUCTION BEFORE MERGING (Vercel auto-deploys on merge)

ALTER TABLE "template_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "template_versions_owner" ON "template_versions"
  FOR ALL USING (
    current_setting('app.current_user_id', true) IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) IS NULL
    OR user_id = current_setting('app.current_user_id', true)
  );
