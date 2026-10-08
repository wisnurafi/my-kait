-- Scheduled recurrence: repeat cadence for scheduled messages (UX backlog HIGH #3)
-- !!! RUN `pnpm db:push` TO PRODUCTION BEFORE MERGING (Vercel auto-deploys on merge)

CREATE TYPE "public"."scheduled_recurrence" AS ENUM('none', 'daily', 'weekly', 'monthly');--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "recurrence" "scheduled_recurrence" DEFAULT 'none' NOT NULL;
