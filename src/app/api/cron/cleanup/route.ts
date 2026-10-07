/**
 * Daily cron job — cleanup logs older than 30 days.
 * See PRD section 6.5.
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/server/admin-password";

/** Rows per DELETE chunk — keeps each statement small and lock-friendly. */
const CLEANUP_BATCH_SIZE = 5000;
/** Safety cap so a pathological backlog can't run the cron forever. */
const CLEANUP_MAX_BATCHES = 200;

export async function GET(req: Request) {
  // Verify secret — strict "Bearer <secret>" format, timing-safe comparison.
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  if (!safeEqual(providedSecret, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete logs older than 30 days in small batches instead of one giant
    // statement — a single DELETE over a large backlog would hold locks and
    // bloat the WAL for a long time.
    let deletedLogs = 0;
    for (let i = 0; i < CLEANUP_MAX_BATCHES; i++) {
      const rows = (await sql`
        DELETE FROM message_logs
        WHERE ctid IN (
          SELECT ctid FROM message_logs
          WHERE created_at < NOW() - INTERVAL '30 days'
          LIMIT ${CLEANUP_BATCH_SIZE}
        )
        RETURNING id
      `) as Array<{ id: string }>;
      deletedLogs += rows.length;
      if (rows.length < CLEANUP_BATCH_SIZE) break;
    }

    // Keep only the 20 most recent ping checks per webhook. Batched per
    // webhook so no single statement scans and deletes across all of them.
    const webhookIds = (await sql`SELECT DISTINCT webhook_id FROM webhook_checks`) as Array<{
      webhook_id: string;
    }>;
    let deletedChecks = 0;
    for (const { webhook_id } of webhookIds) {
      const rows = (await sql`
        DELETE FROM webhook_checks
        WHERE webhook_id = ${webhook_id}
          AND id NOT IN (
            SELECT id FROM webhook_checks
            WHERE webhook_id = ${webhook_id}
            ORDER BY created_at DESC
            LIMIT 20
          )
        RETURNING id
      `) as Array<{ id: string }>;
      deletedChecks += rows.length;
    }

    return NextResponse.json({
      success: true,
      message: "Cleanup completed",
      deletedLogs,
      deletedChecks,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("cron", "cleanup failed", err);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 },
    );
  }
}
