/**
 * Daily cron job — cleanup logs older than 30 days.
 * See PRD section 6.5.
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  // Verify secret
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");
  if (providedSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete logs older than 30 days
    await sql`DELETE FROM message_logs WHERE created_at < NOW() - INTERVAL '30 days'`;

    // Keep only 20 most recent ping checks per webhook, delete the rest
    await sql`
      DELETE FROM webhook_checks
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY webhook_id ORDER BY created_at DESC
          ) as rn
          FROM webhook_checks
        ) ranked
        WHERE rn <= 20
      )
    `;

    return NextResponse.json({
      success: true,
      message: "Cleanup completed",
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
