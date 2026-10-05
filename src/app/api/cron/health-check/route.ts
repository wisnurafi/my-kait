/**
 * Scheduled cron job — health monitor for all webhooks.
 * Pings every webhook, records the check, updates lastStatus,
 * and creates health alerts on down/recovered transitions.
 * See PRD section 3.2.
 * Protected by CRON_SECRET. Trigger: GET /api/cron/health-check
 */

import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhooks, webhookChecks, webhookHealthAlerts } from "@/lib/schema";
import { decryptWebhookUrl } from "@/lib/crypto";
import { pingWebhook } from "@/lib/discord";
import { env } from "@/lib/env";
import type { WebhookStatus } from "@/lib/schema";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — pinging many webhooks takes time

export async function GET(req: Request) {
  // Verify secret
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");
  if (providedSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allWebhooks = await db.select().from(webhooks);

    let checked = 0;
    let down = 0;
    let recovered = 0;
    const alerts: Array<{ webhookId: string; name: string; type: string }> = [];

    for (const wh of allWebhooks) {
      checked++;
      const previousStatus = wh.lastStatus as WebhookStatus;

      let url: string;
      try {
        url = decryptWebhookUrl(wh.urlEncrypted, wh.keyVersion);
      } catch {
        continue; // skip undecryptable
      }

      const result = await pingWebhook(url);
      const newStatus = result.status as WebhookStatus;

      // Record check
      await db.insert(webhookChecks).values({
        webhookId: wh.id,
        status: newStatus,
        httpStatus: result.httpStatus,
        latencyMs: result.latencyMs,
        error: result.error,
      });

      // Update webhook
      await db
        .update(webhooks)
        .set({ lastStatus: newStatus, lastCheckedAt: new Date() })
        .where(eq(webhooks.id, wh.id));

      // Transition: went down (was not invalid, now invalid)
      const wasUp = previousStatus !== "invalid";
      const isDown = newStatus === "invalid";
      if (wasUp && isDown) {
        down++;
        await db.insert(webhookHealthAlerts).values({
          userId: wh.userId,
          webhookId: wh.id,
          type: "down",
          message: `Webhook "${wh.name}" tidak merespons (${result.error ?? `HTTP ${result.httpStatus}`})`,
        });
        alerts.push({ webhookId: wh.id, name: wh.name, type: "down" });
      }

      // Transition: recovered (was invalid, now active)
      if (previousStatus === "invalid" && newStatus === "active") {
        recovered++;
        await db.insert(webhookHealthAlerts).values({
          userId: wh.userId,
          webhookId: wh.id,
          type: "recovered",
          message: `Webhook "${wh.name}" kembali online`,
        });
        alerts.push({ webhookId: wh.id, name: wh.name, type: "recovered" });
      }
    }

    // Prune old checks (keep 20 most recent per webhook, same as cleanup cron)
    await db.execute(sql`
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
    `);

    return NextResponse.json({
      success: true,
      checked,
      down,
      recovered,
      alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("cron", "health-check failed", err);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
